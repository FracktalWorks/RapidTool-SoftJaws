/**
 * Mounting-hole position helper.
 *
 * Given the vise / blank / mounting-holes config, returns world-space (x, y, z)
 * for each bolt hole on each blank. Holes pass along the X axis (clamping
 * direction) — the bolt is inserted from the INNER face of the soft jaw and
 * threads outward through the L-pillar.
 *
 * Layout:
 *   - X : jaw center (signed per side)
 *   - Y : single value — the L-pillar's vertical mid-line. Putting holes
 *         here guarantees they pass through both the jaw AND the pillar at
 *         the pillar's exact center.
 *   - Z : spread horizontally along the jaw face by `spacing` (distance
 *         between consecutive bolt centerlines).
 *           count=1 → z = 0
 *           count=2 → z = ±spacing/2
 *           count=N → z = (i − (N−1)/2) * spacing
 *
 * Z is clamped so each hole edge stays at least one bolt-diameter inside
 * the jaw face AND inside the pillar's Z width (whichever is narrower).
 */

import {
  bracketInnerX,
  bracketPillarCenterY,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';
import type { ViseConfig, JawBlankConfig, MountingHolesConfig } from '@/stores/types';

export interface HolePosition {
  /** World X (signed, ± per side). */
  x: number;
  /** World Y (height of bolt centerline — = L-pillar mid-Y). */
  y: number;
  /** World Z (signed offset along the jaw face). */
  z: number;
}

export interface PerSideHoles {
  left:  HolePosition[];
  right: HolePosition[];
}

const EDGE_MARGIN_K = 1.0;  // hole edge must clear face/pillar edge by ≥ 1× bolt dia

export function computeMountingHolePositions(
  viseConfig:    Pick<ViseConfig, 'jawWidth' | 'jawHeight' | 'jawStroke'>,
  jawBlank:      Pick<JawBlankConfig, 'thickness' | 'face'>,
  mountingHoles: Pick<MountingHolesConfig, 'count' | 'spacing' | 'boltSize'>,
): PerSideHoles {
  const innerX       = bracketInnerX(viseConfig);
  const xCenterRight = innerX - jawBlank.thickness / 2;
  const yCenter      = bracketPillarCenterY(viseConfig);

  const count   = Math.max(1, Math.floor(mountingHoles.count));
  const spacing = Math.max(0, mountingHoles.spacing);
  const boltDia = mountingHoles.boltSize;

  // Z must fit within the narrower of (jaw face) and (pillar Z width) so the
  // hole emerges cleanly through both pieces.
  const zExtent = Math.min(jawBlank.face, pillarFaceWidth(viseConfig));
  const margin  = boltDia * EDGE_MARGIN_K;
  const zMax    =  zExtent / 2 - margin;
  const zMin    = -zMax;

  const zs: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    zs.push(Math.min(zMax, Math.max(zMin, offset)));
  }

  const right: HolePosition[] = zs.map((z) => ({ x:  xCenterRight, y: yCenter, z }));
  const left:  HolePosition[] = zs.map((z) => ({ x: -xCenterRight, y: yCenter, z }));

  return { left, right };
}
