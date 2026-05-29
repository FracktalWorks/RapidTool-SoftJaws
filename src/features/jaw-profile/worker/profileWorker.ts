import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';
import polygonClipping from 'polygon-clipping';
import { extractSilhouetteContour, suppressDeprecatedMaxLeafTrisWarning } from '@rapidtool/cad-core';

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

function inflateGeometry(geometry: THREE.BufferGeometry, offset: number): THREE.BufferGeometry {
  if (!offset) return geometry;
  let geo = geometry.clone();
  if (!geo.getIndex()) {
    geo = mergeVertices(geo, 1e-5);
  }
  geo.computeVertexNormals();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  const nArr = nor.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3;
    arr[ix]     += nArr[ix]     * offset;
    arr[ix + 1] += nArr[ix + 1] * offset;
    arr[ix + 2] += nArr[ix + 2] * offset;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function polyHolesToShapes(poly: [number, number][][][]): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  for (const polygon of poly) {
    // polygon[1..N] are the holes inside the outer contour
    for (let h = 1; h < polygon.length; h++) {
      const hole = polygon[h];
      if (hole.length < 3) continue;
      const shape = new THREE.Shape();
      shape.moveTo(hole[0][0], hole[0][1]);
      for (let i = 1; i < hole.length - 1; i++) shape.lineTo(hole[i][0], hole[i][1]);
      shape.closePath();
      shapes.push(shape);
    }
  }
  return shapes;
}

self.onmessage = async (e: MessageEvent<ProfileWorkerInput>) => {
  const data = e.data;

  try {
    const FRONT_MARGIN = 2; // mm past jaw inner face

    // ── 1. World-space part triangle soup ──
    const worldVerts = getWorldSpaceVerts(
      data.partPositions,
      data.partIndices,
      data.partBoundingBox,
      data.partTransform,
    );

    // ── 2. Jaw blank geometry ──
    const blankGeo = new THREE.BufferGeometry();
    blankGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.blankPositions), 3));
    blankGeo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(data.blankNormals), 3));
    if (data.blankIndices) {
      blankGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.blankIndices), 1));
    }

    const bb = computeBBox(data.blankPositions);
    const sweepNeg = data.removalDir[0] < 0;
    const jawFaceX = sweepNeg ? bb.maxX : bb.minX;

    // ── 3. Weld and inflate 3D part geometry ──
    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute('position', new THREE.BufferAttribute(worldVerts, 3));
    if (data.partIndices) {
      partGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.partIndices), 1));
    }
    partGeo.computeVertexNormals();

    let cleanPartGeo = partGeo;
    if (!partGeo.index) {
      cleanPartGeo = mergeVertices(partGeo, 1e-5);
      cleanPartGeo.computeVertexNormals();
    }
    ensureUVs(cleanPartGeo);

    // Inflate the 3D part by the clearance offset
    const inflatedPartGeo = inflateGeometry(cleanPartGeo, data.offset);

    // ── 4. Build depth clipping slab and intersect it with the part ──
    const slabXSize = data.depth + FRONT_MARGIN;
    const slabXCenter = sweepNeg ? jawFaceX - slabXSize / 2 : jawFaceX + slabXSize / 2;

    const slabYSize = (bb.maxY - bb.minY) * 3;
    const slabZSize = (bb.maxZ - bb.minZ) * 3;
    const slabYCenter = (bb.maxY + bb.minY) / 2;
    const slabZCenter = (bb.maxZ + bb.minZ) / 2;

    const slabGeo = new THREE.BoxGeometry(slabXSize, slabYSize, slabZSize);
    slabGeo.translate(slabXCenter, slabYCenter, slabZCenter);
    ensureUVs(slabGeo);

    const partBrush = new Brush(inflatedPartGeo);
    const slabBrush = new Brush(slabGeo);
    partBrush.prepareGeometry();
    slabBrush.prepareGeometry();

    const evaluator = new Evaluator();
    const clippedPartBrush = evaluator.evaluate(partBrush, slabBrush, INTERSECTION);

    // ── 5. Extract silhouette contour for holes and slot extensions ──
    const contourResult = await extractSilhouetteContour(worldVerts, {
      direction:     { x: data.removalDir[0], y: data.removalDir[1], z: data.removalDir[2] },
      contourOffset: data.offset,
      layerHeight:   0.5,
    });

    if (!contourResult) throw new Error('Silhouette extraction failed.');

    let py_max_current = -Infinity;
    let py_min_current = Infinity;
    let px_min = Infinity, px_max = -Infinity;

    for (const polygon of contourResult.poly) {
      for (const ring of polygon) {
        for (const [px, py] of ring) {
          if (py > py_max_current) py_max_current = py;
          if (py < py_min_current) py_min_current = py;
          if (px < px_min) px_min = px;
          if (px > px_max) px_max = px;
        }
      }
    }

    const extensionShapes: THREE.Shape[] = [];

    // Add hole shapes (solidifying any inner hollow cores)
    const holeShapes = polyHolesToShapes(contourResult.poly);
    extensionShapes.push(...holeShapes);

    // Add top loading slot extension (extending the cut all the way to the top of the jaw)
    const py_top_target = -bb.maxY;
    const EXTEND_EPSILON = 0.5;
    if (py_top_target < py_min_current - EXTEND_EPSILON) {
      const topShape = new THREE.Shape();
      topShape.moveTo(px_min - 0.01, py_top_target);
      topShape.lineTo(px_max + 0.01, py_top_target);
      topShape.lineTo(px_max + 0.01, py_min_current + 0.5);
      topShape.lineTo(px_min - 0.01, py_min_current + 0.5);
      topShape.closePath();
      extensionShapes.push(topShape);
    }

    // Add bottom loading slot extension (extending the cut all the way to the rail)
    const py_target = -bb.minY;
    if (py_target > py_max_current + EXTEND_EPSILON) {
      const bottomShape = new THREE.Shape();
      bottomShape.moveTo(px_min - 0.01, py_max_current - 0.5);
      bottomShape.lineTo(px_max + 0.01, py_max_current - 0.5);
      bottomShape.lineTo(px_max + 0.01, py_target);
      bottomShape.lineTo(px_min - 0.01, py_target);
      bottomShape.closePath();
      extensionShapes.push(bottomShape);
    }

    // ── 6. Combine 3D conforming part and slot extensions ──
    let cutterBrush = clippedPartBrush;

    if (extensionShapes.length > 0) {
      const extrudeGeo = new THREE.ExtrudeGeometry(extensionShapes, {
        depth: slabXSize,
        bevelEnabled: false,
      });

      const frontX = sweepNeg ? jawFaceX + FRONT_MARGIN : jawFaceX - FRONT_MARGIN;
      const m = sweepNeg
        ? new THREE.Matrix4().set(
             0,  0, -1, frontX,
             0, -1,  0, 0,
            -1,  0,  0, 0,
             0,  0,  0, 1,
          )
        : new THREE.Matrix4().set(
             0,  0,  1, frontX,
             0, -1,  0, 0,
             1,  0,  0, 0,
             0,  0,  0, 1,
          );

      extrudeGeo.applyMatrix4(m);
      extrudeGeo.computeVertexNormals();
      ensureUVs(extrudeGeo);

      const extensionBrush = new Brush(extrudeGeo);
      extensionBrush.prepareGeometry();
      clippedPartBrush.prepareGeometry();

      cutterBrush = evaluator.evaluate(clippedPartBrush, extensionBrush, ADDITION);
    }

    // ── 7. Subtract composite cutter from jaw blank ──
    ensureUVs(blankGeo);
    cutterBrush.prepareGeometry();
    const blankBrush = new Brush(blankGeo);
    blankBrush.prepareGeometry();

    const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
    const resGeo = mergeVertices(finalResult.geometry, 1e-4);
    resGeo.computeVertexNormals();

    // Clean up temporary geometries
    partGeo.dispose();
    slabGeo.dispose();
    blankGeo.dispose();
    if (resGeo !== finalResult.geometry) {
      finalResult.geometry.dispose();
    }

    // ── 8. Extract output arrays ──
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
