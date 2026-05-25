/**
 * useMountingHoles — drills bolt holes into raw jaw blanks at LOCAL frame.
 *
 * Pipeline (per side, runs in parallel):
 *   1. Build raw blank geometry CENTRED AT ORIGIN — local frame, no world
 *      position baked in.
 *   2. Build the merged hole-tool geometry at LOCAL positions (yOff, zOff
 *      relative to blank centre). The X (clamping) axis stays at 0; the
 *      counterbore offset is local-only too.
 *   3. Hand both off to cad-core's pooled `performHoleCSGInWorker`.
 *   4. Cache the local-frame holed result under JAW_HOLED_*.
 *
 * KEY DESIGN — why we cache in LOCAL frame:
 *   Previously the holed blank was baked at its world position (depended on
 *   viseConfig.jawStroke, activePart, clampGap). Any change to those — even
 *   ones that only MOVED the blank — invalidated the cache and forced a 3–4 s
 *   re-drill. With LOCAL-frame caching, the geometry is identical regardless
 *   of where the blank sits in the vise; JawBlankMesh just translates it via
 *   `mesh.position` at render time. Re-drill is needed only when the SHAPE
 *   changes (jawBlank.{thickness,height,face} or mountingHoles.{boltSize,
 *   screwhead*, spacing, holesHeight, count}).
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { performHoleCSGInWorker } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import {
  geometryCache,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
  type CachedGeometry,
} from '@/stores/geometryCache';
import { buildHoleToolGeometry } from '../utils/buildHoleTool';
import type { HolePosition } from '../data/positions';

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

const EDGE_MARGIN_K = 1.0;

/**
 * LOCAL hole positions for one side. blankY is the world-Y of the blank's
 * CENTRE — used only to convert mountingHoles.holesHeight (which is "mm
 * above the rail") into a local Y offset.
 *
 *   localY = (railY + holesHeight) − (railY + height/2)
 *          = holesHeight − height/2
 *
 * So localY depends ONLY on (holesHeight, jawBlank.height) — never on
 * viseConfig. Z follows the same logic: pure jaw-face/spacing math.
 */
function localHolePositions(
  holesHeight:       number,
  jawHeight:         number,
  jawFace:           number,
  boltSize:          number,
  screwheadDiameter: number,
  spacing:           number,
  count:             number,
): HolePosition[] {
  const safeCount = Math.max(1, Math.floor(count));
  const safeSpacing = Math.max(0, spacing);

  // Clamp Y to keep the counterbore fully inside the blank.
  const counterboreR = screwheadDiameter / 2;
  const yMargin      = counterboreR + 1.0;
  const yMin         = -jawHeight / 2 + yMargin;
  const yMax         =  jawHeight / 2 - yMargin;
  const nominalLocalY = holesHeight - jawHeight / 2;
  const yCenter      = Math.max(yMin, Math.min(yMax, nominalLocalY));

  // Clamp Z to keep each bolt edge ≥ boltSize from the face edge.
  const zMargin = boltSize * EDGE_MARGIN_K;
  const zMax    =  jawFace / 2 - zMargin;
  const zMin    = -zMax;

  const out: HolePosition[] = [];
  for (let i = 0; i < safeCount; i++) {
    const offset = (i - (safeCount - 1) / 2) * safeSpacing;
    out.push({
      x: 0,                                      // LOCAL — blank centred at origin
      y: yCenter,
      z: Math.min(zMax, Math.max(zMin, offset)),
    });
  }
  return out;
}

async function drillSideLocal(
  cacheKeyOut:       string,
  sign:              -1 | 1,
  thickness:         number,
  height:            number,
  face:              number,
  boltSize:          number,
  screwheadDiameter: number,
  screwheadHeight:   number,
  holesHeight:       number,
  spacing:           number,
  count:             number,
): Promise<void> {
  // Blank centred at LOCAL origin — no world transform baked in.
  const baseGeo = new THREE.BoxGeometry(thickness, height, face);

  const positions = localHolePositions(
    holesHeight, height, face, boltSize, screwheadDiameter, spacing, count,
  );

  const tool = buildHoleToolGeometry(
    positions, sign, boltSize, screwheadDiameter, screwheadHeight, thickness,
  );
  if (!tool) {
    baseGeo.dispose();
    throw new Error('No mounting holes to drill (count = 0).');
  }

  const result = await performHoleCSGInWorker(baseGeo, tool);

  baseGeo.dispose();
  tool.dispose();

  if (!result) throw new Error('Hole CSG returned null.');

  geometryCache.set(cacheKeyOut, bufferGeometryToCached(result));
  result.dispose();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMountingHoles(): UseMountingHolesReturn {
  const [status, setStatus] = useState<MountingHolesStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  // Only SHAPE inputs — no viseConfig, no activePart, no clampGap. The cache
  // is position-independent now.
  const jawBlank            = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles       = useSoftJawsStore((s) => s.mountingHoles);
  const updateMountingHoles = useSoftJawsStore((s) => s.updateMountingHoles);

  const generate = useCallback(async () => {
    setStatus('running');
    setError(null);

    try {
      await Promise.all([
        drillSideLocal(
          JAW_HOLED_CACHE_KEY_LEFT,
          -1,
          jawBlank.thickness,
          jawBlank.height,
          jawBlank.face,
          mountingHoles.boltSize,
          mountingHoles.screwheadDiameter,
          mountingHoles.screwheadHeight,
          mountingHoles.holesHeight,
          mountingHoles.spacing,
          mountingHoles.count,
        ),
        drillSideLocal(
          JAW_HOLED_CACHE_KEY_RIGHT,
          1,
          jawBlank.thickness,
          jawBlank.height,
          jawBlank.face,
          mountingHoles.boltSize,
          mountingHoles.screwheadDiameter,
          mountingHoles.screwheadHeight,
          mountingHoles.holesHeight,
          mountingHoles.spacing,
          mountingHoles.count,
        ),
      ]);

      updateMountingHoles({ generated: true });
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [jawBlank, mountingHoles, updateMountingHoles]);

  return { status, error, generate };
}
