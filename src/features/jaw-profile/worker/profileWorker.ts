import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
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

/**
 * Cap ring point count so ExtrudeGeometry's earcut stays fast.
 *
 * polygon-clipping union adds O(N) intersection vertices per step; after
 * ~50 accumulate iterations a ring can grow from 500 ΓåÆ 10000 points.
 * earcut on a 10k-point polygon is O(n┬▓) Γëê 10ΓÇô30 s per side ΓÇö that's what
 * causes the CSG worker timeout on complex meshes (threads, dense profiles).
 *
 * Uniform downsampling to MAX_RING_POINTS Γëñ 300 reduces earcut to ~50 ms.
 * For circular/thread silhouettes at typical bolt radii (r ΓëÑ 8 mm) the max
 * chord shortcut error is r(1 ΓêÆ cos(╧Ç/300)) Γëê 0.003 mm ΓÇö well below any
 * machining tolerance.
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
 * Convert a MultiPolygon (polygon-clipping format) into THREE.Shape objects
 * suitable for ExtrudeGeometry. Each polygon becomes one shape; holes are
 * attached via shape.holes.
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
    
    // For CNC soft jaws, we want the pocket to grip the outer boundary.
    // We intentionally ignore any internal holes (polygon[1..N]) to avoid
    // leaving "islands" of unmachined material in the center of hollow parts.
    
    shapes.push(shape);
  }
  return shapes;
}

self.onmessage = async (e: MessageEvent<ProfileWorkerInput>) => {
  const data = e.data;

  try {
    // ΓöÇΓöÇ 1. World-space part triangle soup ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const worldVerts = getWorldSpaceVerts(
      data.partPositions,
      data.partIndices,
      data.partBoundingBox,
      data.partTransform,
    );

    // ΓöÇΓöÇ 2. Jaw blank geometry ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const blankGeo = new THREE.BufferGeometry();
    blankGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.blankPositions), 3));
    blankGeo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(data.blankNormals), 3));
    if (data.blankIndices) {
      blankGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.blankIndices), 1));
    }

    const bb = computeBBox(data.blankPositions);
    const sweepNeg = data.removalDir[0] < 0;
    const jawFaceX = sweepNeg ? bb.maxX : bb.minX;

    // ΓöÇΓöÇ 3. Extract full-silhouette contour (slice + accumulate, no lofting) ΓöÇΓöÇΓöÇ
    //
    // extractSilhouetteContour runs the same slice/accumulate pipeline as
    // createSweptMesh but stops before the loft step, returning the last
    // merged-slice polygon ΓÇö the maximum union of all YZ cross-sections.
    // Using this as a prism cutter (rather than the staircase loft) removes
    // the horizontal shelf artifacts on curved cavity walls.
    const contourResult = await extractSilhouetteContour(worldVerts, {
      direction:     { x: data.removalDir[0], y: data.removalDir[1], z: data.removalDir[2] },
      contourOffset: data.offset,
      layerHeight:   0.5,
    });

    if (!contourResult) throw new Error('Silhouette extraction produced no contour.');

    // ΓöÇΓöÇ 3.5. DIAGNOSTIC ΓÇö dump the raw silhouette polygon so we can see
    //         whether the slicer is actually capturing the workpiece curves
    //         or producing a near-rectangle.
    //
    // For each ring: emit point count, bbox, and a coarse ascii thumbnail.
    {
      const dir = data.removalDir;
      console.groupCollapsed(`[silhouette] direction=[${dir[0]},${dir[1]},${dir[2]}] ΓÇö ${contourResult.poly.length} polygon(s)`);
      contourResult.poly.forEach((polygon, pi) => {
        polygon.forEach((ring, ri) => {
          let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
          for (const [px, py] of ring) {
            if (px < px0) px0 = px; if (px > px1) px1 = px;
            if (py < py0) py0 = py; if (py > py1) py1 = py;
          }
          const w = px1 - px0, h = py1 - py0;
          console.log(
            `poly[${pi}].ring[${ri}]: ${ring.length} pts | ` +
            `px=[${px0.toFixed(2)}..${px1.toFixed(2)}] w=${w.toFixed(2)} | ` +
            `py=[${py0.toFixed(2)}..${py1.toFixed(2)}] h=${h.toFixed(2)} | ` +
            `aspect=${(w/h).toFixed(2)}`
          );
          // 24├ù12 ascii grid: '#' for inside polygon (point-in-poly test)
          if (ri === 0) {
            const W = 32, H = 16;
            const rows: string[] = [];
            for (let row = 0; row < H; row++) {
              const py = py0 + (h * (row + 0.5)) / H;
              let line = '';
              for (let col = 0; col < W; col++) {
                const px = px0 + (w * (col + 0.5)) / W;
                let inside = false;
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                  const [xi, yi] = ring[i], [xj, yj] = ring[j];
                  if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
                }
                line += inside ? '#' : '┬╖';
              }
              rows.push(line);
            }
            console.log(rows.join('\n'));
          }
        });
      });
      console.groupEnd();
    }

    // ΓöÇΓöÇ 3a. Extend the silhouette downward to the rail (drop-in loading slot) ΓöÇ
    //
    // Soft jaws are typically machined as an open-bottom pocket so the
    // workpiece can be dropped in from above.
    const railY      = bb.minY;        // blank's lowest Y in world == rail
    const py_target  = -railY;

    let py_max_current = -Infinity;
    let px_min = Infinity, px_max = -Infinity;
    for (const polygon of contourResult.poly) {
      for (const ring of polygon) {
        for (const [px, py] of ring) {
          if (py > py_max_current) py_max_current = py;
          if (px < px_min) px_min = px;
          if (px > px_max) px_max = px;
        }
      }
    }

    let workingPoly: [number, number][][][] = contourResult.poly;
    const EXTEND_EPSILON = 0.5; // mm ΓÇö don't extend if workpiece is already at the rail
    if (py_target > py_max_current + EXTEND_EPSILON) {
      const extensionRect: [number, number][][][] = [[[
        [px_min - 0.01, py_max_current - 0.5],
        [px_max + 0.01, py_max_current - 0.5],
        [px_max + 0.01, py_target],
        [px_min - 0.01, py_target],
      ]]];
      workingPoly = polygonClipping.union(
        contourResult.poly as polygonClipping.MultiPolygon,
        extensionRect as polygonClipping.MultiPolygon,
      ) as [number, number][][][];
    }

    // ΓöÇΓöÇ 4. Build prismatic cutter via ExtrudeGeometry ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    const FRONT_MARGIN = 2; // mm past jaw inner face
    const extrudeDepth = data.depth + FRONT_MARGIN;

    const simplifiedPoly = simplifyPoly(workingPoly);
    const shapes = polyToShapes(simplifiedPoly);
    if (shapes.length === 0) throw new Error('No shapes produced from silhouette polygon.');

    const extrudeGeo = new THREE.ExtrudeGeometry(shapes, {
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

    // ΓöÇΓöÇ 5. Subtract cutter from blank ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    ensureUVs(blankGeo);
    ensureUVs(extrudeGeo);

    const evaluator = new Evaluator();
    const blankBrush  = new Brush(blankGeo);
    const cutterBrush = new Brush(extrudeGeo);
    blankBrush.prepareGeometry();
    cutterBrush.prepareGeometry();

    const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
    const resGeo = mergeVertices(finalResult.geometry, 1e-4);
    resGeo.computeVertexNormals();

    // ΓöÇΓöÇ 6. Extract output arrays ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    if (!resGeo.index) {
      const n = resGeo.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      resGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    }

    const posArray  = new Float32Array(resGeo.getAttribute('position').array);
    const normArray = new Float32Array(resGeo.getAttribute('normal').array);
    const idxArray  = new Uint32Array(resGeo.index!.array);

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
