import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { suppressDeprecatedMaxLeafTrisWarning } from '@rapidtool/cad-core';

suppressDeprecatedMaxLeafTrisWarning();

export interface ProfileWorkerInput {
  id: string;
  blankPositions: Float32Array;
  blankNormals: Float32Array;
  blankIndices?: Uint32Array;
  partPositions: Float32Array;
  partNormals: Float32Array;
  partIndices?: Uint32Array;
  partTransform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  partBoundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  removalDir: [number, number, number];
  depth: number;
  offset: number;
}

export interface ProfileWorkerOutput {
  id: string;
  success: boolean;
  positions?: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
  error?: string;
}

function getWorldSpaceVerts(
  positions: Float32Array,
  indices: Uint32Array | undefined,
  boundingBox: ProfileWorkerInput['partBoundingBox'],
  transform: ProfileWorkerInput['partTransform'],
): Float32Array {
  const { min, max } = boundingBox;
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const partHeight = max[1] - min[1];

  const centered = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    centered[i]     = positions[i]     - cx;
    centered[i + 1] = positions[i + 1] - cy;
    centered[i + 2] = positions[i + 2] - cz;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(centered, 3));
  if (indices) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

  const deg2rad = Math.PI / 180;
  const mesh = new THREE.Mesh(geo);
  mesh.position.set(
    transform.position.x,
    partHeight / 2 + transform.position.y,
    transform.position.z,
  );
  mesh.rotation.set(
    transform.rotation.x * deg2rad,
    transform.rotation.y * deg2rad,
    transform.rotation.z * deg2rad,
  );
  mesh.updateMatrixWorld(true);

  const worldGeo = indices ? geo.toNonIndexed() : geo.clone();
  worldGeo.applyMatrix4(mesh.matrixWorld);
  geo.dispose();
  return new Float32Array(worldGeo.getAttribute('position').array);
}

function computeBBox(pos: Float32Array) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function ensureUVs(geo: THREE.BufferGeometry): void {
  if (!geo.getAttribute('uv')) {
    const n = geo.getAttribute('position').count;
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
}

self.onmessage = async (e: MessageEvent<ProfileWorkerInput>) => {
  const data = e.data;

  try {
    // ── 1. World-space part geometry ──────────────────────────────────────────
    const worldVerts = getWorldSpaceVerts(
      data.partPositions,
      data.partIndices,
      data.partBoundingBox,
      data.partTransform,
    );

    // ── 2. Create the part geometry ───────────────────────────────────────────
    let partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(worldVerts, 3));
    if (data.partIndices) {
      partGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.partIndices), 1));
    } else {
      const n = worldVerts.length / 3;
      const indices = new Uint32Array(n);
      for (let i = 0; i < n; i++) indices[i] = i;
      partGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    // ── 3. Weld vertices to ensure manifold and average normals ───────────────
    partGeo = mergeVertices(partGeo, 1e-5);
    partGeo.computeVertexNormals();

    // ── 4. Inflate by clearance offset ────────────────────────────────────────
    if (data.offset > 0) {
      const pos = partGeo.getAttribute('position') as THREE.BufferAttribute;
      const nor = partGeo.getAttribute('normal') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const nArr = nor.array as Float32Array;
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3;
        arr[ix]     += nArr[ix]     * data.offset;
        arr[ix + 1] += nArr[ix + 1] * data.offset;
        arr[ix + 2] += nArr[ix + 2] * data.offset;
      }
      pos.needsUpdate = true;
      partGeo.computeVertexNormals();
    }
    partGeo.computeBoundingBox();
    partGeo.computeBoundingSphere();

    // ── 5. Jaw blank geometry ─────────────────────────────────────────────────
    const blankGeo = new THREE.BufferGeometry();
    blankGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.blankPositions), 3));
    blankGeo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(data.blankNormals), 3));
    if (data.blankIndices) {
      blankGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.blankIndices), 1));
    }

    const bb = computeBBox(data.blankPositions);
    const sweepNeg = data.removalDir[0] < 0;
    const jawFaceX = sweepNeg ? bb.maxX : bb.minX;

    // ── 6. Create depth clipping slab ─────────────────────────────────────────
    // Limit subtraction depth to exactly `data.depth` inside the jaw.
    const FRONT_MARGIN = 2.0; // mm past jaw face for clean entry and clearance
    const slabXSize = data.depth + FRONT_MARGIN;
    const slabXCenter = sweepNeg
      ? jawFaceX + (FRONT_MARGIN - data.depth) / 2
      : jawFaceX + (data.depth - FRONT_MARGIN) / 2;

    const slabYSize = (bb.maxY - bb.minY) * 3;
    const slabZSize = (bb.maxZ - bb.minZ) * 3;
    const slabYCenter = (bb.maxY + bb.minY) / 2;
    const slabZCenter = (bb.maxZ + bb.minZ) / 2;

    const slabGeo = new THREE.BoxGeometry(slabXSize, slabYSize, slabZSize);
    slabGeo.translate(slabXCenter, slabYCenter, slabZCenter);

    // ── 7. Run CSG Intersection to get the clipped cutter ────────────────────
    ensureUVs(blankGeo);
    ensureUVs(partGeo);
    ensureUVs(slabGeo);

    const evaluator = new Evaluator();
    const blankBrush  = new Brush(blankGeo);
    const partBrush   = new Brush(partGeo);
    const slabBrush   = new Brush(slabGeo);
    
    blankBrush.prepareGeometry();
    partBrush.prepareGeometry();
    slabBrush.prepareGeometry();

    const cutterBrush = evaluator.evaluate(partBrush, slabBrush, INTERSECTION);
    cutterBrush.prepareGeometry();

    // ── 8. Subtract cutter from blank ─────────────────────────────────────────
    const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
    const resGeo = mergeVertices(finalResult.geometry, 1e-4);
    resGeo.computeVertexNormals();

    // ── 9. Clean up temporary geometries ──────────────────────────────────────
    partGeo.dispose();
    slabGeo.dispose();
    blankGeo.dispose();
    cutterBrush.geometry.dispose();

    // ── 10. Extract output arrays ─────────────────────────────────────────────
    if (!resGeo.index) {
      const n = resGeo.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      resGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    }

    const posArray  = new Float32Array(resGeo.getAttribute('position').array);
    const normArray = new Float32Array(resGeo.getAttribute('normal').array);
    const idxArray  = new Uint32Array(resGeo.index!.array);
    resGeo.dispose();

    (self as unknown as Worker).postMessage({
      id: data.id, success: true,
      positions: posArray, normals: normArray, indices: idxArray,
    } as ProfileWorkerOutput, [posArray.buffer, normArray.buffer, idxArray.buffer]);

  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id: data.id, success: false, error: err.message ?? String(err),
    } as ProfileWorkerOutput);
  }
};
