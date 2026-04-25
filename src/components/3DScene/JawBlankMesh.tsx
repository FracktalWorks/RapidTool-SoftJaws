/**
 * JawBlankMesh — Renders the TWO soft-jaw blanks bolted to the L-bracket
 * fixed end-stops on the vise.
 *
 * Each blank's outer face abuts the inner face of its corresponding L-bracket
 * pillar (positions match across ViseModel.tsx via shared helpers in
 * presets.ts: bracketInnerX, pillarFaceWidth). 2× horizontal countersunk
 * SHCS are inserted from the INNER face (workpiece side), pass through the
 * jaw, and thread out through the L-pillar — the bolt head reads on the
 * inner face, the exit decal sits on the back of the pillar (PillarBoltDecals).
 *
 * Axis mapping:
 *   jawBlank.thickness → X (clamping direction)
 *   jawBlank.height    → Y vertical
 *   jawBlank.face      → Z (along the jaw face) — visually capped at the
 *                        pillar Z width so the jaw never overhangs the
 *                        platform.
 *
 * Vertical "LEFT" / "RIGHT" labels on BOTH ±Z faces of each jaw, so the
 * orientation reads from any front/back orbit angle (the inner X-face label
 * was hidden inside the gap between jaws and only visible looking down it).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Text } from '@react-three/drei';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import {
  jawBaseH,
  bracketInnerX,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';

// Dark soft-jaw palette — reads as forged steel against the light vise body.
const MATERIAL_COLORS: Record<string, string> = {
  'aluminum-6061': '#3a4048',
  'aluminum-7075': '#2f353c',
  'steel-mild':    '#2a2f36',
  'steel-4140':    '#22272e',
  'brass':         '#a07b2a',
  'nylon':         '#7a6238',
};

const DEFAULT_BLANK_COLOR = '#353a42';

const LABEL_COLOR = '#cfd2d7';  // light grey text against dark jaw

// ─── SHCS Counterbore on inner jaw face ──────────────────────────────────────
// Bolt is inserted head-first from the workpiece side, so the inner face shows
// the bolt-head view. Four concentric layers build the depth illusion:
//
//   Layer 1 — Bright machined rim   (widest)  → polished counterbore wall
//   Layer 2 — Dark cavity floor     (ring)    → shadowed recess behind rim
//   Layer 3 — SHCS cylindrical head (disc)    → black oxide bolt head
//   Layer 4 — Hex key socket        (6-sided) → Allen drive recess (innermost)
//
// Each layer is offset sign*Δ toward the viewer so deeper layers render in front.

function SideBolt({
  x, y, z, dia, sign,
}: { x: number; y: number; z: number; dia: number; sign: 1 | -1 }) {
  const cboreR = dia * 0.90;  // counterbore opening (bright machined face)
  const floorR = dia * 0.80;  // floor disc — dark ring between rim & head visible
  const headR  = dia * 0.68;  // SHCS cylindrical head fills most of the pocket
  const hexR   = dia * 0.28;  // hex key socket (M6/M8 scale)
  const eps    = 0.05;
  const yRot   = sign === 1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[x + sign * eps, y, z]}>
      {/* Layer 1 — Machined counterbore rim: bright ground surface */}
      <mesh rotation={[0, yRot, 0]}>
        <circleGeometry args={[cboreR, 48]} />
        <meshStandardMaterial color="#9aa2a8" roughness={0.18} metalness={0.96} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 2 — Cavity floor: dark annular ring, sells the pocket depth */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.010, 0, 0]}>
        <circleGeometry args={[floorR, 48]} />
        <meshStandardMaterial color="#12151a" roughness={0.75} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 3 — SHCS head: black oxide cylindrical head, dominant element */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.020, 0, 0]}>
        <circleGeometry args={[headR, 48]} />
        <meshStandardMaterial color="#28292e" roughness={0.28} metalness={0.94} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 4 — Hex socket: 6-sided Allen drive recess, near-black */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.030, 0, 0]}>
        <circleGeometry args={[hexR, 6]} />
        <meshStandardMaterial color="#06080c" roughness={0.90} metalness={0.10} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Outer-face clearance bore ───────────────────────────────────────────────
// Bolt shank exits the outer (pillar-abutting) face of the jaw before threading
// into the L-pillar. Two layers: bright chamfer ring + dark bore passage.

function OuterBore({
  x, y, z, r, sign,
}: { x: number; y: number; z: number; r: number; sign: 1 | -1 }) {
  const ringR = r * 1.20;  // chamfer ring at the hole exit
  const boreR = r * 0.82;  // clearance bore — slightly larger than bolt shank
  const eps   = 0.05;
  const yRot  = sign * Math.PI / 2;  // outer face normal: +X for right, -X for left

  return (
    <group position={[x + sign * eps, y, z]}>
      <mesh rotation={[0, yRot, 0]}>
        <circleGeometry args={[ringR, 40]} />
        <meshStandardMaterial color="#8a9298" roughness={0.28} metalness={0.90} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.01, 0, 0]}>
        <circleGeometry args={[boreR, 40]} />
        <meshStandardMaterial color="#06080c" roughness={0.88} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── JawBlankMesh ────────────────────────────────────────────────────────────

const JAWS = [
  { sign: -1 as const, label: 'LEFT'  },
  { sign:  1 as const, label: 'RIGHT' },
];

export function JawBlankMesh() {
  const jawBlank         = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig       = useSoftJawsStore((s) => s.viseConfig);
  const mountingHoles    = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap         = useSoftJawsStore((s) => s.clampGap);
  const activePartBbox   = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id)?.boundingBox ?? null) : null;
  });
  const { face, height, thickness, material } = jawBlank;

  const { centerY, leftXOff, rightXOff, boltDia, boltZs, holesY, renderFace, labelSize } = useMemo(() => {
    const baseY   = jawBaseH(viseConfig.jawHeight);
    const innerX  = bracketInnerX(viseConfig);
    const maxFace = pillarFaceWidth(viseConfig);
    const rFace   = Math.min(face, maxFace * 0.98);

    const dia = Math.min(thickness * 0.30, rFace * 0.16);

    const positions = computeMountingHolePositions(viseConfig, jawBlank, mountingHoles);
    const zs        = positions.right.map((p) => p.z);
    const yCenter   = positions.right[0]?.y ?? baseY + height / 2;

    const fixedXOff = innerX - thickness / 2;
    const rXOff = activePartBbox
      ? Math.min(
          fixedXOff,
          (activePartBbox.max[0] - activePartBbox.min[0]) / 2 + clampGap + thickness / 2,
        )
      : fixedXOff;

    return {
      centerY:    baseY + height / 2,
      leftXOff:   fixedXOff,
      rightXOff:  rXOff,
      boltDia:    dia,
      boltZs:     zs,
      holesY:     yCenter,
      renderFace: rFace,
      labelSize:  height * 0.09,
    };
  }, [viseConfig, jawBlank, mountingHoles, face, height, thickness, activePartBbox, clampGap]);

  const color = MATERIAL_COLORS[material] ?? DEFAULT_BLANK_COLOR;

  return (
    <group>
      {JAWS.map(({ sign, label }) => {
        const xOffset  = sign === -1 ? leftXOff : rightXOff;
        const x        = sign * xOffset;
        const innerX   = x - sign * (thickness / 2);   // workpiece-facing X
        const halfFace = renderFace / 2;
        const labelEps = 0.08;
        const boltSign = (-sign) as 1 | -1;            // bolt head faces inward
        return (
          <group key={sign}>
            {/* Soft-jaw block — dark forged-steel look */}
            <mesh position={[x, centerY, 0]} castShadow receiveShadow>
              <boxGeometry args={[thickness, height, renderFace]} />
              <meshStandardMaterial
                color={color}
                roughness={0.90}
                metalness={0.30}
              />
              <Edges color="#08090c" lineWidth={1} threshold={15} />
            </mesh>

            {/* Counterbored SHCS on INNER face (workpiece side) */}
            {boltZs.map((bz) => (
              <SideBolt
                key={bz}
                x={innerX}
                y={holesY}
                z={bz}
                dia={boltDia}
                sign={boltSign}
              />
            ))}

            {/* Clearance bore exit on OUTER face — bolt shank emerges here
                before threading into the L-pillar. */}
            {boltZs.map((bz) => (
              <OuterBore
                key={`ob_${bz}`}
                x={x + sign * (thickness / 2)}
                y={holesY}
                z={bz}
                r={boltDia * 0.50}
                sign={sign}
              />
            ))}

            {/* Small laser-etched ID label — top-outer corner of each ±Z face */}
            {[1, -1].map((zSide) => (
              <Text
                key={zSide}
                position={[
                  x,
                  centerY + height * 0.35,          // near top edge
                  zSide * (halfFace + labelEps),
                ]}
                rotation={[0, zSide === -1 ? Math.PI : 0, 0]}
                fontSize={labelSize}
                color={LABEL_COLOR}
                anchorX="center"
                anchorY="middle"
                outlineWidth={labelSize * 0.06}
                outlineColor="#000000"
                outlineOpacity={0.6}
              >
                {label}
              </Text>
            ))}
          </group>
        );
      })}
    </group>
  );
}
