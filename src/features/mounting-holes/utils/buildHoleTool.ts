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
function buildLetterGeometry(char: string, w: number, h: number, s: number, d: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  
  const addBar = (x: number, y: number, bw: number, bh: number) => {
    const box = new THREE.BoxGeometry(bw, bh, d);
    box.translate(x + bw / 2, y + bh / 2, 0);
    parts.push(box);
  };

  switch (char) {
    case 'L':
      addBar(0, 0, s, h);
      addBar(0, 0, w, s);
      break;
    case 'E':
      addBar(0, 0, s, h);
      addBar(0, 0, w, s);
      addBar(0, (h - s) / 2, w * 0.8, s);
      addBar(0, h - s, w, s);
      break;
    case 'F':
      addBar(0, 0, s, h);
      addBar(0, (h - s) / 2, w * 0.8, s);
      addBar(0, h - s, w, s);
      break;
    case 'T':
      addBar((w - s) / 2, 0, s, h);
      addBar(0, h - s, w, s);
      break;
    case 'R':
      addBar(0, 0, s, h);
      addBar(0, h - s, w, s);
      addBar(w - s, h / 2, s, h / 2);
      addBar(0, h / 2, w, s);
      addBar(w - s, 0, s, h / 2);
      break;
    case 'I':
      addBar((w - s) / 2, 0, s, h);
      addBar(0, 0, w, s);
      addBar(0, h - s, w, s);
      break;
    case 'G':
      addBar(0, 0, s, h);
      addBar(0, 0, w, s);
      addBar(0, h - s, w, s);
      addBar(w - s, 0, s, h / 2 + s / 2);
      addBar(w / 2, h / 2 - s / 2, w / 2, s);
      break;
    case 'H':
      addBar(0, 0, s, h);
      addBar(w - s, 0, s, h);
      addBar(0, (h - s) / 2, w, s);
      break;
    default:
      addBar(0, 0, w, h);
      break;
  }

  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

function buildWordGeometry(
  text: string,
  w: number,
  h: number,
  s: number,
  d: number,
  spacing: number
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = text.length;
  const totalW = n * w + (n - 1) * spacing;
  
  for (let i = 0; i < n; i++) {
    const char = text[i];
    const letterGeo = buildLetterGeometry(char, w, h, s, d);
    const xPos = -totalW / 2 + i * (w + spacing);
    letterGeo.translate(xPos, 0, 0);
    parts.push(letterGeo);
  }
  
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

function buildLabelGeometry(
  text: string,
  thickness: number,
  height: number,
  face: number
): THREE.BufferGeometry {
  const letterH = Math.max(5, Math.min(8, height * 0.12, thickness * 0.12));
  const letterW = letterH * 0.7;
  const stroke = letterH * 0.18;
  const spacing = letterH * 0.2;
  const debossDepth = 1.0;
  const overshoot = 0.4;
  const totalDepth = debossDepth + overshoot;

  const label = buildWordGeometry(text, letterW, letterH, stroke, totalDepth, spacing);
  label.translate(0, -letterH / 2, 0);
  label.translate(0, 0, face / 2 - 0.3);
  return label;
}

export function buildHoleToolGeometry(
  positions:         HolePosition[],
  sign:              -1 | 1,
  boltSize:          number,
  screwheadDiameter: number,
  screwheadHeight:   number,
  thickness:         number,
  height:            number,
  face:              number,
): THREE.BufferGeometry | null {
  if (thickness <= 0 || height <= 0 || face <= 0) return null;

  const parts: THREE.BufferGeometry[] = [];

  // Generate debossed label "LEFT" or "RIGHT"
  const labelText = sign === -1 ? 'LEFT' : 'RIGHT';
  const labelGeo = buildLabelGeometry(labelText, thickness, height, face);
  parts.push(labelGeo);

  // If there are bolt holes, build and add them
  if (positions.length > 0 && boltSize > 0) {
    const throughR = boltSize / 2 + HOLE_CLEARANCE;
    const throughL = thickness + THROUGH_OVERSHOOT * 2;
    const cbDepth = Math.max(0, Math.min(screwheadHeight, thickness - 1));
    const cbR     = Math.max(0, screwheadDiameter / 2);
    const cbL     = cbDepth + THROUGH_OVERSHOOT;

    for (const p of positions) {
      if (cbDepth > 0 && cbR > throughR) {
        const points: THREE.Vector2[] = [];
        const totalL = thickness + THROUGH_OVERSHOOT * 2;
        points.push(new THREE.Vector2(0, -totalL / 2));
        points.push(new THREE.Vector2(throughR, -totalL / 2));
        points.push(new THREE.Vector2(throughR, totalL / 2 - cbL));
        points.push(new THREE.Vector2(cbR, totalL / 2 - cbL));
        points.push(new THREE.Vector2(cbR, totalL / 2));
        points.push(new THREE.Vector2(0, totalL / 2));

        const lathe = new THREE.LatheGeometry(points, CYL_SEGMENTS);
        lathe.rotateZ(Math.PI / 2);

        if (sign === -1) {
          lathe.rotateY(Math.PI);
        }

        lathe.translate(p.x, p.y, p.z);
        parts.push(lathe);
      } else {
        const through = new THREE.CylinderGeometry(throughR, throughR, throughL, CYL_SEGMENTS);
        through.rotateZ(Math.PI / 2);
        through.translate(p.x, p.y, p.z);
        parts.push(through);
      }
    }
  }

  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}
