/**
 * useJawProfile — CSG pipeline hook for generating the jaw profile cavity.
 *
 * Subtracts the active workpiece from the jaw blank box using CSGEngine
 * from @rapidtool/cad-core. The operation runs inside a deferred Promise
 * (via setTimeout 0) so the React event loop is not blocked during computation.
 *
 * Result is stored in geometryCache under JAW_PROFILE_CACHE_KEY and the
 * store's jawProfile.generated flag is set to true on success.
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { CSGEngine } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { geometryCache, JAW_PROFILE_CACHE_KEY } from '@/stores/geometryCache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JawProfileStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseJawProfileReturn {
  status: JawProfileStatus;
  error: string | null;
  generate: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a THREE.Mesh for the jaw blank box.
 * Positioned so it sits on the Y = 0 ground plane, centered in X/Z.
 */
function buildBlankMesh(
  width: number,
  height: number,
  depth: number,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(0, height / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Reconstructs a THREE.Mesh from a CachedGeometry, centered at the world
 * origin and raised to sit on the Y = 0 plane, then applies the user transform.
 */
function buildPartMesh(
  cachedGeo: import('@/stores/geometryCache').CachedGeometry,
  boundingBox: { min: [number, number, number]; max: [number, number, number] },
  transform: import('@/stores/types').PartTransform
): THREE.Mesh {
  const { min, max } = boundingBox;
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const partHeight = max[1] - min[1];

  // Center the positions (mirrors the centering done in PartMesh renderer)
  const shifted = new Float32Array(cachedGeo.positions.length);
  for (let i = 0; i < cachedGeo.positions.length; i += 3) {
    shifted[i]     = cachedGeo.positions[i]     - cx;
    shifted[i + 1] = cachedGeo.positions[i + 1] - cy;
    shifted[i + 2] = cachedGeo.positions[i + 2] - cz;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(shifted, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(cachedGeo.normals.slice(), 3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  
  // Base Y lifts the part to sit on the ground plane; user offset adds on top
  const baseY = partHeight / 2;
  const deg2rad = Math.PI / 180;
  
  mesh.position.set(
    transform.position.x, 
    baseY + transform.position.y, 
    transform.position.z
  );
  
  mesh.rotation.set(
    transform.rotation.x * deg2rad, 
    transform.rotation.y * deg2rad, 
    transform.rotation.z * deg2rad
  );
  
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Extracts Float32Array position + normal data from a THREE.BufferGeometry.
 * Returns null if attributes are missing (malformed CSG result).
 */
function extractCachedGeometry(
  geometry: THREE.BufferGeometry,
): import('@/stores/geometryCache').CachedGeometry | null {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  const nrmAttr = geometry.getAttribute('normal')   as THREE.BufferAttribute | undefined;

  if (!posAttr || !nrmAttr) return null;

  // Ensure we have plain Float32Arrays (BufferAttribute.array may be a view)
  const positions = posAttr.array instanceof Float32Array
    ? posAttr.array.slice()
    : new Float32Array(posAttr.array);

  let normals: Float32Array;
  if (nrmAttr.array instanceof Float32Array) {
    normals = nrmAttr.array.slice();
  } else {
    normals = new Float32Array(nrmAttr.array);
  }

  return { positions, normals, faceCount: positions.length / 9 };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJawProfile(): UseJawProfileReturn {
  const [status, setStatus] = useState<JawProfileStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { parts, jawBlank, jawProfile, activePart, updateJawProfile } =
    useSoftJawsStore();

  const generate = useCallback(() => {
    // Validate preconditions
    const partId = activePart ?? parts[0]?.id ?? null;
    if (!partId) {
      setError('Import a part before generating the jaw profile.');
      return;
    }

    const cachedGeo = geometryCache.get(partId);
    if (!cachedGeo) {
      setError('Part geometry not found in cache. Try re-importing the file.');
      return;
    }

    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    setStatus('running');
    setError(null);

    // Run CSG in background worker
    const worker = new Worker(new URL('../worker/profileWorker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (e: MessageEvent<import('../worker/profileWorker').ProfileWorkerOutput>) => {
      const data = e.data;
      if (data.success && data.positions && data.normals) {
        // Cache the processed geometry
        geometryCache.set(JAW_PROFILE_CACHE_KEY, {
          positions: data.positions,
          normals: data.normals,
          faceCount: data.positions.length / 9, // roughly, if non-indexed
        });

        updateJawProfile({ generated: true });
        setStatus('success');
      } else {
        setError(data.error || 'CSG Worker failed');
        setStatus('error');
      }
      worker.terminate();
    };

    worker.onerror = (err) => {
      setError('Worker execution error: ' + err.message);
      setStatus('error');
      worker.terminate();
    };

    // Extract blank geometry data
    const blankMesh = buildBlankMesh(jawBlank.width, jawBlank.height, jawBlank.depth);
    const blankGeo = blankMesh.geometry;
    
    // Convert part cache arrays (ensure they are copied/transferred right)
    const payload: import('../worker/profileWorker').ProfileWorkerInput = {
      id: partId,
      blankPositions: blankGeo.getAttribute('position').array as Float32Array,
      blankNormals: blankGeo.getAttribute('normal').array as Float32Array,
      blankIndices: blankGeo.index?.array as Uint32Array | undefined,
      partPositions: cachedGeo.positions,
      partNormals: cachedGeo.normals,
      partTransform: part.transform,
      partBoundingBox: part.boundingBox,
      removalDir: [0, -1, 0],
      depth: jawProfile.depth,
      offset: jawProfile.clearance
    };

    worker.postMessage(payload);
  }, [parts, activePart, jawBlank, jawProfile, updateJawProfile]);

  return { status, error, generate };
}
