/**
 * Build the merged "hole tool" geometry for one side of the jaw blank.
 *
 * Pure function — given hole positions and dimensional parameters, returns a
 * BufferGeometry that `cad-core/performHoleCSGInWorker` subtracts from the
 * blank in one pass. No globals, no store reads, no DOM, no React.
 *
 * EACH HOLE IS ONE CLOSED SOLID OF REVOLUTION (a lathe-revolved profile),
 * not a merge of two overlapping cylinders. This is the canonical CAD way to
 * model a counterbored hole and the only shape three-bvh-csg can subtract
 * cleanly:
 *
 *   profile (radius r, axial x)              revolved 360° → tophat solid
 *
 *      r                                      ┌───────────┐  ← inner face (+overshoot)
 *      ▲          P4┌──────┐P5(axis)          │  counter  │
 *  cbR ┤      P3 ●──┘      │                   │   bore    │ counterboreDepth
 *      │         │ ledge   │                   ├───┬───┬───┤  ← step ledge
 *      │         │         │                   │   │   │   │
 *  thR ┤  P1 ●───┘P2       │                   │   │ d │   │  through-hole
 *      │     │             │                   │   │   │   │
 *    0 ┼──●──┴─────────────┴──► x              └───┴───┴───┘  ← outer face (+overshoot)
 *       P0(axis)
 *
 * Why a lathe profile, not two merged cylinders:
 *   • Two coaxial cylinders (through + counterbore) concatenated with
 *     mergeGeometries SELF-INTERSECT in the overlap region — the narrow
 *     cylinder's wall lies inside the wide one. three-bvh-csg's classifier
 *     can't decide inside/outside across that coincidence and emits a
 *     degenerate result (the counterbore renders as a flat disc / plain
 *     cylinder — exactly the reported symptom).
 *   • A single revolved profile is a watertight, manifold, non-self-
 *     intersecting solid with one clean 90° step. CSG resolves it exactly.
 *
 * CSG-correctness — overshoot on BOTH faces:
 *   The profile extends THROUGH_OVERSHOOT past the inner face (counterbore
 *   top) AND past the outer face (through-hole bottom). Without it the cutter
 *   end-caps would be coplanar with the blank faces, which three-bvh-csg
 *   leaves as a thin membrane. The pocket depth INTO the blank is still
 *   exactly counterboreDepth (the step sits counterboreDepth below the inner
 *   face regardless of overshoot).
 *
 * Parametric model (1:1 with the UI):
 *   holeDiameter        → through-hole / bolt-shank clearance Ø (cut exactly)
 *   counterboreDiameter → SHCS head recess Ø
 *   counterboreDepth    → recess depth into the inner face
 *   thickness           → jaw stock X extent (hole goes fully through)
 *
 * Positions are in LOCAL coords (blank centred at origin). `useMountingHoles`
 * translates the cached geometry to world space at render time.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HolePosition } from '../data/positions';

/** Cutter overshoot past each blank face (mm) — eliminates coplanar artifacts. */
const THROUGH_OVERSHOOT = 0.4;
/** Minimum material left between counterbore floor and the outer face (mm). */
const MIN_WALL = 1.0;
/** Radial segments per revolved hole — smooth at typical zoom. */
const CYL_SEGMENTS = 64;

/**
 * Produce a merged BufferGeometry of all bolt-hole cutters for one side.
 *
 * @param positions          Hole centerlines in LOCAL frame (blank at origin,
 *                           `x = 0` per hole; the through-axis is world X).
 * @param sign               −1 LEFT blank, +1 RIGHT blank. Determines which
 *                           face the counterbore recess opens onto (always the
 *                           inner / workpiece-facing face).
 * @param holeDiameter       Through-hole diameter, cut exactly (mm).
 * @param counterboreDiameter SHCS-head recess diameter (mm).
 * @param counterboreDepth   Recess depth into the inner face (mm).
 * @param thickness          Blank X extent — `jawBlank.thickness` (mm).
 * @returns Merged hole-cutter geometry, or `null` if nothing to cut.
 */
export function buildHoleToolGeometry(
  positions:            HolePosition[],
  sign:                 -1 | 1,
  holeDiameter:         number,
  counterboreDiameter:  number,
  counterboreDepth:     number,
  thickness:            number,
): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;
  if (holeDiameter <= 0 || thickness <= 0) return null;

  const throughR = holeDiameter / 2;
  const cbR      = counterboreDiameter / 2;
  // Clamp recess depth so a solid wall always remains behind it.
  const cbDepth  = Math.max(0, Math.min(counterboreDepth, thickness - MIN_WALL));
  const half     = thickness / 2;
  const O        = THROUGH_OVERSHOOT;

  // Whether this hole actually has a counterbore step.
  const stepped = cbDepth > 0 && cbR > throughR;

  const parts: THREE.BufferGeometry[] = [];

  for (const p of positions) {
    let holeGeo: THREE.BufferGeometry;

    if (stepped) {
      // Lathe profile (radius, axial). Counterbore at +axial end → after the
      // rotateZ below it lands on the inner face. Through-hole runs to the
      // −axial end (outer face). Both ends overshoot by O.
      const profile: THREE.Vector2[] = [
        new THREE.Vector2(0,        -half - O),       // P0 outer-face axis
        new THREE.Vector2(throughR, -half - O),       // P1 outer rim
        new THREE.Vector2(throughR,  half - cbDepth),  // P2 bore up to step
        new THREE.Vector2(cbR,       half - cbDepth),  // P3 step ledge (90°)
        new THREE.Vector2(cbR,       half + O),        // P4 counterbore wall
        new THREE.Vector2(0,         half + O),        // P5 inner-face axis
      ];
      holeGeo = new THREE.LatheGeometry(profile, CYL_SEGMENTS);
    } else {
      // No counterbore — plain through-hole, both ends overshooting.
      holeGeo = new THREE.CylinderGeometry(throughR, throughR, thickness + O * 2, CYL_SEGMENTS);
    }

    // Lathe/Cylinder axis is local +Y → rotate to world +X (clamping axis).
    holeGeo.rotateZ(Math.PI / 2);
    // After rotateZ, the counterbore (+axial) sits at −X. The RIGHT jaw's
    // inner face is −X, so sign=+1 is already correct; flip for the LEFT jaw.
    if (sign === -1) holeGeo.rotateY(Math.PI);

    holeGeo.translate(p.x, p.y, p.z);
    parts.push(holeGeo);
  }

  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}
