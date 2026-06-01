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
 * computeWorldSpanY — world-space Y extent of a part after applying rotation.
 *
 * Uses the same OBB→AABB half-extent formula as computeWorldSpanX but
 * projects onto the world Y axis (rotation matrix second row).
 *
 * Used for rotation-aware vertical positioning so that rotating a tall
 * part (e.g. 90° Z) correctly recalculates the world-space height.
 */
export function computeWorldSpanY(part: ProcessedPart): number {
  const { min, max } = part.boundingBox;
  const rot = part.transform.rotation;

  const hw = (max[0] - min[0]) / 2;
  const hh = (max[1] - min[1]) / 2;
  const hd = (max[2] - min[2]) / 2;

  // Fast path — no rotation
  if (rot.x === 0 && rot.y === 0 && rot.z === 0) {
    return hh * 2;
  }

  // THREE.Matrix4.elements is column-major:
  //   m[1]=R10, m[5]=R11, m[9]=R12 (second row — projects onto world Y)
  const m = new THREE.Matrix4()
    .makeRotationFromEuler(
      new THREE.Euler(rot.x * DEG2RAD, rot.y * DEG2RAD, rot.z * DEG2RAD, 'XYZ'),
    )
    .elements;

  return (Math.abs(m[1]) * hw + Math.abs(m[5]) * hh + Math.abs(m[9]) * hd) * 2;
}

/**
 * Left L-bracket inner face X, tracking an imported part.
 */
export function leftBracketInnerX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   { left: { thickness: number }; right: { thickness: number } },
  activePart: ProcessedPart | null,
  profile:    { generated: boolean; depth: number; leftDepth: number; rightDepth: number },
  blankClearance: number = 0.1,
): number {
  const fixedInnerX = bracketInnerX(viseConfig);
  if (!activePart) return fixedInnerX;
  const worldWidth = computeWorldSpanX(activePart);

  if (profile.generated) {
    return Math.min(
      fixedInnerX,
      worldWidth / 2 - (profile.leftDepth - 0.05) + jawBlank.left.thickness
    );
  } else {
    // Design-time: Stationary carriage at default base thickness of 30.0 mm
    return Math.min(
      fixedInnerX,
      worldWidth / 2 + blankClearance + 30.0
    );
  }
}

/**
 * Left jaw blank's centre X — `leftBracketInnerX − leftThickness/2`.
 */
export function leftJawCenterX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   { left: { thickness: number }; right: { thickness: number } },
  activePart: ProcessedPart | null,
  profile:    { generated: boolean; depth: number; leftDepth: number; rightDepth: number },
  blankClearance: number = 0.1,
): number {
  return leftBracketInnerX(viseConfig, jawBlank, activePart, profile, blankClearance)
       - jawBlank.left.thickness / 2;
}

/**
 * Right L-bracket inner face X, tracking an imported part.
 */
export function rightBracketInnerX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   { left: { thickness: number }; right: { thickness: number } },
  activePart: ProcessedPart | null,
  profile:    { generated: boolean; depth: number; leftDepth: number; rightDepth: number },
  blankClearance: number = 0.1,
): number {
  const fixedInnerX = bracketInnerX(viseConfig);
  if (!activePart) return fixedInnerX;
  const worldWidth = computeWorldSpanX(activePart);

  if (profile.generated) {
    return Math.min(
      fixedInnerX,
      worldWidth / 2 - (profile.rightDepth - 0.05) + jawBlank.right.thickness
    );
  } else {
    // Design-time: Stationary carriage at default base thickness of 30.0 mm
    return Math.min(
      fixedInnerX,
      worldWidth / 2 + blankClearance + 30.0
    );
  }
}

/**
 * Right jaw blank's centre X — `rightBracketInnerX − rightThickness/2`.
 */
export function rightJawCenterX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  jawBlank:   { left: { thickness: number }; right: { thickness: number } },
  activePart: ProcessedPart | null,
  profile:    { generated: boolean; depth: number; leftDepth: number; rightDepth: number },
  blankClearance: number = 0.1,
): number {
  return rightBracketInnerX(viseConfig, jawBlank, activePart, profile, blankClearance)
       - jawBlank.right.thickness / 2;
}

/**
 * Centralized part snap X helper. Calculates the workpiece center coordinate.
 *
 * In this design, the workpiece center is locked at X = 0.
 */
export function partSnapX(
  viseConfig: Pick<ViseConfig, 'jawStroke'>,
  leftThickness: number,
  activePart: ProcessedPart | null,
  profile: { generated: boolean; depth: number; leftDepth: number; rightDepth: number },
  blankClearance: number = 0.1,
): number {
  return 0;
}

/** Rail gap constant — workpiece floats this far above the jaw rail. */
export const RAIL_GAP_MM = 0.2;
