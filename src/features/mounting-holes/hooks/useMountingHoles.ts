/**
 * useMountingHoles — drills bolt holes into raw jaw blanks.
 *
 * Pipeline (per side, runs in parallel):
 *   1. Build raw blank box geometry, bake its world position (mesh.matrixWorld).
 *   2. Build the merged hole-tool geometry (counterbore + through, in world
 *      coords) for that side via buildHoleToolGeometry.
 *   3. Hand both off to cad-core's pooled `performHoleCSGInWorker`.
 *   4. Cache the holed result under JAW_HOLED_*.
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { performHoleCSGInWorker } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
  type CachedGeometry,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';
import { rightJawCenterX } from '@/utils/partGeometry';
import { computeMountingHolePositions, type HolePosition } from '../data/positions';
import { buildHoleToolGeometry } from '../utils/buildHoleTool';

export type MountingHolesStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseMountingHolesReturn {
  status: MountingHolesStatus;
  error:  string | null;
  generate: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  cacheKeyOut:       string,
  positions:         HolePosition[],
  sign:              -1 | 1,
  boltSize:          number,
  screwheadDiameter: number,
  screwheadHeight:   number,
  thickness:         number,
  height:            number,
  renderFace:        number,
  xCenter:           number,
  blankY:            number,
): Promise<void> {
  // Build a raw blank geometry baked in world coordinates
  const geo = new THREE.BoxGeometry(thickness, height, renderFace);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(xCenter, blankY, 0);
  mesh.updateMatrixWorld(true);

  const baseGeo = mesh.geometry.clone();
  baseGeo.applyMatrix4(mesh.matrixWorld);

  // Clean up mesh and original geometry
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();

  const tool = buildHoleToolGeometry(positions, sign, boltSize, screwheadDiameter, screwheadHeight, thickness);
  if (!tool) {
    baseGeo.dispose();
    throw new Error('No mounting holes to drill (count = 0).');
  }

  const result = await performHoleCSGInWorker(baseGeo, tool);
  
  // Free baseGeo and tool buffers
  baseGeo.dispose();
  tool.dispose();

  if (!result) {
    throw new Error('Hole CSG returned null.');
  }

  geometryCache.set(cacheKeyOut, bufferGeometryToCached(result));
  result.dispose();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMountingHoles(): UseMountingHolesReturn {
  const [status, setStatus] = useState<MountingHolesStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const viseConfig          = useViseStore((s) => s.viseConfig);
  const jawBlank            = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles       = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap            = useSoftJawsStore((s) => s.clampGap);
  const updateMountingHoles = useSoftJawsStore((s) => s.updateMountingHoles);
  const activePart          = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  const generate = useCallback(async () => {
    setStatus('running');
    setError(null);

    try {
      const { left, right } = computeMountingHolePositions(
        viseConfig, jawBlank, mountingHoles, activePart, clampGap,
      );

      const baseH      = jawBaseH(viseConfig.jawHeight);
      const innerX     = bracketInnerX(viseConfig);
      const blankY     = baseH + jawBlank.height / 2;
      const FACE_FIT_K = 0.98;
      const renderFace = Math.min(jawBlank.face, pillarFaceWidth(viseConfig) * FACE_FIT_K);

      const leftXCenter  = -(innerX - jawBlank.thickness / 2);
      const rightXCenter = rightJawCenterX(viseConfig, jawBlank, activePart, clampGap);

      await Promise.all([
        drillSide(
          JAW_HOLED_CACHE_KEY_LEFT,
          left,
          -1,
          mountingHoles.boltSize,
          mountingHoles.screwheadDiameter,
          mountingHoles.screwheadHeight,
          jawBlank.thickness,
          jawBlank.height,
          renderFace,
          leftXCenter,
          blankY,
        ),
        drillSide(
          JAW_HOLED_CACHE_KEY_RIGHT,
          right,
          1,
          mountingHoles.boltSize,
          mountingHoles.screwheadDiameter,
          mountingHoles.screwheadHeight,
          jawBlank.thickness,
          jawBlank.height,
          renderFace,
          rightXCenter,
          blankY,
        ),
      ]);

      updateMountingHoles({ generated: true });
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [viseConfig, jawBlank, mountingHoles, clampGap, activePart, updateMountingHoles]);

  return { status, error, generate };
}
