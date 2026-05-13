/**
 * Vise geometry — single source of truth for the procedural CNC vise.
 *
 * The proportions in `VISE_GEOMETRY` are the ONLY place these magic numbers
 * live. Both the renderer (ViseModel.tsx via computeViseGeometry) and the
 * downstream consumers (JawBlankMesh, useJawProfile, CameraController via
 * the named helpers below) read from this object. Drift is impossible by
 * construction.
 *
 * The multi-preset catalog (Spreitzer / Roemheld / Kurt / Schunk / Glacern)
 * was removed; the product ships a single fully-customizable vise driven by
 * `viseConfig.{jawWidth, jawHeight, jawStroke}`. Defaults live in
 * softJawsStore's INITIAL_STATE.
 */

// ─── VISE_GEOMETRY — proportions (the only magic-number table) ────────────────

export const VISE_GEOMETRY = {
  // ─── Fixed bed / bracket dimensions ────────────────────────────────────────
  // These are HARDWARE constants — they describe the physical L-bracket and
  // the bed envelope. They MUST NOT scale with jawStroke or jawHeight, so
  // changing those user params only resizes what they're labelled to resize.
  RAIL_HEIGHT:    40,   // mm — bed/rail Y. jawBaseH() returns this verbatim.
  BR_FOOT_LEN:    30,   // mm — L-bracket foot X length (does not grow with stroke).
  BR_FOOT_H:       5,   // mm — L-bracket foot Y height (does not grow with vise height).
  BR_PILLAR_LEN:  30,   // mm — L-bracket pillar X thickness (does not grow with stroke).

  // ─── Body tier proportions (as fractions of RAIL_HEIGHT) ───────────────────
  // The two slabs split the fixed bed height; sum must equal 1.0.
  TIER1_H_FRAC:   0.25,
  TIER2_H_FRAC:   0.75,

  // jawWidth is the literal jaw-face Z width. All Z fracs at 1.00 so the
  // body and the L-bracket pillar share jawWidth exactly.
  TIER1_W_FRAC:   1.00,
  TIER2_W_FRAC:   1.00,
  TIER3_W_FRAC:   1.00,
  TIER3_LEN_FRAC: 1.00,   // internal — L-bracket X positioning; 1.0 = foot flush with body end

  // ─── Side mounting holes (decorative — middle tier ±Z faces) ───────────────
  SIDE_HOLE_R_FRAC:    0.18,
  SIDE_HOLE_COUNT:     5,
  SIDE_HOLE_Y_FRAC:    0.55,
  SIDE_HOLE_SPAN_FRAC: 0.84,
  SIDE_HOLE_INSET:     0.42,

  // End caps
  CAP_LEN_FRAC: 0.06,
  CAP_W_FRAC:   0.96,

  // Top countersunk SHCS on the pillar top face
  TOP_BOLT_DIA_FRAC_W: 0.14,
  TOP_BOLT_DIA_FRAC_H: 0.90,
  TOP_BOLT_XS_FRAC:    0.46,
  TOP_BOLT_ZS_FRAC:    0.28,

  // L-bracket Z (face-width) and Y (pillar height) fractions —
  // both at 1.00 so "Vise width" and "Vise height" UI params equal the
  // visible pillar dimensions exactly.
  BR_FOOT_W_FRAC:     1.00,
  BR_PILLAR_H_FRAC:   1.00,

  // Bolt-pattern fractions on the pillar face.
  BR_BOLT_ZS_FRAC:    0.30,
  // Bolt centreline Y — fixed offset (mm) from the bracket bottom (top of foot).
  // This is real-world vise hardware behaviour: the tapped-hole pattern on the
  // bracket is at a constant position regardless of which jaw stock is mounted
  // or how tall the pillar is. A fraction of jawHeight would put the bolts
  // higher and higher as the pillar grows — eventually outside the jaw blank
  // (the CSG cylinder then sits in mid-air, leaving a "dummy" pillar-only
  // decal and no through-hole). 30 mm sits comfortably above the workpiece
  // cavity zone for typical 50–80 mm jaws.
  BR_BOLT_Y_OFFSET:   30,
} as const;

// ─── Derived geometry ─────────────────────────────────────────────────────────

export interface ViseGeometry {
  // Envelope
  bodyLen: number;  bodyWidth: number;  bodyH: number;  railY: number;
  // Tiers (2-tier body — tier3 is internal only, not exposed)
  tier1H: number;   tier2H: number;
  tier1W: number;   tier2W: number;
  tier1Len: number; tier2Len: number;
  tier1Y: number;   tier2Y: number;
  // Side holes
  sideHoleR: number;
  sideHoleY: number;
  sideHoleXs: number[];
  // End caps
  capLen: number;   capH: number;       capW: number;     capCx: number;
  // Top bolts
  topBoltDia: number;
  topBoltXs:  [number, number];
  topBoltZs:  [number, number];
  capBoltZs:  [number, number];
  // L-brackets
  brFootH: number;     brFootLen: number;     brFootW: number;
  brPillarH: number;   brPillarLen: number;   brPillarW: number;
  brFootY: number;     brPillarY: number;
  brFootXOff: number;  brPillarXOff: number;
  brTopY: number;
  brBoltZs: [number, number];
}

/**
 * Compute the full derived geometry of the procedural vise from a
 * viseConfig. ViseModel.tsx calls this; helpers below derive single
 * dimensions for the cheaper consumers (jaw placement, CSG, camera fit).
 */
export function computeViseGeometry(
  viseConfig: { jawWidth: number; jawHeight: number; jawStroke: number },
): ViseGeometry {
  const { jawWidth, jawHeight, jawStroke } = viseConfig;
  const G = VISE_GEOMETRY;

  // bodyLen = stroke + two fixed L-bracket feet. With BR_FOOT_LEN now constant,
  // bodyLen grows linearly with jawStroke while the feet/pillars stay the same.
  const bodyLen   = jawStroke + 2 * G.BR_FOOT_LEN;
  const bodyWidth = jawWidth;
  // Rail / bed height is fixed — jawHeight no longer raises the bed.
  const railY     = G.RAIL_HEIGHT;
  const bodyH     = railY;

  const tier1H  = bodyH * G.TIER1_H_FRAC;
  const tier2H  = bodyH * G.TIER2_H_FRAC;

  const tier1W = bodyWidth * G.TIER1_W_FRAC;
  const tier2W = bodyWidth * G.TIER2_W_FRAC;
  const tier3W = bodyWidth * G.TIER3_W_FRAC;  // internal — drives pillar/foot Z width

  const tier1Len = bodyLen;
  const tier2Len = bodyLen;
  const tier3Len = bodyLen * G.TIER3_LEN_FRAC;  // internal — L-bracket X positioning

  const tier1Y = tier1H / 2;
  const tier2Y = tier1H + tier2H / 2;

  const sideHoleR = tier2H * G.SIDE_HOLE_R_FRAC;
  const sideHoleY = tier1H + tier2H * G.SIDE_HOLE_Y_FRAC;
  const sideHoleN = G.SIDE_HOLE_COUNT;
  const sideHoleXs = Array.from({ length: sideHoleN }, (_, i) => {
    const t = sideHoleN > 1 ? i / (sideHoleN - 1) : 0.5;
    return -bodyLen * G.SIDE_HOLE_INSET + t * bodyLen * G.SIDE_HOLE_SPAN_FRAC;
  });

  const capLen = bodyLen * G.CAP_LEN_FRAC;
  const capH   = tier1H + tier2H;
  const capW   = tier2W * G.CAP_W_FRAC;
  const capCx  = bodyLen / 2 + capLen / 2;

  const topBoltDia = Math.min(tier3W * G.TOP_BOLT_DIA_FRAC_W, G.BR_FOOT_H * G.TOP_BOLT_DIA_FRAC_H);
  const topBoltXs: [number, number] = [-tier3Len * G.TOP_BOLT_XS_FRAC, tier3Len * G.TOP_BOLT_XS_FRAC];
  const topBoltZs: [number, number] = [-tier3W   * G.TOP_BOLT_ZS_FRAC,  tier3W   * G.TOP_BOLT_ZS_FRAC];
  const capBoltZs: [number, number] = [-capW    * G.TOP_BOLT_ZS_FRAC,  capW    * G.TOP_BOLT_ZS_FRAC];

  // L-bracket dimensions — feet and pillar X are FIXED hardware constants now.
  // Only the pillar Y height tracks jawHeight (so "Vise height" stays literal).
  const brFootH      = G.BR_FOOT_H;
  const brFootLen    = G.BR_FOOT_LEN;
  const brFootW      = tier2W * G.BR_FOOT_W_FRAC;  // matches tier2 platform width
  const brPillarH    = jawHeight * G.BR_PILLAR_H_FRAC;
  const brPillarLen  = G.BR_PILLAR_LEN;
  const brPillarW    = brFootW;
  const brFootY      = bodyH + brFootH / 2;
  const brPillarY    = bodyH + brFootH + brPillarH / 2;
  const brFootXOff   = tier3Len / 2 - brFootLen / 2;
  const brPillarXOff = tier3Len / 2 - brFootLen + brPillarLen / 2;
  const brTopY       = bodyH + brFootH + brPillarH;
  const brBoltZs: [number, number] = [-brPillarW * G.BR_BOLT_ZS_FRAC, brPillarW * G.BR_BOLT_ZS_FRAC];

  return {
    bodyLen, bodyWidth, bodyH, railY,
    tier1H, tier2H,
    tier1W, tier2W,
    tier1Len, tier2Len,
    tier1Y, tier2Y,
    sideHoleR, sideHoleY, sideHoleXs,
    capLen, capH, capW, capCx,
    topBoltDia, topBoltXs, topBoltZs, capBoltZs,
    brFootH, brFootLen, brFootW,
    brPillarH, brPillarLen, brPillarW,
    brFootY, brPillarY,
    brFootXOff, brPillarXOff,
    brTopY, brBoltZs,
  };
}

// ─── Named single-dimension helpers (read from VISE_GEOMETRY) ─────────────────
// Used by JawBlankMesh / useJawProfile / CameraController to avoid pulling the
// full ViseGeometry table when only one or two values are needed.

/**
 * Y of the jaw rail surface (where blanks/parts rest).
 * Now a fixed value — bed height does not scale with jawHeight any more.
 * Param kept for backwards compatibility with existing callers; ignored.
 */
export function jawBaseH(_jawHeight?: number): number {
  return VISE_GEOMETRY.RAIL_HEIGHT;
}

/** Total body length along X — stroke plus two fixed L-bracket feet. */
export function viseBodyLen(viseConfig: { jawStroke: number }): number {
  return viseConfig.jawStroke + 2 * VISE_GEOMETRY.BR_FOOT_LEN;
}

/** L-bracket foot length along X — fixed hardware dimension. */
export function bracketFootLen(_viseConfig?: { jawStroke?: number }): number {
  return VISE_GEOMETRY.BR_FOOT_LEN;
}

/**
 * Inner X of the L-bracket pillar — soft-jaw outer face abuts here.
 * With foot length fixed, this collapses to `jawStroke / 2` exactly —
 * preserving the literal-precision invariant that `2 × bracketInnerX = jawStroke`.
 */
export function bracketInnerX(viseConfig: { jawStroke: number }): number {
  const tier3Len = viseBodyLen(viseConfig) * VISE_GEOMETRY.TIER3_LEN_FRAC;
  return tier3Len / 2 - VISE_GEOMETRY.BR_FOOT_LEN;
}

/** Z width of the L-bracket pillar — caps practical jaw face dimension. */
export function pillarFaceWidth(viseConfig: { jawWidth: number }): number {
  const tier2W = viseConfig.jawWidth * VISE_GEOMETRY.TIER2_W_FRAC;
  return tier2W * VISE_GEOMETRY.BR_FOOT_W_FRAC;
}

/**
 * Y of the mounting-bolt centreline — fixed offset above the bracket foot.
 *
 *   bracketBoltY = RAIL_HEIGHT + BR_FOOT_H + BR_BOLT_Y_OFFSET
 *
 * The value does NOT scale with `jawHeight`. Real bracket hardware has its
 * tapped-hole pattern at a constant position; a fraction of jawHeight would
 * push the bolt beyond the jaw blank's vertical extent on tall pillars and
 * leave the CSG cylinder cutting air. The param is kept optional for
 * API symmetry with the other helpers but is no longer read.
 */
export function bracketBoltY(_viseConfig?: { jawHeight?: number }): number {
  return VISE_GEOMETRY.RAIL_HEIGHT + VISE_GEOMETRY.BR_FOOT_H + VISE_GEOMETRY.BR_BOLT_Y_OFFSET;
}
