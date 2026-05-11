/**
 * ViseModel — 2-tier staircase body + L-bracket end-stops.
 *
 * Cross-section (X–Y, looking from +Z):
 *
 *          ┌──┐                ┌──┐   ← L-bracket pillar  (brPillarH ≈ jawH)
 *          │  │                │  │
 *       ┌──┘  └──┐          ┌──┘  └──┐   ← L-bracket foot    (brFootH)
 * ┌─────┴────────┴──────────┴────────┴────--┐  tier 2 (narrower Z — TIER2_W_FRAC)
 * └─────────────────────────────────────────┘  tier 1 (full jawWidth)
 *
 * Tier 2 width steps inward in Z → staircase ledge visible from front/back.
 * TIER3_LEN/H/W fracs remain in presets.ts for internal L-bracket geometry only.
 *
 * All load-bearing helpers (bracketInnerX, jawBaseH, bracketBoltY…)
 * are untouched — xOffset coupling invariant preserved.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { computeViseGeometry, bracketInnerX } from '@/features/vise-config/data/presets';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';
import { computeWorldSpanX } from '@/utils/partGeometry';

// ─── Palette ─────────────────────────────────────────────────────────────────

const BODY      = '#b8bec6';   // base casting — tier 1 slab
const BODY_RAIL = '#d4dae2';   // ground/machined rail surface — tier 2 (brightest)
const FLANGE    = '#adb3bc';   // bottom mounting flange (unmachined underside)
const BRACKET   = '#c0c8d0';   // L-bracket foot + pillar
const SLOT_C    = '#32383f';   // center slide channel on rail top
const EDGE_C    = '#6e767e';
const HOLE_RG   = '#8a9298';   // chamfer ring around bed holes
const HOLE_BK   = '#06080c';   // drill bore
const SHCS_C    = '#28292e';   // SHCS head — black oxide finish
const SHCS_BK   = '#08090c';   // hex socket

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Box({
  pos, size, color,
  roughness = 0.40, metalness = 0.84,
}: {
  pos:       [number, number, number];
  size:      [number, number, number];
  color:     string;
  roughness?: number;
  metalness?: number;
}) {
  const geom = useMemo(
    () => new THREE.BoxGeometry(...size),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size[0], size[1], size[2]],
  );
  return (
    <mesh position={pos} geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
      <lineSegments renderOrder={1}>
        <edgesGeometry args={[geom]} />
        <lineBasicMaterial color={EDGE_C} transparent opacity={0.40} />
      </lineSegments>
    </mesh>
  );
}

// SHCS counterbore on pillar top — 3 layers create the illusion of a recessed hole:
//   chamfer ring (bright, at surface)  →  head disc (dark oxide, slightly lower)  →  hex socket (near-black, deepest)
function TopBolt({ x, y, z, r }: { x: number; y: number; z: number; r: number }) {
  const eps = 0.06;
  return (
    <group position={[x, y, z]}>
      {/* Chamfer ring — bright machined bevel at the hole opening, sits at surface level */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, eps, 0]}>
        <circleGeometry args={[r * 1.32, 40]} />
        <meshStandardMaterial color="#9aa2ac" roughness={0.22} metalness={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* SHCS cylindrical head — black oxide, slightly below surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, eps * 0.35, 0]}>
        <circleGeometry args={[r, 40]} />
        <meshStandardMaterial color={SHCS_C} roughness={0.28} metalness={0.94} side={THREE.DoubleSide} />
      </mesh>
      {/* Hex drive socket — innermost, near-black, reads as hole depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[r * 0.44, 6]} />
        <meshStandardMaterial color={SHCS_BK} roughness={0.82} metalness={0.20} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Tapped through-hole on pillar inner (workpiece-facing) face — coaxial with the
// jaw counterbore. r should be at bore scale (boltDia * 0.50) so chamR matches
// the jaw's through-bore, completing the visual fastener path.
function PillarTappedHole({
  x, y, z, r, sign,
}: { x: number; y: number; z: number; r: number; sign: 1 | -1 }) {
  const chamR = r * 1.15;  // slight chamfer ring around tapped bore entry
  const boreR = r * 0.72;  // tapped bore — slightly smaller than jaw bore
  const eps   = 0.06;
  const rotY  = sign === 1 ? -Math.PI / 2 : Math.PI / 2;
  return (
    <group position={[x - sign * eps, y, z]}>
      <mesh rotation={[0, rotY, 0]}>
        <circleGeometry args={[chamR, 40]} />
        <meshStandardMaterial color={HOLE_RG} roughness={0.28} metalness={0.90} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, rotY, 0]} position={[-sign * 0.01, 0, 0]}>
        <circleGeometry args={[boreR, 40]} />
        <meshStandardMaterial color={HOLE_BK} roughness={0.88} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// U-slot on flange ±Z faces — open to the bottom edge, represents T-slot bolt
// clearance. Shown as a dark rectangle with a bright machined rim, bottom-aligned
// so the slot visually breaks the lower edge of the flange.
function FlangeUSlot({ x, flangeHalfZ, slotW }: {
  x: number; flangeHalfZ: number; slotW: number;
}) {
  const slotH  = 1.8;           // visible height of the slot on the face
  const slotCY = -3 + slotH / 2; // bottom-aligned: slot bottom at Y = -3
  const eps    = 0.06;
  return (
    <>
      {([-1, 1] as const).map((zSide) => {
        const nudge = zSide * eps;
        return (
          <group key={zSide} position={[x, slotCY, zSide * flangeHalfZ + nudge]}>
            {/* Machined rim — bright border around slot opening */}
            <mesh>
              <planeGeometry args={[slotW + 2.0, slotH + 0.6]} />
              <meshStandardMaterial color={HOLE_RG} roughness={0.28} metalness={0.92} side={THREE.DoubleSide} />
            </mesh>
            {/* Slot void — dark interior, floated slightly toward viewer */}
            <mesh position={[0, 0, zSide * 0.01]}>
              <planeGeometry args={[slotW, slotH]} />
              <meshStandardMaterial color={HOLE_BK} roughness={0.90} metalness={0.10} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ─── ViseModel ───────────────────────────────────────────────────────────────

export function ViseModel() {
  const viseConfig     = useViseStore((s) => s.viseConfig);
  const jawBlank       = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles  = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap       = useSoftJawsStore((s) => s.clampGap);
  const activePart = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });
  const d = useMemo(() => computeViseGeometry(viseConfig), [viseConfig]);

  // Left L-bracket is ALWAYS fixed (the static jaw of a milling vise).
  // Right L-bracket carriage tracks the rotated world-space right edge of the
  // part — same formula consumed by JawBlankMesh so jaw + carriage move together.
  const leftInnerX = bracketInnerX(viseConfig);
  const rightInnerX = useMemo(() => {
    const fixedInnerX = bracketInnerX(viseConfig);
    if (!activePart) return fixedInnerX;
    const worldWidth    = computeWorldSpanX(activePart);
    const leftFaceX     = -fixedInnerX + jawBlank.thickness;
    const partRightEdge = leftFaceX + clampGap + worldWidth;
    return Math.min(fixedInnerX, partRightEdge + clampGap + jawBlank.thickness);
  }, [viseConfig, jawBlank.thickness, activePart, clampGap]);

  // Pillar face tapped-hole positions — same layout as jaw counterbores.
  const pillarHoles = useMemo(
    () => computeMountingHolePositions(viseConfig, jawBlank, mountingHoles),
    [viseConfig, jawBlank, mountingHoles],
  );
  // Match the visual bolt scale that JawBlankMesh uses so the decals are coaxial.
  const pillarBoltDia = Math.min(jawBlank.thickness * 0.30, jawBlank.face * 0.16);
  const pillarHoleR   = pillarBoltDia * 0.50;   // bore-level radius for tapped hole

  // Flange — bottom mounting lip with T-slot U-slots.
  const flangeHalfZ  = d.tier1W * 1.10 / 2;
  const flangeSlotW  = Math.min(12, d.tier1Len * 0.040);
  const flangeSlotXs = [
    -d.tier1Len * 0.36, -d.tier1Len * 0.13,
     d.tier1Len * 0.13,  d.tier1Len * 0.36,
  ] as const;

  // SHCS bolt positions on pillar top face.
  const boltR  = d.brPillarLen * 0.20;
  const boltZs = d.brBoltZs;

  // Top-inner chamfer size on each pillar.
  const CHAMFER_C = 1.5;

  return (
    <group>
      {/* ── Bottom flange — T-slot mounting base ──────────────────── */}
      <Box
        pos={[0, -1.5, 0]}
        size={[d.tier1Len, 3, flangeHalfZ * 2]}
        color={FLANGE}
        roughness={0.50}
        metalness={0.78}
      />
      {flangeSlotXs.map((hx, i) => (
        <FlangeUSlot key={i} x={hx} flangeHalfZ={flangeHalfZ} slotW={flangeSlotW} />
      ))}

      {/* ── 2-tier staircase body ──────────────────────────────────── */}
      {/* Tier 1 — base casting, full bodyLen, full jawWidth */}
      <Box
        pos={[0, d.tier1Y, 0]}
        size={[d.tier1Len, d.tier1H, d.tier1W]}
        color={BODY}
        roughness={0.42}
        metalness={0.82}
      />
      {/* Tier 2 — ground rail surface, narrower in Z, high metalness */}
      <Box
        pos={[0, d.tier2Y, 0]}
        size={[d.tier2Len, d.tier2H, d.tier2W]}
        color={BODY_RAIL}
        roughness={0.18}
        metalness={0.95}
      />
      {/* Center slide channel — dark strip on rail top (lead-screw/jaw slide slot) */}
      <Box
        pos={[0, d.bodyH + 0.08, 0]}
        size={[d.tier2Len, 0.16, d.tier2W * 0.18]}
        color={SLOT_C}
        roughness={0.50}
        metalness={0.72}
      />

      {/* ── L-brackets × 2 (Left Fixed, Right Movable) ────────────────── */}
      {([-1, 1] as const).map((sign) => {
        const innerFaceXAbs = sign === -1 ? leftInnerX : rightInnerX;
        
        // Foot and pillar sit flush on their inner face (abuts the jaw blank)
        const innerFaceX = sign * innerFaceXAbs;
        const pillarCX   = sign * (innerFaceXAbs + d.brPillarLen / 2);
        const footCX     = sign * (innerFaceXAbs + d.brFootLen  / 2);

        // 45° chamfer at the top-inner pillar edge — deburred machined finish.
        const chamferCX = innerFaceX + sign * (CHAMFER_C / 2);
        const chamferCY = d.brTopY - CHAMFER_C / 2;

        return (
          <group key={sign}>
            {/* Foot (horizontal leg, sits on rail top) */}
            <Box
              pos={[footCX, d.brFootY, 0]}
              size={[d.brFootLen, d.brFootH, d.brFootW]}
              color={BRACKET}
              roughness={0.32}
              metalness={0.88}
            />

            {/* Pillar (vertical leg — jaw blank's outer face abuts inner face) */}
            <Box
              pos={[pillarCX, d.brPillarY, 0]}
              size={[d.brPillarLen, d.brPillarH, d.brPillarW]}
              color={BRACKET}
              roughness={0.28}
              metalness={0.90}
            />

            {/* Top-inner 45° chamfer — same BRACKET colour, high metalness */}
            <mesh position={[chamferCX, chamferCY, 0]} rotation={[0, 0, -sign * Math.PI / 4]}>
              <boxGeometry args={[CHAMFER_C * Math.SQRT2, CHAMFER_C * Math.SQRT2, d.brPillarW * 0.98]} />
              <meshStandardMaterial color={BRACKET} roughness={0.20} metalness={0.95} />
            </mesh>

            {/* 2 SHCS on pillar top face — centered in X, spaced along Z */}
            {boltZs.map((bz) => (
              <TopBolt
                key={`${sign}_${bz}`}
                x={pillarCX}
                y={d.brTopY}
                z={bz}
                r={boltR}
              />
            ))}

            {/* Coaxial tapped-hole decals on pillar inner face — align with jaw counterbores */}
            {(sign === 1 ? pillarHoles.right : pillarHoles.left).map((hole) => (
              <PillarTappedHole
                key={`pt_${sign}_${hole.z}`}
                x={innerFaceX}
                y={hole.y}
                z={hole.z}
                r={pillarHoleR}
                sign={sign}
              />
            ))}
          </group>
        );
      })}

    </group>
  );
}
