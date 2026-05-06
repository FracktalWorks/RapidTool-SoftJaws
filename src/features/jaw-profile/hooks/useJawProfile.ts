/**
 * useJawProfile — CSG pipeline hook for generating jaw profile cavities.
 *
 * The end product is TWO soft-jaw blanks (left and right) with workpiece-
 * shaped pockets cut into their inner X-faces. This hook:
 *   1. Builds a positioned blank mesh on each side (±jawXOffset)
 *   2. Bakes each blank's world transform into its geometry
 *   3. Fires one CSG worker per side with the correct sweep direction
 *   4. Caches the results under JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT}
 *
 * Removal directions:
 *   - Left  blank  → sweep toward -X  (removalDir = [-1, 0, 0])
 *   - Right blank  → sweep toward +X  (removalDir = [+1, 0, 0])
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';

export type JawProfileStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseJawProfileReturn {
  status: JawProfileStatus;
  error: string | null;
  generate: () => void;
}

// ─── Helper: build a positioned blank mesh ────────────────────────────────────

/**
 * Blank axis mapping matches JawBlankMesh.tsx:
 *   X thickness = jawBlank.thickness  (stick-out from carriage)
 *   Y height    = jawBlank.height
 *   Z face      = jawBlank.face       (along the jaw face)
 */
function buildBlankMesh(
  thickness: number,
  height:    number,
  face:      number,
  xCenter:   number,
  yCenter:   number,
): THREE.Mesh {
  const geo  = new THREE.BoxGeometry(thickness, height, face);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(xCenter, yCenter, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

// ─── Helper: fire a single worker and resolve when it posts back ─────────────

function runCsgWorker(
  payload: import('../worker/profileWorker').ProfileWorkerInput,
): Promise<import('../worker/profileWorker').ProfileWorkerOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../worker/profileWorker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e: MessageEvent<import('../worker/profileWorker').ProfileWorkerOutput>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      reject(new Error('Worker execution error: ' + err.message));
      worker.terminate();
    };
    worker.postMessage(payload);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJawProfile(): UseJawProfileReturn {
  const [status, setStatus] = useState<JawProfileStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { parts, jawBlank, jawProfile, activePart, clampGap, updateJawProfile } =
    useSoftJawsStore();
  const viseConfig = useViseStore((s) => s.viseConfig);

  const generate = useCallback(async () => {
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

    // ── Geometry layout ─────────────────────────────────────────────────────
    // Soft jaws are bolted to the L-bracket pillars (fixed end-stops), so
    // the jaw outer face abuts the pillar inner face — independent of part
    // width. Face is capped to the pillar Z width so the jaw never
    // overhangs the platform (mirrors JawBlankMesh render).
    const baseH      = jawBaseH(viseConfig.jawHeight);
    const innerX     = bracketInnerX(viseConfig);
    const fixedXOff    = innerX - jawBlank.thickness / 2;
    const bbox         = part.boundingBox;
    const adaptiveXOff = Math.min(
      fixedXOff,
      (bbox.max[0] - bbox.min[0]) / 2 + clampGap + jawBlank.thickness / 2,
    );
    const blankY     = baseH + jawBlank.height / 2;
    const renderFace = Math.min(jawBlank.face, pillarFaceWidth(viseConfig) * 0.98);

    // ── Build left & right blanks, bake world transform into geometry ───────
    const buildBakedGeo = (xCenter: number) => {
      const mesh = buildBlankMesh(
        jawBlank.thickness,
        jawBlank.height,
        renderFace,
        xCenter,
        blankY,
      );
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      return geo;
    };

    // Both blanks symmetric — jaw pair closes around the part from both sides.
    const leftGeo  = buildBakedGeo(-adaptiveXOff);
    const rightGeo = buildBakedGeo(+adaptiveXOff);

    const makePayload = (
      geo: THREE.BufferGeometry,
      removalDir: [number, number, number],
    ): import('../worker/profileWorker').ProfileWorkerInput => ({
      id:             partId,
      blankPositions: geo.getAttribute('position').array as Float32Array,
      blankNormals:   geo.getAttribute('normal').array   as Float32Array,
      blankIndices:   geo.index?.array as Uint32Array | undefined,
      partPositions:  cachedGeo.positions,
      partNormals:    cachedGeo.normals,
      partTransform:  part.transform,
      partBoundingBox: part.boundingBox,
      removalDir,
      depth:  jawProfile.depth,
      offset: jawProfile.clearance,
    });

    try {
      // Run both sides in parallel — each worker is independent.
      const [leftRes, rightRes] = await Promise.all([
        runCsgWorker(makePayload(leftGeo,  [-1, 0, 0])),
        runCsgWorker(makePayload(rightGeo, [+1, 0, 0])),
      ]);

      if (!leftRes.success || !leftRes.positions || !leftRes.normals) {
        throw new Error(leftRes.error || 'Left CSG failed');
      }
      if (!rightRes.success || !rightRes.positions || !rightRes.normals) {
        throw new Error(rightRes.error || 'Right CSG failed');
      }

      geometryCache.set(JAW_PROFILE_CACHE_KEY_LEFT, {
        positions: leftRes.positions,
        normals:   leftRes.normals,
        indices:   leftRes.indices,
        faceCount: leftRes.indices
          ? leftRes.indices.length / 3
          : leftRes.positions.length / 9,
      });
      geometryCache.set(JAW_PROFILE_CACHE_KEY_RIGHT, {
        positions: rightRes.positions,
        normals:   rightRes.normals,
        indices:   rightRes.indices,
        faceCount: rightRes.indices
          ? rightRes.indices.length / 3
          : rightRes.positions.length / 9,
      });

      updateJawProfile({ generated: true });
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [parts, activePart, jawBlank, jawProfile, viseConfig, updateJawProfile]);

  return { status, error, generate };
}
