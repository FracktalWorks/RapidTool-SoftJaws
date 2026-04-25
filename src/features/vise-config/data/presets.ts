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
  // Overall envelope
  BODY_LEN_K_WIDTH:     0.9,    // bodyLen   = jawStroke + jawWidth * K
  BODY_H_K_JAWHEIGHT:   0.55,   // bodyH = railY = jawHeight * K (= jawBaseH)

  // 2-tier stepped body (heights as fraction of bodyH)
  TIER1_H_FRAC:   0.25,   // bottom slab — full Z width
  TIER2_H_FRAC:   0.55,   // upper body — narrower Z (rendered as merged tier2+tier3)
  TIER3_H_FRAC:   0.20,   // internal-only — drives L-bracket foot height (not a rendered tier)
  TIER1_W_FRAC:   1.00,
  TIER2_W_FRAC:   0.85,
  TIER3_W_FRAC:   0.68,   // internal-only — drives pillar/foot Z width and pillarFaceWidth
  TIER3_LEN_FRAC: 1.00,   // internal-only — drives L-bracket X positioning (bracketInnerX); 1.0 = foot flush with body end

  // Side mounting holes (middle-tier ±Z faces)
  SIDE_HOLE_R_FRAC:    0.18,
  SIDE_HOLE_COUNT:     5,
  SIDE_HOLE_Y_FRAC:    0.55,
  SIDE_HOLE_SPAN_FRAC: 0.84,
  SIDE_HOLE_INSET:     0.42,

  // End caps
  CAP_LEN_FRAC: 0.06,
  CAP_W_FRAC:   0.96,

  // Top countersunk SHCS
  TOP_BOLT_DIA_FRAC_W: 0.14,
  TOP_BOLT_DIA_FRAC_H: 0.90,
  TOP_BOLT_XS_FRAC:    0.46,
  TOP_BOLT_ZS_FRAC:    0.28,

  // L-bracket fixed end-stops — chunkier proportions matching Trinckle's
  // hard-jaw stop blocks. Foot fills most of the platform height and the
  // pillar is substantially thicker along X for a real "stop block" feel.
  // BR_FOOT_LEN_FRAC is load-bearing (drives bracketInnerX → jaw position),
  // so don't change it without re-validating xOffset symmetry.
  BR_FOOT_H_FRAC:     0.85,
  BR_FOOT_LEN_FRAC:   0.11,
  BR_FOOT_W_FRAC:     0.96,
  BR_PILLAR_H_FRAC:   0.88,
  BR_PILLAR_LEN_FRAC: 0.10,
  BR_BOLT_ZS_FRAC:    0.30,
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

  const bodyLen   = jawStroke + jawWidth * G.BODY_LEN_K_WIDTH;
  const bodyWidth = jawWidth;
  const railY     = jawHeight * G.BODY_H_K_JAWHEIGHT;
  const bodyH     = railY;

  const tier3H  = bodyH * G.TIER3_H_FRAC;  // internal — foot height, not a rendered tier
  const tier1H  = bodyH * G.TIER1_H_FRAC;
  const tier2H  = bodyH * G.TIER2_H_FRAC + tier3H;  // absorbs tier3 into single upper slab

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

  const topBoltDia = Math.min(tier3W * G.TOP_BOLT_DIA_FRAC_W, tier3H * G.TOP_BOLT_DIA_FRAC_H);
  const topBoltXs: [number, number] = [-tier3Len * G.TOP_BOLT_XS_FRAC, tier3Len * G.TOP_BOLT_XS_FRAC];
  const topBoltZs: [number, number] = [-tier3W   * G.TOP_BOLT_ZS_FRAC,  tier3W   * G.TOP_BOLT_ZS_FRAC];
  const capBoltZs: [number, number] = [-capW    * G.TOP_BOLT_ZS_FRAC,  capW    * G.TOP_BOLT_ZS_FRAC];

  const brFootH      = tier3H   * G.BR_FOOT_H_FRAC;
  const brFootLen    = bodyLen  * G.BR_FOOT_LEN_FRAC;
  const brFootW      = tier2W   * G.BR_FOOT_W_FRAC;  // matches tier2 platform width
  const brPillarH    = jawHeight * G.BR_PILLAR_H_FRAC;
  const brPillarLen  = bodyLen  * G.BR_PILLAR_LEN_FRAC;
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

/** Y of the jaw rail surface (where blanks/parts rest). */
export function jawBaseH(jawHeight: number): number {
  return jawHeight * VISE_GEOMETRY.BODY_H_K_JAWHEIGHT;
}

/** Total body length along X. */
export function viseBodyLen(viseConfig: { jawWidth: number; jawStroke: number }): number {
  return viseConfig.jawStroke + viseConfig.jawWidth * VISE_GEOMETRY.BODY_LEN_K_WIDTH;
}

/** L-bracket foot length along X. */
export function bracketFootLen(viseConfig: { jawWidth: number; jawStroke: number }): number {
  return viseBodyLen(viseConfig) * VISE_GEOMETRY.BR_FOOT_LEN_FRAC;
}

/**
 * Inner X of the L-bracket pillar — soft-jaw outer face abuts here.
 * Pillar sits at the inner end of its foot, so
 *   pillarInner = tier3Len/2 − brFootLen.
 */
export function bracketInnerX(viseConfig: { jawWidth: number; jawStroke: number }): number {
  const tier3Len = viseBodyLen(viseConfig) * VISE_GEOMETRY.TIER3_LEN_FRAC;
  return tier3Len / 2 - bracketFootLen(viseConfig);
}

/** Z width of the L-bracket pillar — caps practical jaw face dimension. */
export function pillarFaceWidth(viseConfig: { jawWidth: number }): number {
  const tier2W = viseConfig.jawWidth * VISE_GEOMETRY.TIER2_W_FRAC;
  return tier2W * VISE_GEOMETRY.BR_FOOT_W_FRAC;
}

/**
 * Y of the L-bracket pillar's vertical mid-line — the canonical line that
 * mounting bolts pass through so they hit the pillar's exact center AND
 * stay well inside the jaw's vertical extent.
 */
export function bracketPillarCenterY(
  viseConfig: { jawHeight: number },
): number {
  const bodyH     = jawBaseH(viseConfig.jawHeight);
  const tier3H    = bodyH * VISE_GEOMETRY.TIER3_H_FRAC;
  const brFootH   = tier3H * VISE_GEOMETRY.BR_FOOT_H_FRAC;
  const brPillarH = viseConfig.jawHeight * VISE_GEOMETRY.BR_PILLAR_H_FRAC;
  return bodyH + brFootH + brPillarH / 2;
}
