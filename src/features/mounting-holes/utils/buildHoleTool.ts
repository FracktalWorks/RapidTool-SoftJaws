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
  const parts: THREE.BufferGeometry[] = [];

  for (const p of positions) {
    if (cbDepth > 0 && cbR > throughR) {
      // Create a stepped cylinder using LatheGeometry to avoid intersecting/overlapping geometry.
      // A self-intersecting cutter mesh (like nested cylinders) confuses three-bvh-csg,
      // leaving a solid core inside the counterbore. A lathe profile creates a single,
      // closed, manifold stepped cylinder with no internal faces.
      const points: THREE.Vector2[] = [];
      const totalL = thickness + THROUGH_OVERSHOOT * 2;

      // Profile in the X-Y plane (X is radius, Y is height along the axis).
      // We define points from bottom (Y = -totalL/2) to top (Y = totalL/2).
      // Since it goes bottom-to-top, LatheGeometry's normals point outwards.
      //
      // 1. Center of the through-hole exit cap
      points.push(new THREE.Vector2(0, -totalL / 2));
      // 2. Outer wall of the through-hole at the exit
      points.push(new THREE.Vector2(throughR, -totalL / 2));
      // 3. Inner corner of the counterbore shoulder (transition from through-hole)
      points.push(new THREE.Vector2(throughR, totalL / 2 - cbL));
      // 4. Outer corner of the counterbore shoulder (floor)
      points.push(new THREE.Vector2(cbR, totalL / 2 - cbL));
      // 5. Outer rim of the counterbore entrance
      points.push(new THREE.Vector2(cbR, totalL / 2));
      // 6. Center of the counterbore entrance cap
      points.push(new THREE.Vector2(0, totalL / 2));

      const lathe = new THREE.LatheGeometry(points, CYL_SEGMENTS);
      lathe.rotateZ(Math.PI / 2); // align Y axis to X axis

      if (sign === -1) {
        // Rotate 180 degrees around Y to flip the counterbore from negative X to positive X
        lathe.rotateY(Math.PI);
      }

      lathe.translate(p.x, p.y, p.z);
      parts.push(lathe);
    } else {
      // Straight through-hole only
      const through = new THREE.CylinderGeometry(throughR, throughR, throughL, CYL_SEGMENTS);
      through.rotateZ(Math.PI / 2);
      through.translate(p.x, p.y, p.z);
      parts.push(through);
    }
  }

  const merged = mergeGeometries(parts, false);
  // Per-part buffers are now owned by `merged` — free the originals.
  for (const g of parts) g.dispose();
  return merged;
}
