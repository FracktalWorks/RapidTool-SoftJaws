/**
 * computeWorldSpanX — world-space X extent of a part after applying rotation.
 *
 * Uses the OBB→AABB half-extent formula:
 *   worldHalfX = |R[0][0]|·hw + |R[0][1]|·hh + |R[0][2]|·hd
 *
 * This is equivalent to brute-forcing 8 corners but avoids allocations.
 * Result is used for jaw blank positioning and CSG blank baking so all three
 * consumers (JawBlankMesh, PartMeshes snapX, useJawProfile) stay consistent.
 */

import * as THREE from 'three';
import type { ProcessedPart, ViseConfig, JawBlankConfig } from '@/stores/types';
import { bracketInnerX } from '@/features/vise-config/data/presets';

const DEG2RAD = Math.PI / 180;

export function computeWorldSpanX(part: ProcessedPart): number {
  const { min, max } = part.boundingBox;
  const rot = part.transform.rotation;

  const hw = (max[0] - min[0]) / 2;
  const hh = (max[1] - min[1]) / 2;
  const hd = (max[2] - min[2]) / 2;

  // Fast path — no rotation, avoid matrix allocation
  if (rot.x === 0 && rot.y === 0 && rot.z === 0) {
    return hw * 2;
  }

  // THREE.Matrix4.elements is column-major:
  //   m[0]=R00, m[4]=R01, m[8]=R02 (first row — projects onto world X)
  const m = new THREE.Matrix4()
    .makeRotationFromEuler(
      new THREE.Euler(rot.x * DEG2RAD, rot.y * DEG2RAD, rot.z * DEG2RAD, 'XYZ'),
    )
    .elements;

  return (Math.abs(m[0]) * hw + Math.abs(m[4]) * hh + Math.abs(m[8]) * hd) * 2;
}

/**
 * Right L-bracket inner face X, tracking an imported part.
 *
 * When no part is loaded → returns the fixed `bracketInnerX(viseConfig)`
 * (maximum stroke position).
 *
 * When a part is loaded → the right bracket carriage moves inward to clamp
 * the part's right edge plus `clampGap + jawBlank.thickness` of jaw stock.
 * Capped at the fixed position so it never exceeds the max stroke.
 *
 * Single source of truth shared by ViseModel (renders the moved bracket),
 * PillarBoltDecals (renders bolt-exit decals on the moved bracket's back
 * face), and any future consumer that needs the right bracket position.
 */
export function rightBracketInnerX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   Pick<JawBlankConfig, 'thickness'>,
  activePart: ProcessedPart | null,
  clampGap:   number,
): number {
  const fixedInnerX = bracketInnerX(viseConfig);
  if (!activePart) return fixedInnerX;
  const worldWidth    = computeWorldSpanX(activePart);
  const leftFaceX     = -fixedInnerX + jawBlank.thickness;
  const partRightEdge = leftFaceX + clampGap + worldWidth;
  return Math.min(fixedInnerX, partRightEdge + clampGap + jawBlank.thickness);
}

/**
 * Right jaw blank's centre X — `rightBracketInnerX − thickness/2`.
 *
 * Used by JawBlankMesh (render position of the right blank) AND by
 * useJawProfile (where to bake the CSG blank). Single source of truth →
 * the rendered jaw and the cut profile can never drift apart.
 */
export function rightJawCenterX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   Pick<JawBlankConfig, 'thickness'>,
  activePart: ProcessedPart | null,
  clampGap:   number,
): number {
  return rightBracketInnerX(viseConfig, jawBlank, activePart, clampGap)
       - jawBlank.thickness / 2;
}

/**
 * Effective clampGap for RENDER-TIME positioning when the vise is "closed".
 *
 * After the CSG runs (`profile.generated === true`) the user expects the
 * physical-vise grip behaviour: jaws close on the workpiece so each side of
 * the part nests `(depth − safety) mm` into its corresponding pocket. We
 * achieve this with a SINGLE substitution — replace the design clampGap
 * (positive air-gap before clamping) with a NEGATIVE effective gap of
 * `−(depth − safety)` in every render-time call to `rightJawCenterX`,
 * `rightBracketInnerX`, and `snapX`.
 *
 * The math (verify on paper):
 *   workpiece shifts LEFT by  `depth − safety + designClampGap`
 *   right jaw shifts LEFT by  `2·(depth − safety + designClampGap)`
 * Both sides of the workpiece end up exactly `(depth − safety) mm` inside
 * their pockets — i.e. `safety` mm of clearance from each cavity back wall.
 *
 * IMPORTANT: this is RENDER-ONLY. The CSG pipeline (`useJawProfile`) MUST
 * always use the DESIGN clampGap so the baked cavity matches the workpiece
 * silhouette as it was when "Generate Profile" was clicked. The cavity
 * geometry is in world coordinates; this helper shifts the rendered
 * positions to align the world-baked cavity with the workpiece's new
 * (clamped) world position.
 */
const POST_CLAMP_SAFETY_MM = 0.05;

export function effectiveClampGap(
  designClampGap: number,
  profile: { generated: boolean; depth: number },
): number {
  if (profile.generated && profile.depth > POST_CLAMP_SAFETY_MM) {
    return -(profile.depth - POST_CLAMP_SAFETY_MM);
  }
  return designClampGap;
}
