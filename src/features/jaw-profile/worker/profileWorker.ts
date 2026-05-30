import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';
import polygonClipping from 'polygon-clipping';
import { extractSilhouetteContour, createSweptMesh } from '../../../../packages/cad-core/src/sweep/sweepProcessor';
import { suppressDeprecatedMaxLeafTrisWarning } from '../../../../packages/cad-core/src/workers/suppressBvhWarnings';

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
  geo = mergeVertices(geo, 1e-5);
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

/**
 * Cap ring point count so ExtrudeGeometry's earcut stays fast.
 */
const MAX_RING_POINTS = 300;

function limitRing(ring: [number, number][]): [number, number][] {
  if (ring.length <= MAX_RING_POINTS) return ring;
  const step = ring.length / MAX_RING_POINTS;
  const out: [number, number][] = [];
  for (let i = 0; i < MAX_RING_POINTS; i++) {
    out.push(ring[Math.floor(i * step)]);
  }
  return out;
}

function simplifyPoly(poly: [number, number][][][]): [number, number][][][] {
  return poly
    .map(polygon => polygon.map(limitRing).filter(r => r.length >= 3))
    .filter(polygon => polygon.length > 0);
}

/**
 * Convert a MultiPolygon into THREE.Shape objects.
 * We ignore internal holes so the pocket grips the outer boundary cleanly.
 */
function polyToShapes(poly: [number, number][][][]): THREE.Shape[] {
  const shapes: THREE.Shape[] = [];
  for (const polygon of poly) {
    const outer = polygon[0];
    if (!outer || outer.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(outer[0][0], outer[0][1]);
    for (let i = 1; i < outer.length - 1; i++) shape.lineTo(outer[i][0], outer[i][1]);
    shape.closePath();
    shapes.push(shape);
  }
  return shapes;
}

function isRingCCW(ring: [number, number][]): boolean {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];
    area += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return area > 0;
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

    let finalResultGeo: THREE.BufferGeometry | null = null;
    let fallbackToPrismatic = false;

    // ── Try 3D Conforming CSG Subtraction ──
    try {
      // Build depth clipping slab first
      const slabXSize = data.depth + FRONT_MARGIN;
      const slabXCenter = sweepNeg ? jawFaceX - slabXSize / 2 : jawFaceX + slabXSize / 2;

      // Restrict Y-bounds to [bb.minY - blankHeight, bb.maxY] so we discard features in the air above the blank
      const blankHeight = bb.maxY - bb.minY;
      const slabYSize = blankHeight * 2;
      const slabZSize = (bb.maxZ - bb.minZ) * 3;
      const slabYCenter = bb.minY;
      const slabZCenter = (bb.maxZ + bb.minZ) / 2;

      const slabGeo = new THREE.BoxGeometry(slabXSize, slabYSize, slabZSize);
      slabGeo.translate(slabXCenter, slabYCenter, slabZCenter);

      // Pre-clip part geometry using slabGeo first
      const partGeo = new THREE.BufferGeometry();
      partGeo.setAttribute('position', new THREE.BufferAttribute(worldVerts, 3));
      ensureUVs(partGeo);
      partGeo.computeVertexNormals();

      ensureUVs(slabGeo);

      const partBrush = new Brush(partGeo);
      const slabBrush = new Brush(slabGeo);
      partBrush.prepareGeometry();
      slabBrush.prepareGeometry();

      const evaluator = new Evaluator();
      const croppedPartBrush = evaluator.evaluate(partBrush, slabBrush, INTERSECTION);
      const croppedPartGeo = croppedPartBrush.geometry;

      // Extract clipped vertices for the sweep
      let clippedVerts: Float32Array;
      if (croppedPartGeo.index) {
        const nonIndexedGeo = croppedPartGeo.toNonIndexed();
        clippedVerts = new Float32Array(nonIndexedGeo.getAttribute('position').array);
        nonIndexedGeo.dispose();
      } else {
        clippedVerts = new Float32Array(croppedPartGeo.getAttribute('position').array);
      }

      // Clean up partGeo and croppedPartBrush
      partGeo.dispose();
      croppedPartGeo.dispose();

      if (clippedVerts.length === 0) {
        // No overlap between workpiece and jaw pocket zone — return uncut blank directly
        finalResultGeo = blankGeo.clone();
        blankGeo.dispose();
        slabGeo.dispose();
      } else {

      // Determine if the workpiece extends above or below the blank's Y bounds in this jaw's X/Z pocket zone
      let extendsAbove = false;
      let extendsBelow = false;
      for (let i = 0; i < worldVerts.length; i += 3) {
        const x = worldVerts[i];
        const y = worldVerts[i + 1];
        const z = worldVerts[i + 2];

        // Z bounds check: within blank Z bounds (padded by 0.5mm for safety)
        const inZ = (z >= bb.minZ - 0.5 && z <= bb.maxZ + 0.5);
        if (!inZ) continue;

        // X bounds check: within the pocket depth
        const inX = sweepNeg
          ? (x >= jawFaceX - slabXSize && x <= jawFaceX)
          : (x >= jawFaceX && x <= jawFaceX + slabXSize);
        if (!inX) continue;

        if (y > bb.maxY) extendsAbove = true;
        if (y < bb.minY) extendsBelow = true;

        if (extendsAbove && extendsBelow) break;
      }

      console.log(`[profileWorker] extendsAbove=${extendsAbove}, extendsBelow=${extendsBelow}`);

      // Generate the 3D horizontal sweep (removal direction) of the pre-clipped workpiece
      const sweptXResult = await createSweptMesh(clippedVerts, {
        direction: { x: data.removalDir[0], y: data.removalDir[1], z: data.removalDir[2] }, // Sweep along removal axis
        layerHeight: 1.5, // 1.5 mm layers for speed
        offsetDistance: data.offset, // Fit clearance
        contourOffset: 0,
        accumulate: true,
      });

      if (!sweptXResult.geometry) {
        throw new Error('3D horizontal sweep failed to produce geometry.');
      }

      let cutterGeometry: THREE.BufferGeometry;

      if (extendsAbove || extendsBelow) {
        // Generate the 3D vertical sweep (+Y) of the pre-clipped workpiece
        const sweptYResult = await createSweptMesh(clippedVerts, {
          direction: { x: 0, y: 1, z: 0 }, // Sweep vertically upwards (+Y)
          layerHeight: 1.5, // Coarser 1.5 mm layers
          offsetDistance: data.offset, // Fit clearance (3D normal inflation)
          contourOffset: 0,
          accumulate: true,
          limitMin: extendsBelow ? bb.minY - 1.0 : null, // Extend downwards past the bottom rail only if needed
          limitMax: extendsAbove ? bb.maxY + 1.0 : null, // Extend upwards past the top of the jaw only if needed
        });

        if (!sweptYResult.geometry) {
          sweptXResult.geometry.dispose();
          throw new Error('3D vertical sweep failed to produce geometry.');
        }

        // Union vertical and horizontal sweeps
        ensureUVs(sweptYResult.geometry);
        ensureUVs(sweptXResult.geometry);

        const sweptYBrush = new Brush(sweptYResult.geometry);
        const sweptXBrush = new Brush(sweptXResult.geometry);
        sweptYBrush.prepareGeometry();
        sweptXBrush.prepareGeometry();

        const combinedCutterBrush = evaluator.evaluate(sweptYBrush, sweptXBrush, ADDITION);
        cutterGeometry = combinedCutterBrush.geometry;

        // Clean up raw swept geometries
        sweptYResult.geometry.dispose();
        sweptXResult.geometry.dispose();
      } else {
        // Use horizontal sweep directly (no vertical slot needed)
        cutterGeometry = sweptXResult.geometry;
      }

      // Subtract combined cutter from jaw blank
      ensureUVs(cutterGeometry);
      ensureUVs(blankGeo);

      const cutterBrush = new Brush(cutterGeometry);
      cutterBrush.prepareGeometry();

      const blankBrush = new Brush(blankGeo);
      blankBrush.prepareGeometry();

      const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
      finalResultGeo = mergeVertices(finalResult.geometry, 1e-4);
      finalResultGeo.computeVertexNormals();

      // Clean up temporary geometries
      cutterGeometry.dispose();
      slabGeo.dispose();
      blankGeo.dispose();
      if (finalResultGeo !== finalResult.geometry) {
        finalResult.geometry.dispose();
      }
      }
    } catch (csgError) {
      console.warn('[ProfileWorker] 3D CSG failed (likely non-manifold mesh), falling back to prismatic silhouette cut:', csgError);
      fallbackToPrismatic = true;
    }

    // ── Fallback: Robust Prismatic Silhouette Cut ──
    if (fallbackToPrismatic || !finalResultGeo) {
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

      // Generate conforming slot quads along the silhouette boundary
      const quads: [number, number][][][] = [];
      const py_top_target = -bb.maxY;
      const py_target = -bb.minY;

      for (const polygon of contourResult.poly) {
        const outerRing = polygon[0];
        if (!outerRing || outerRing.length < 3) continue;

        const simplifiedRing = limitRing(outerRing);
        const ccw = isRingCCW(simplifiedRing);
        const n = simplifiedRing.length;

        for (let i = 0; i < n; i++) {
          const p1 = simplifiedRing[i];
          const p2 = simplifiedRing[(i + 1) % n];
          const dx = p2[0] - p1[0];

          if (Math.abs(dx) < 1e-5) continue;

          const facesTop = ccw ? (dx > 0) : (dx < 0);

          if (facesTop) {
            const targetY = py_top_target - 0.5;
            quads.push([[
              [p1[0], p1[1]],
              [p2[0], p2[1]],
              [p2[0], targetY],
              [p1[0], targetY]
            ]]);
          } else {
            const targetY = py_target + 0.5;
            quads.push([[
              [p1[0], p1[1]],
              [p2[0], p2[1]],
              [p2[0], targetY],
              [p1[0], targetY]
            ]]);
          }
        }
      }

      // In fallback, we union the slot quads and the silhouette contour itself
      let combinedPoly = contourResult.poly;
      if (quads.length > 0) {
        combinedPoly = polygonClipping.union(combinedPoly, ...quads);
      }
      const simplifiedPoly = simplifyPoly(combinedPoly);
      const shapes = polyToShapes(simplifiedPoly);
      extensionShapes.push(...shapes);

      if (extensionShapes.length === 0) throw new Error('No shapes produced from silhouette polygon.');

      const extrudeDepth = data.depth + FRONT_MARGIN;
      const extrudeGeo = new THREE.ExtrudeGeometry(extensionShapes, {
        depth: extrudeDepth,
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

      ensureUVs(blankGeo);
      const blankBrush  = new Brush(blankGeo);
      const cutterBrush = new Brush(extrudeGeo);
      blankBrush.prepareGeometry();
      cutterBrush.prepareGeometry();

      const evaluator = new Evaluator();
      const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
      finalResultGeo = mergeVertices(finalResult.geometry, 1e-4);
      finalResultGeo.computeVertexNormals();

      blankGeo.dispose();
      extrudeGeo.dispose();
      if (finalResultGeo !== finalResult.geometry) {
        finalResult.geometry.dispose();
      }
    }

    if (!finalResultGeo) throw new Error('CSG failed to produce geometry.');

    // ── 8. Extract output arrays ──
    if (!finalResultGeo.index) {
      const n = finalResultGeo.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      finalResultGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    }

    const posArray  = new Float32Array(finalResultGeo.getAttribute('position').array);
    const normArray = new Float32Array(finalResultGeo.getAttribute('normal').array);
    const idxArray  = new Uint32Array(finalResultGeo.index!.array);
    finalResultGeo.dispose();

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
