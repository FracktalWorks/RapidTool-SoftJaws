import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, INTERSECTION, ADDITION } from 'three-bvh-csg';
import { extractSilhouetteContour } from '../../../../packages/cad-core/src/sweep/sweepProcessor';
import { suppressDeprecatedMaxLeafTrisWarning } from '../../../../packages/cad-core/src/workers/suppressBvhWarnings';
import { repairMeshForExport } from '../../../../packages/cad-core/src/mesh/manifoldMeshService';

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
  if (!pos || !nor) return geo;
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

function extractUpperVertices(
  verts: Float32Array,
  maxY: number,
  minZ: number,
  maxZ: number,
  minX: number,
  maxX: number,
): Float32Array {
  const result: number[] = [];
  for (let i = 0; i < verts.length; i += 9) {
    let matches = false;
    for (let j = 0; j < 9; j += 3) {
      const x = verts[i + j];
      const y = verts[i + j + 1];
      const z = verts[i + j + 2];

      const inZ = (z >= minZ - 0.5 && z <= maxZ + 0.5);
      const inX = (x >= minX && x <= maxX);
      const inY = (y > maxY);

      if (inZ && inX && inY) {
        matches = true;
        break;
      }
    }
    if (matches) {
      for (let j = 0; j < 9; j++) {
        result.push(verts[i + j]);
      }
    }
  }
  return new Float32Array(result);
}

function extractLowerVertices(
  verts: Float32Array,
  minY: number,
  minZ: number,
  maxZ: number,
  minX: number,
  maxX: number,
): Float32Array {
  const result: number[] = [];
  for (let i = 0; i < verts.length; i += 9) {
    let matches = false;
    for (let j = 0; j < 9; j += 3) {
      const x = verts[i + j];
      const y = verts[i + j + 1];
      const z = verts[i + j + 2];

      const inZ = (z >= minZ - 0.5 && z <= maxZ + 0.5);
      const inX = (x >= minX && x <= maxX);
      const inY = (y < minY);

      if (inZ && inX && inY) {
        matches = true;
        break;
      }
    }
    if (matches) {
      for (let j = 0; j < 9; j++) {
        result.push(verts[i + j]);
      }
    }
  }
  return new Float32Array(result);
}

function extractPocketTopVertices(
  verts: Float32Array,
  thresholdY: number,
): Float32Array {
  const result: number[] = [];
  for (let i = 0; i < verts.length; i += 9) {
    let matches = false;
    for (let j = 0; j < 9; j += 3) {
      const y = verts[i + j + 1];
      if (y > thresholdY) {
        matches = true;
        break;
      }
    }
    if (matches) {
      for (let j = 0; j < 9; j++) {
        result.push(verts[i + j]);
      }
    }
  }
  return new Float32Array(result);
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

async function extrudeSilhouette(
  verts: Float32Array,
  direction: { x: number; y: number; z: number },
  limitMin: number,
  limitMax: number,
  offsetDistance: number,
): Promise<THREE.BufferGeometry | null> {
  if (verts.length === 0) return null;
  const contourResult = await extractSilhouetteContour(verts, {
    direction,
    layerHeight: 1.5,
    contourOffset: offsetDistance,
  });

  if (!contourResult) return null;

  const simplifiedPoly = simplifyPoly(contourResult.poly);
  const shapes = polyToShapes(simplifiedPoly);
  if (shapes.length === 0) return null;

  const height = limitMax - limitMin;
  const extrudeGeo = new THREE.ExtrudeGeometry(shapes, {
    depth: height,
    bevelEnabled: false,
  });

  const dirVec = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
  const lx = contourResult.lx;
  const ly = contourResult.ly;
  const origin = dirVec.clone().multiplyScalar(limitMin);

  const m = new THREE.Matrix4().set(
    lx.x, ly.x, dirVec.x, origin.x,
    lx.y, ly.y, dirVec.y, origin.y,
    lx.z, ly.z, dirVec.z, origin.z,
    0,    0,    0,        1,
  );

  extrudeGeo.applyMatrix4(m);
  extrudeGeo.computeVertexNormals();
  ensureUVs(extrudeGeo);
  return extrudeGeo;
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
      // POCKET DEPTH — derived from the workpiece, NOT the fixed depth param.
      //
      // The jaw should wrap the workpiece up to its X-midline so the two jaws
      // together fully enclose the part's silhouette (standard soft-jaw grip).
      // Depth = half the part's world X-span, clamped to leave MIN_WALL of jaw
      // stock behind the pocket. The clearance offset (data.offset) is applied
      // separately by the sweep's offsetDistance, so the grip is the part shape
      // plus a uniform fit gap — never the fixed 5 mm slab.
            const MIN_WALL = 5.0; // mm of jaw stock that must remain behind the pocket
      const jawThickness = bb.maxX - bb.minX;
      const pocketDepth = Math.max(
        1,
        Math.min(data.depth, jawThickness - MIN_WALL - data.offset),
      );
      console.log(`[profileWorker] data.depth=${data.depth.toFixed(2)} → pocketDepth=${pocketDepth.toFixed(2)} (jawThickness=${jawThickness.toFixed(2)}, offset=${data.offset})`);

      // Build depth clipping slab first
      const slabXSize = pocketDepth + FRONT_MARGIN;
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
      const posAttr = croppedPartGeo.getAttribute('position');
      if (!posAttr || posAttr.count === 0) {
        clippedVerts = new Float32Array(0);
      } else if (croppedPartGeo.index) {
        const nonIndexedGeo = croppedPartGeo.toNonIndexed();
        const nonIndexedPos = nonIndexedGeo.getAttribute('position');
        clippedVerts = nonIndexedPos
          ? new Float32Array(nonIndexedPos.array)
          : new Float32Array(0);
        nonIndexedGeo.dispose();
      } else {
        clippedVerts = new Float32Array(posAttr.array);
      }

      // Clean up partGeo
      partGeo.dispose();

      if (clippedVerts.length === 0) {
        // No overlap between workpiece and jaw pocket zone — return uncut blank directly
        finalResultGeo = blankGeo.clone();
        blankGeo.dispose();
        slabGeo.dispose();
        croppedPartGeo.dispose();
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

        // 1. conformingCutterGeo = workpiece itself, inflated by offset
        const conformingCutterGeo = inflateGeometry(croppedPartGeo.clone(), data.offset);
        croppedPartGeo.dispose();

        // 2. Extract outward sweep direction
        const sweepDir = new THREE.Vector3(-data.removalDir[0], -data.removalDir[1], -data.removalDir[2]).normalize();
        let projMin = Infinity;
        let projMax = -Infinity;
        for (let i = 0; i < clippedVerts.length; i += 3) {
          const val = clippedVerts[i] * sweepDir.x + clippedVerts[i + 1] * sweepDir.y + clippedVerts[i + 2] * sweepDir.z;
          if (val < projMin) projMin = val;
          if (val > projMax) projMax = val;
        }

        // 3. Extrude the 2D silhouette along the sweep direction to clear retraction path
        const horizontalPrismGeo = await extrudeSilhouette(
          clippedVerts,
          { x: sweepDir.x, y: sweepDir.y, z: sweepDir.z },
          projMin - 0.5,
          projMax + FRONT_MARGIN + 2.0,
          data.offset,
        );

        let cutterGeometry: THREE.BufferGeometry;
        if (horizontalPrismGeo) {
          const conformingBrush = new Brush(conformingCutterGeo);
          const prismBrush = new Brush(horizontalPrismGeo);
          conformingBrush.prepareGeometry();
          prismBrush.prepareGeometry();

          const combinedCutterBrush = evaluator.evaluate(conformingBrush, prismBrush, ADDITION);
          cutterGeometry = combinedCutterBrush.geometry;

          conformingCutterGeo.dispose();
          horizontalPrismGeo.dispose();
        } else {
          cutterGeometry = conformingCutterGeo;
        }
        ensureUVs(cutterGeometry);

        // Find the maximum Y of the cropped workpiece inside the pocket
        let croppedMaxY = -Infinity;
        for (let i = 1; i < clippedVerts.length; i += 3) {
          if (clippedVerts[i] > croppedMaxY) {
            croppedMaxY = clippedVerts[i];
          }
        }
        console.log(`[profileWorker] croppedMaxY=${croppedMaxY.toFixed(2)}, bb.maxY=${bb.maxY.toFixed(2)}`);

        // Case A: Workpiece extends above the jaw top line.
        // We only need to relieve the TOP EDGE of the jaw face — a thin chamfer that lets
        // the protruding feature clear the jaw corner when the vise closes.
        // We do NOT sweep the full jaw height; that would punch an unnecessary column
        // through the entire jaw body.
        if (extendsAbove) {
          const pocketMinX = sweepNeg ? jawFaceX - slabXSize : jawFaceX;
          const pocketMaxX = sweepNeg ? jawFaceX : jawFaceX + slabXSize;
          const upperVerts = extractUpperVertices(worldVerts, bb.maxY, bb.minZ, bb.maxZ, pocketMinX, pocketMaxX);

          if (upperVerts.length > 0) {
            const upperSlotGeo = await extrudeSilhouette(
              upperVerts,
              { x: 0, y: 1, z: 0 },
              bb.maxY - 2.0,  // Only cut the top 2mm of the jaw — edge relief only
              bb.maxY + 1.0,
              data.offset,
            );

            if (upperSlotGeo) {
              const cutterBrush = new Brush(cutterGeometry);
              const upperSlotBrush = new Brush(upperSlotGeo);
              cutterBrush.prepareGeometry();
              upperSlotBrush.prepareGeometry();

              const combinedBrush = evaluator.evaluate(cutterBrush, upperSlotBrush, ADDITION);
              const prevCutter = cutterGeometry;
              cutterGeometry = combinedBrush.geometry;

              prevCutter.dispose();
              upperSlotGeo.dispose();
            }
          }
        }

        // Case B: Workpiece extends below the jaw bottom line.
        // Same principle as Case A — only relieve the bottom edge (top 2mm from bottom),
        // not the full jaw height.
        if (extendsBelow) {
          const pocketMinX = sweepNeg ? jawFaceX - slabXSize : jawFaceX;
          const pocketMaxX = sweepNeg ? jawFaceX : jawFaceX + slabXSize;
          const lowerVerts = extractLowerVertices(worldVerts, bb.minY, bb.minZ, bb.maxZ, pocketMinX, pocketMaxX);

          if (lowerVerts.length > 0) {
            const lowerSlotGeo = await extrudeSilhouette(
              lowerVerts,
              { x: 0, y: 1, z: 0 },
              bb.minY - 1.0,
              bb.minY + 2.0,  // Only cut the bottom 2mm of the jaw — edge relief only
              data.offset,
            );

            if (lowerSlotGeo) {
              const cutterBrush = new Brush(cutterGeometry);
              const lowerSlotBrush = new Brush(lowerSlotGeo);
              cutterBrush.prepareGeometry();
              lowerSlotBrush.prepareGeometry();

              const combinedBrush = evaluator.evaluate(cutterBrush, lowerSlotBrush, ADDITION);
              const prevCutter = cutterGeometry;
              cutterGeometry = combinedBrush.geometry;

              prevCutter.dispose();
              lowerSlotGeo.dispose();
            }
          }
        }

        // NOTE: Case C removed.
        // Case C used to clear the jaw material above the pocket when croppedMaxY < bb.maxY,
        // by extruding the pocket's X-Z footprint upward to the jaw top. This created an
        // unwanted RECTANGULAR slot visible from the top-down view.
        //
        // Physical reality for a HORIZONTAL machinist's vise:
        //   The workpiece is loaded SIDEWAYS (jaws open in X), never dropped in from the top.
        //   The conforming pocket + horizontal retraction sweep is all that is needed.
        //   Cutting a top slot weakens the jaw structurally and is mechanically incorrect.

        // Subtract final combined cutter from jaw blank
        ensureUVs(cutterGeometry);
        ensureUVs(blankGeo);

        const cutterBrush = new Brush(cutterGeometry);
        cutterBrush.prepareGeometry();

        const blankBrush = new Brush(blankGeo);
        blankBrush.prepareGeometry();

        const finalResult = evaluator.evaluate(blankBrush, cutterBrush, SUBTRACTION);
        finalResultGeo = mergeVertices(finalResult.geometry, 1e-4);
        finalResultGeo.computeVertexNormals();

        // ── Manifold repair pass ──────────────────────────────────────────────
        // Guarantees watertight, CAM-safe output. Runs WASM in this worker thread
        // (no UI blocking). Falls back gracefully if Manifold3D fails.
        try {
          const repairResult = await repairMeshForExport(finalResultGeo);
          if (repairResult.success && repairResult.geometry) {
            finalResultGeo.dispose();
            finalResultGeo = repairResult.geometry;
            console.log(`[profileWorker] manifold repair (main): ${repairResult.repairSteps.join(' | ')} — manifold=${repairResult.isManifold}`);
          } else {
            console.warn('[profileWorker] manifold repair returned no geometry, keeping merged result');
          }
        } catch (repairErr) {
          console.warn('[profileWorker] manifold repair threw, keeping merged result:', repairErr);
        }

        // Clean up
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

      // SHALLOW CONFORMING — use the workpiece silhouette directly. No slot
      // quads extending the cut to the jaw top/bottom (that was the vertical
      // channel the user asked to remove). The extrude is a clean prism of
      // the part's cross-section, only as deep as the jaw wraps the part.
      const simplifiedPoly = simplifyPoly(contourResult.poly);
      const extensionShapes: THREE.Shape[] = polyToShapes(simplifiedPoly);

      if (extensionShapes.length === 0) throw new Error('No shapes produced from silhouette polygon.');

      // Pocket depth derived from the workpiece (matches the primary path):
      // each jaw wraps to the part's X-midline, clamped to leave wall stock.
      const MIN_WALL = 5.0; // mm of jaw stock that must remain behind the pocket
      const jawThickness = bb.maxX - bb.minX;
      const pocketDepth = Math.max(
        1,
        Math.min(data.depth, jawThickness - MIN_WALL - data.offset),
      );

      const extrudeDepth = pocketDepth + FRONT_MARGIN;
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

      // ── Manifold repair pass (fallback path) ──────────────────────────────
      try {
        const repairResult = await repairMeshForExport(finalResultGeo);
        if (repairResult.success && repairResult.geometry) {
          finalResultGeo.dispose();
          finalResultGeo = repairResult.geometry;
          console.log(`[profileWorker] manifold repair (fallback): ${repairResult.repairSteps.join(' | ')} — manifold=${repairResult.isManifold}`);
        } else {
          console.warn('[profileWorker] manifold repair (fallback) returned no geometry, keeping merged result');
        }
      } catch (repairErr) {
        console.warn('[profileWorker] manifold repair (fallback) threw, keeping merged result:', repairErr);
      }

      blankGeo.dispose();
      extrudeGeo.dispose();
      if (finalResultGeo !== finalResult.geometry) {
        finalResult.geometry.dispose();
      }
    }

    if (!finalResultGeo) throw new Error('CSG failed to produce geometry.');

    // ── 8. Extract output arrays ──
    const posAttr = finalResultGeo.getAttribute('position');
    if (!posAttr) {
      throw new Error('finalResultGeo position attribute is missing!');
    }

    if (!finalResultGeo.index) {
      const n = posAttr.count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      finalResultGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    }

    const posArray  = new Float32Array(posAttr.array);
    const normAttr  = finalResultGeo.getAttribute('normal');
    const normArray = normAttr ? new Float32Array(normAttr.array) : new Float32Array(posArray.length);
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
