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
import type { ProcessedPart } from '@/stores/types';

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
