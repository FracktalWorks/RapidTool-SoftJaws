  /**
 * Build the merged "hole tool" geometry for one side of the jaw blank.
 *
 * Each mounting bolt produces a counterbore + through-hole pair:
 *   - Through-hole : narrow cylinder (boltDia/2 + clearance), spans the full
 *                    blank thickness along ±X.
 *   - Counterbore  : wider, shorter cylinder on the INNER face (workpiece
 *                    side) for the SHCS head (~1.8× bolt dia, ~0.7× bolt
 *                    dia deep). The bolt is inserted from inside the jaws
 *                    and threads outward through the L-pillar — matches
 *                    the user's reference soft-jaw mounting style.
 *
 * Both cylinders are oriented along X (rotated from THREE's default Y axis),
 * positioned in WORLD coords, then merged into a single BufferGeometry that
 * cad-core's `performHoleCSGInWorker` subtracts from the blank in one pass.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HolePosition } from '../data/positions';

const HOLE_CLEARANCE      = 0.2;   // mm — clearance per side around bolt shank
const COUNTERBORE_DIA_K   = 1.8;   // counterbore dia = K * boltDia
const COUNTERBORE_DEPTH_K = 0.7;   // counterbore depth = K * boltDia
const THROUGH_OVERSHOOT   = 0.4;   // mm — extends past both faces to guarantee a clean cut
const CYL_SEGMENTS        = 48;    // radial segments per cylinder — smooth at close zoom

/**
 * Produces a merged geometry of all bolt-hole tools for one side.
 *
 * @param positions     World-space hole centerlines for this side.
 * @param sign          -1 for the left blank, +1 for the right blank.
 *                      Determines which X face the counterbore sits on.
 * @param boltSize      Nominal bolt diameter (mm) — `mountingHoles.boltSize`.
 * @param thickness     Blank X extent — `jawBlank.thickness`.
 */
export function buildHoleToolGeometry(
  positions: HolePosition[],
  sign:      -1 | 1,
  boltSize:  number,
  thickness: number,
): THREE.BufferGeometry | null {
  if (positions.length === 0) return null;

  const throughR = boltSize / 2 + HOLE_CLEARANCE;
  const throughL = thickness + THROUGH_OVERSHOOT * 2;
  const cbR      = (boltSize * COUNTERBORE_DIA_K) / 2;
  const cbL      = boltSize * COUNTERBORE_DEPTH_K;

  // Inner-face X for each blank (workpiece side) — counterbore center sits
  // cbL/2 inboard of the inner face so its rim is flush with that face.
  // sign=+1 (right blank): inner face at -thickness/2, counterbore extends
  // toward +X (into the jaw body).
  const innerFaceOffset = -sign * (thickness / 2);
  const cbCenterOffset  = innerFaceOffset + sign * (cbL / 2);

  const parts: THREE.BufferGeometry[] = [];

  for (const p of positions) {
    // Through-hole — full thickness, centered at jaw center X.
    const through = new THREE.CylinderGeometry(throughR, throughR, throughL, CYL_SEGMENTS);
    through.rotateZ(Math.PI / 2);                         // align cylinder axis to X
    through.translate(p.x, p.y, p.z);
    parts.push(through);

    // Counterbore — short, wide, on the INNER face (visible from workpiece side).
    const cb = new THREE.CylinderGeometry(cbR, cbR, cbL, CYL_SEGMENTS);
    cb.rotateZ(Math.PI / 2);
    cb.translate(p.x + cbCenterOffset, p.y, p.z);
    parts.push(cb);
  }

  const merged = mergeGeometries(parts, false);
  // Free the per-cylinder buffers — merged owns its own copy.
  for (const g of parts) g.dispose();
  return merged;
}
