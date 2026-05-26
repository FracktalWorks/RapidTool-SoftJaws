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
  jawBaseH,
} from '@/features/vise-config/data/presets';
import { rightJawCenterX } from '@/utils/partGeometry';
import type { ViseConfig, JawBlankConfig, MountingHolesConfig, ProcessedPart } from '@/stores/types';

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

/**
 * Compute world-space mounting-hole positions for both jaws.
 *
 * The right side's X tracks the part: when an imported workpiece pushes the
 * right L-bracket carriage inward, the right jaw moves with it, and so must
 * every hole position derived for that jaw. Single source of truth is
 * `rightJawCenterX(...)` — same helper consumed by `JawBlankMesh` (render),
 * `ViseModel` (bracket position), and `useJawProfile` (CSG bake).
 *
 * Callers must pass the live `activePart` (or `null` if no part is loaded)
 * and `clampGap` so the right-side X stays in sync with the rest of the
 * scene. The left side is fixed.
 */
export function computeMountingHolePositions(
  viseConfig:    Pick<ViseConfig, 'jawWidth' | 'jawHeight' | 'jawStroke'>,
  jawBlank:      JawBlankConfig,
  mountingHoles: Pick<MountingHolesConfig, 'count' | 'spacing' | 'boltSize' | 'holesHeight' | 'screwheadDiameter'>,
  activePart:    ProcessedPart | null,
  overlap:       number,
): PerSideHoles {
  const innerX       = bracketInnerX(viseConfig);
  // Right side tracks the part; left stays at the fixed max-stroke position.
  const xCenterRight = rightJawCenterX(viseConfig, jawBlank, activePart, overlap);
  const xCenterLeft  = innerX - jawBlank.left.thickness / 2;
  const jawBaseY     = jawBaseH(viseConfig.jawHeight);
  const nominalY     = jawBaseY + mountingHoles.holesHeight;

  const count   = Math.max(1, Math.floor(mountingHoles.count));
  const spacing = Math.max(0, mountingHoles.spacing);
  const boltDia = mountingHoles.boltSize;

  const minHeight = Math.min(jawBlank.left.height, jawBlank.right.height);
  const minFace = Math.min(jawBlank.left.face, jawBlank.right.face);

  // Clamp so the counterbore stays fully inside [jawBaseY, jawTopY].
  const jawTopY  = jawBaseY + minHeight;

  // Counterbore radius the CSG will actually cut, + 1 mm safety buffer.
  const counterboreR = mountingHoles.screwheadDiameter / 2;
  const yMargin      = counterboreR + 1.0;

  // Clamp Y centre to remain inside the jaw blank with full counterbore room.
  const yCenter = Math.max(
    jawBaseY + yMargin,
    Math.min(jawTopY - yMargin, nominalY),
  );

  // Z must fit within the jaw's own face width.
  const zExtent = minFace;
  const margin  = boltDia * EDGE_MARGIN_K;
  const zMax    =  zExtent / 2 - margin;
  const zMin    = -zMax;

  const zs: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spacing;
    zs.push(Math.min(zMax, Math.max(zMin, offset)));
  }

  // Right jaw tracks the part via xCenterRight; left stays fixed at -xCenterLeft.
  const right: HolePosition[] = zs.map((z) => ({ x:  xCenterRight, y: yCenter, z }));
  const left:  HolePosition[] = zs.map((z) => ({ x: -xCenterLeft,  y: yCenter, z }));

  return { left, right };
}
