/**
 * useMountingHoles — drills bolt holes into both profiled jaw blanks.
 *
 * Pipeline (per side, runs in parallel):
 *   1. Read the profiled blank geometry from the cache (JAW_PROFILE_*).
 *   2. Build the merged hole-tool geometry (counterbore + through, in world
 *      coords) for that side via buildHoleToolGeometry.
 *   3. Hand both off to cad-core's pooled `performHoleCSGInWorker`.
 *   4. Cache the holed result under JAW_HOLED_*.
 *
 * Gating: requires `jawProfile.generated === true`. The step gate in the
 * toolbar enforces this; the hook double-checks defensively.
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { performHoleCSGInWorker } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
  type CachedGeometry,
} from '@/stores/geometryCache';
import { computeMountingHolePositions, type HolePosition } from '../data/positions';
import { buildHoleToolGeometry } from '../utils/buildHoleTool';

export type MountingHolesStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseMountingHolesReturn {
  status: MountingHolesStatus;
  error:  string | null;
  generate: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cachedToBufferGeometry(cached: CachedGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals,   3));
  if (cached.indices) {
    geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
  }
  return geo;
}

function bufferGeometryToCached(geo: THREE.BufferGeometry): CachedGeometry {
  const positions = new Float32Array(geo.getAttribute('position').array);
  const normals   = geo.getAttribute('normal')
    ? new Float32Array(geo.getAttribute('normal').array)
    : new Float32Array(positions.length);
  const indices = geo.index ? new Uint32Array(geo.index.array) : undefined;
  const faceCount = indices ? indices.length / 3 : positions.length / 9;
  return { positions, normals, indices, faceCount };
}

async function drillSide(
  cacheKeyIn:  string,
  cacheKeyOut: string,
  positions:   HolePosition[],
  sign:        -1 | 1,
  boltSize:    number,
  thickness:   number,
): Promise<void> {
  const cachedProfile = geometryCache.get(cacheKeyIn);
  if (!cachedProfile) {
    throw new Error(`Profile geometry missing for ${cacheKeyIn}.`);
  }

  const baseGeo = cachedToBufferGeometry(cachedProfile);
  const tool    = buildHoleToolGeometry(positions, sign, boltSize, thickness);
  if (!tool) {
    throw new Error('No mounting holes to drill (count = 0).');
  }

  const result = await performHoleCSGInWorker(baseGeo, tool);
  if (!result) {
    throw new Error(`Hole CSG returned null for ${cacheKeyIn}.`);
  }

  geometryCache.set(cacheKeyOut, bufferGeometryToCached(result));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMountingHoles(): UseMountingHolesReturn {
  const [status, setStatus] = useState<MountingHolesStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const viseConfig          = useViseStore((s) => s.viseConfig);
  const jawBlank            = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles       = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap            = useSoftJawsStore((s) => s.clampGap);
  const profileReady        = useSoftJawsStore((s) => s.jawProfile.generated);
  const updateMountingHoles = useSoftJawsStore((s) => s.updateMountingHoles);
  const activePart          = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  const generate = useCallback(async () => {
    if (!profileReady) {
      setError('Generate the jaw profile first.');
      return;
    }

    setStatus('running');
    setError(null);

    try {
      // Adaptive right-jaw center X (rotation-aware, tracks the part) is now
      // computed INSIDE computeMountingHolePositions via the shared
      // rightJawCenterX helper. No local recomputation needed — the drill
      // positions automatically align with the profiled blanks in the cache.
      const { left, right } = computeMountingHolePositions(
        viseConfig, jawBlank, mountingHoles, activePart, clampGap,
      );

      await Promise.all([
        drillSide(
          JAW_PROFILE_CACHE_KEY_LEFT,
          JAW_HOLED_CACHE_KEY_LEFT,
          left,
          -1,
          mountingHoles.boltSize,
          jawBlank.thickness,
        ),
        drillSide(
          JAW_PROFILE_CACHE_KEY_RIGHT,
          JAW_HOLED_CACHE_KEY_RIGHT,
          right,
          1,
          mountingHoles.boltSize,
          jawBlank.thickness,
        ),
      ]);

      updateMountingHoles({ generated: true });
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [profileReady, viseConfig, jawBlank, mountingHoles, clampGap, activePart, updateMountingHoles]);

  return { status, error, generate };
}
