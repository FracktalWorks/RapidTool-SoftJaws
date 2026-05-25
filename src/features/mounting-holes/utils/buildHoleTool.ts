/**
 * Build the merged "hole tool" geometry for one side of the jaw blank.
 *
 * Pure function — given hole positions and dimensional parameters, returns a
 * BufferGeometry that `cad-core/performHoleCSGInWorker` subtracts from the
 * blank in one pass. No globals, no store reads, no DOM, no React.
 *
 * Each mounting bolt is modelled as a counterbore + through-hole pair:
 *
 *   ┌──────────────────────────── jaw blank (thickness `t`) ─────────────┐
 *   │                                                                    │
 *   │  inner face (workpiece side)                  outer face (bracket) │
 *   │       │                                              │             │
 *   │       │←─── counterbore (depth `h`) ───→             │             │
 *   │       │   diameter = screwheadDiameter               │             │
 *   │       │                                              │             │
 *   │       └───── through-hole — bolt shank ──────────────┘             │
 *   │             diameter = boltSize + 2·HOLE_CLEARANCE                 │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Positions are in LOCAL coords (relative to the blank centre at origin).
 * The hook callers (`useMountingHoles`) translate the cached geometry to
 * world space at render time.
 *
 * CSG-correctness notes:
 *   • Through-hole length = thickness + 2·THROUGH_OVERSHOOT, so the cylinder
 *     pokes 0.4 mm past BOTH faces.
 *   • Counterbore length  = screwheadHeight + THROUGH_OVERSHOOT, with the
 *     overshoot on the OUTER (inner-face) side only. Without this, the
 *     cutter's far face would be coplanar with the blank's inner face and
 *     three-bvh-csg's evaluator can't resolve coplanar coincidence — it
 *     leaves a thin membrane disc (the "plate" that made the counterbore
 *     look like a flat decoration instead of a real recess).
 *
 * Parametric model — what the caller controls vs what's fixed:
 *   parametric : boltSize, screwheadDiameter, screwheadHeight, thickness,
 *                positions, sign
 *   constants  : HOLE_CLEARANCE   (manufacturing radial slip fit for bolt)
 *                THROUGH_OVERSHOOT (CSG-epsilon — not a user-facing fit)
 *                CYL_SEGMENTS     (mesh tessellation, render quality)
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HolePosition } from '../data/positions';

// ── Manufacturing constants ─────────────────────────────────────────────────
/** Radial clearance per side around the bolt shank — typical slip fit. */
const HOLE_CLEARANCE = 0.2;

/** Counterbore diameter ÷ boltSize — exported so positions.ts can clamp
 *  Y using the SAME radius the CSG actually cuts (no drift). */
export const COUNTERBORE_DIA_K = 1.8;

// ── CSG / mesh constants ────────────────────────────────────────────────────
/** Cutter overshoot past the blank face — eliminates coplanar artifacts. */
const THROUGH_OVERSHOOT = 0.4;
/** Radial segments per cylinder — smooth at typical zoom levels. */
const CYL_SEGMENTS      = 48;

/**
 * Produce a merged BufferGeometry of all bolt-hole tools for one side.
 *
 * @param positions          Hole centerlines in LOCAL frame (blank at origin).
 *                           Pass `x=0` per hole — the X axis (through-direction)
 *                           is implicit from the blank's local center.
 * @param sign               −1 for the LEFT blank, +1 for the RIGHT blank.
 *                           Determines which X face the counterbore sits on
 *                           (the face nearest the workpiece, i.e. the side
 *                           opposite the L-bracket pillar).
 * @param boltSize           Nominal bolt diameter (mm).
 * @param screwheadDiameter  Counterbore diameter — the SHCS head clearance (mm).
 * @param screwheadHeight    Counterbore depth into the blank (mm). Clamped so
 *                           at least 1 mm of through-only material is left
 *                           between the counterbore floor and the outer face.
 * @param thickness          Blank X extent — `jawBlank.thickness` (mm).
 * @returns Merged hole-tool geometry, or `null` if `positions` is empty.
 */
export function buildHoleToolGeometry(
  positions:         HolePosition[],
  sign:              -1 | 1,
  boltSize:          number,
  screwheadDiameter: number,
  screwheadHeight:   number,
  thickness:         number,
): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;
  if (boltSize <= 0 || thickness <= 0) return null;

  // ── Through-hole — slip-fit cylinder, full thickness + epsilon both ends ─
  const throughR = boltSize / 2 + HOLE_CLEARANCE;
  const throughL = thickness + THROUGH_OVERSHOOT * 2;

  // ── Counterbore — clamp depth so we always leave >= 1 mm wall behind. ───
  // Without this, an over-deep screwhead would push the counterbore floor
  // past the OUTER face — creating a second coplanar artifact there.
  const cbDepth = Math.max(0, Math.min(screwheadHeight, thickness - 1));
  const cbR     = Math.max(0, screwheadDiameter / 2);
  const cbL     = cbDepth + THROUGH_OVERSHOOT;

  // ── Geometry of one cutter pair, in LOCAL coords ─────────────────────────
  //
  // sign=+1 (right blank):  inner face at  x = −thickness/2
  //                         counterbore goes  +X  into the blank
  //                         cylinder spans [−t/2 − OVERSHOOT, −t/2 + cbDepth]
  //
  // sign=−1 (left  blank):  inner face at  x = +thickness/2
  //                         counterbore goes  −X  into the blank
  //                         cylinder spans [+t/2 − cbDepth, +t/2 + OVERSHOOT]
  //
  // The overshoot is on the inner-face side ONLY (the side that would
  // otherwise be coplanar with the blank surface).
  const innerFaceX     = -sign * (thickness / 2);
  const cbCenterOffset = innerFaceX + sign * ((cbDepth - THROUGH_OVERSHOOT) / 2);

  const parts: THREE.BufferGeometry[] = [];

  for (const p of positions) {
    // Through-hole — centered at blank X centre, spans both faces.
    const through = new THREE.CylinderGeometry(throughR, throughR, throughL, CYL_SEGMENTS);
    through.rotateZ(Math.PI / 2);                // align cylinder axis to X
    through.translate(p.x, p.y, p.z);
    parts.push(through);

    // Counterbore — shifted to sit on the inner face, depth = cbDepth.
    if (cbDepth > 0 && cbR > 0) {
      const cb = new THREE.CylinderGeometry(cbR, cbR, cbL, CYL_SEGMENTS);
      cb.rotateZ(Math.PI / 2);
      cb.translate(p.x + cbCenterOffset, p.y, p.z);
      parts.push(cb);
    }
  }

  const merged = mergeGeometries(parts, false);
  // Per-cylinder buffers are now owned by `merged` — free the originals.
  for (const g of parts) g.dispose();
  return merged;
}
