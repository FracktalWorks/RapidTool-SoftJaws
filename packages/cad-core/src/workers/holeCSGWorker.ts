/**
 * Hole CSG Web Worker
 * 
 * Performs CSG (Constructive Solid Geometry) operations to subtract
 * mounting holes from the baseplate geometry in a background thread.
 * 
 * This keeps the UI responsive during potentially slow CSG operations.
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { suppressDeprecatedMaxLeafTrisWarning } from './suppressBvhWarnings';

suppressDeprecatedMaxLeafTrisWarning();

// BVH options with increased maxDepth to handle complex geometries without warnings
const BVH_OPTIONS = {
  maxDepth: 100, // Default is 40, increase for complex merged geometries
  maxLeafSize: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SerializedGeometry {
  positions: Float32Array;
  indices?: Uint32Array;
  normals?: Float32Array;
}

interface HoleCSGWorkerMessage {
  type: 'subtract-holes';
  id: string;
  payload: {
    baseplateGeometryData: SerializedGeometry;
    holesGeometryData: SerializedGeometry;
  };
}

interface HoleCSGWorkerResponse {
  type: 'hole-csg-result' | 'hole-csg-progress' | 'hole-csg-error';
  id: string;
  payload?: SerializedGeometry;
  progress?: number;
  error?: string;
}

// Reusable CSG evaluator
const csgEvaluator = new Evaluator();

// ─────────────────────────────────────────────────────────────────────────────
// Geometry Serialization Helpers
// ─────────────────────────────────────────────────────────────────────────────

function deserializeGeometry(data: SerializedGeometry): THREE.BufferGeometry {
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));

  if (data.indices) {
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  }

  if (data.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  // CRITICAL — weld coincident vertices on NON-INDEXED input.
  //
  // STL parsers and triangle-soup tools (like a merge of N CylinderGeometry
  // produced by buildHoleTool) emit non-indexed geometry: each face owns
  // its own 3 unique vertices. three-bvh-csg builds its BVH from those
  // verts and can produce sliver artifacts / classifier failures where
  // adjacent faces almost-but-don't-quite share a vertex due to
  // floating-point inequality.
  //
  // mergeVertices(geo, 1e-5) welds positions within 0.01 µm of each other
  // into a single indexed vertex, restoring the manifold representation
  // three-bvh-csg needs. Same fix CSGEngine.cloneWorldGeometry applies.
  if (!geometry.getIndex()) {
    geometry = mergeVertices(geometry, 1e-5);
    geometry.computeVertexNormals();
  }

  // Add UV attribute for CSG (three-bvh-csg requires it)
  if (!geometry.getAttribute('uv')) {
    const posAttr = geometry.getAttribute('position');
    if (posAttr) {
      const uvArray = new Float32Array(posAttr.count * 2);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    }
  }

  return geometry;
}

/** Count triangles in a geometry — indexed and non-indexed both. */
function faceCount(geo: THREE.BufferGeometry): number {
  const idx = geo.getIndex();
  if (idx) return idx.count / 3;
  const pos = geo.getAttribute('position');
  return pos ? pos.count / 3 : 0;
}

function serializeGeometry(geometry: THREE.BufferGeometry): SerializedGeometry {
  const positions = geometry.getAttribute('position').array as Float32Array;
  const result: SerializedGeometry = {
    positions: new Float32Array(positions),
  };
  
  if (geometry.index) {
    result.indices = new Uint32Array(geometry.index.array);
  }
  
  const normals = geometry.getAttribute('normal');
  if (normals) {
    result.normals = new Float32Array(normals.array as Float32Array);
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSG Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Subtract `holesGeometry` from `baseplateGeometry`.
 *
 * Contract (per cad-core CLAUDE.md):
 *   - On success: returns the boolean result with computed normals.
 *   - On failure: THROWS with a descriptive error.
 *
 * Specifically does NOT silently return the original baseplate on error.
 * The previous behaviour masked CSG failures as no-op caches and made the
 * UI display un-drilled blanks as if drilling had succeeded — exactly the
 * "C-bore looks flat / through-hole missing in export" bug.
 *
 * Failure modes that throw:
 *   - three-bvh-csg evaluator exception (BVH build, classifier, etc.)
 *   - `result.geometry` is null/undefined
 *   - Output face count is < input + epsilon (no triangles were added,
 *     meaning the cutter didn't actually subtract anything — the tool
 *     missed the base, or the tool was malformed)
 */
function performCSGSubtraction(
  baseplateGeometry: THREE.BufferGeometry,
  holesGeometry: THREE.BufferGeometry,
  sendProgress: (progress: number) => void
): THREE.BufferGeometry {
  sendProgress(10);

  const baseplateClone = baseplateGeometry.clone();
  const holesClone = holesGeometry.clone();

  sendProgress(30);

  const baseplateBrush = new Brush(baseplateClone);
  const holesBrush = new Brush(holesClone);

  baseplateBrush.prepareGeometry();
  holesBrush.prepareGeometry();

  sendProgress(50);

  let result: Brush | undefined;
  try {
    result = csgEvaluator.evaluate(baseplateBrush, holesBrush, SUBTRACTION);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CSG evaluator threw: ${message}`);
  }

  sendProgress(90);

  if (!result || !result.geometry) {
    throw new Error('CSG returned no geometry — tool may be malformed or fully outside the base.');
  }

  result.geometry.computeVertexNormals();

  // Detect silent no-ops: if face count is unchanged, the cutter didn't
  // intersect the base in any triangle. A real subtraction always ADDS
  // triangles (new faces from the cut). For a non-trivial cutter we expect
  // the output to have AT LEAST one more triangle than the input.
  const inFaces  = faceCount(baseplateGeometry);
  const outFaces = faceCount(result.geometry);
  if (outFaces <= inFaces) {
    throw new Error(
      `CSG produced a no-op cut (input ${inFaces} faces → output ${outFaces} faces). ` +
      `The hole tool did not intersect the baseplate. Check positions, tool size, and overshoot.`,
    );
  }

  sendProgress(100);
  return result.geometry;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Message Handler
// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<HoleCSGWorkerMessage>) => {
  const { type, id, payload } = event.data;
  
  if (type === 'subtract-holes') {
    try {
      const sendProgress = (progress: number) => {
        const response: HoleCSGWorkerResponse = {
          type: 'hole-csg-progress',
          id,
          progress,
        };
        self.postMessage(response);
      };
      
      // Deserialize geometries
      const baseplateGeometry = deserializeGeometry(payload.baseplateGeometryData);
      const holesGeometry = deserializeGeometry(payload.holesGeometryData);
      
      // Perform CSG subtraction
      const resultGeometry = performCSGSubtraction(
        baseplateGeometry,
        holesGeometry,
        sendProgress
      );
      
      // Serialize result
      const serializedResult = serializeGeometry(resultGeometry);
      
      const response: HoleCSGWorkerResponse = {
        type: 'hole-csg-result',
        id,
        payload: serializedResult,
      };
      
      // Transfer arrays for performance
      const transferables: Transferable[] = [serializedResult.positions.buffer as ArrayBuffer];
      if (serializedResult.indices) {
        transferables.push(serializedResult.indices.buffer as ArrayBuffer);
      }
      if (serializedResult.normals) {
        transferables.push(serializedResult.normals.buffer as ArrayBuffer);
      }
      
      (self as unknown as Worker).postMessage(response, transferables);
    } catch (error) {
      const response: HoleCSGWorkerResponse = {
        type: 'hole-csg-error',
        id,
        error: error instanceof Error ? error.message : 'Unknown hole CSG error',
      };
      self.postMessage(response);
    }
  }
};

export {};
