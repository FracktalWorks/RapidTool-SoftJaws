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

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Edges, Text } from '@react-three/drei';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';
import { rightJawCenterX } from '@/utils/partGeometry';

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

// ─── JawBlankMesh ────────────────────────────────────────────────────────────

const JAWS = [
  { sign: -1 as const, label: 'LEFT'  },
  { sign:  1 as const, label: 'RIGHT' },
];

export function JawBlankMesh() {
  const jawBlank        = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig      = useViseStore((s) => s.viseConfig);
  const clampGap        = useSoftJawsStore((s) => s.clampGap);
  const holesGenerated  = useSoftJawsStore((s) => s.mountingHoles.generated);
  const activePart      = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });
  const { face, height, thickness, material } = jawBlank;

  const leftHoledGeo = useMemo(() => {
    if (!holesGenerated) return null;
    const cached = geometryCache.get(JAW_HOLED_CACHE_KEY_LEFT);
    if (!cached) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals,   3));
    if (cached.indices) {
      geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
    }
    return geo;
  }, [holesGenerated]);

  const rightHoledGeo = useMemo(() => {
    if (!holesGenerated) return null;
    const cached = geometryCache.get(JAW_HOLED_CACHE_KEY_RIGHT);
    if (!cached) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals,   3));
    if (cached.indices) {
      geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
    }
    return geo;
  }, [holesGenerated]);

  // Clean up GPU memory for cached geometries
  useEffect(() => {
    return () => {
      leftHoledGeo?.dispose();
      rightHoledGeo?.dispose();
    };
  }, [leftHoledGeo, rightHoledGeo]);

  // Left jaw is fixed to the left L-bracket. Right jaw uses the shared
  // rightJawCenterX helper — same source of truth as ViseModel's bracket
  // carriage AND useJawProfile's CSG bake position. No drift possible.
  const { centerY, leftXOff, rightXOff, renderFace, labelSize } = useMemo(() => {
    const baseY     = jawBaseH(viseConfig.jawHeight);
    const innerX    = bracketInnerX(viseConfig);
    const maxFace   = pillarFaceWidth(viseConfig);
    const fixedXOff = innerX - thickness / 2;

    return {
      centerY:    baseY + height / 2,
      leftXOff:   fixedXOff,
      rightXOff:  rightJawCenterX(viseConfig, jawBlank, activePart, clampGap),
      renderFace: Math.min(face, maxFace * 0.98),
      labelSize:  height * 0.09,
    };
  }, [viseConfig, jawBlank, face, height, thickness, activePart, clampGap]);

  const color = MATERIAL_COLORS[material] ?? DEFAULT_BLANK_COLOR;

  return (
    <group>
      {JAWS.map(({ sign, label }) => {
        const xOffset = sign === -1 ? leftXOff : rightXOff;
        const x       = sign * xOffset;
        const halfFace = renderFace / 2;
        const labelEps = 0.08;
        const holedGeo = sign === -1 ? leftHoledGeo : rightHoledGeo;

        return (
          <group key={sign}>

            {holedGeo ? (
              /* Drilled blank — using CSG geometry with baked position */
              <mesh
                geometry={holedGeo}
                position={[0, 0, 0]}
                castShadow
                receiveShadow
                raycast={() => {}}
              >
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
                <Edges color="#08090c" lineWidth={1} threshold={35} />
              </mesh>
            ) : (
              /* Raw stock blank */
              <mesh
                position={[x, centerY, 0]}
                castShadow
                receiveShadow
                raycast={() => {}}
              >
                <boxGeometry args={[thickness, height, renderFace]} />
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
                <Edges color="#08090c" lineWidth={1} threshold={15} />
              </mesh>
            )}

            {/* ── Laser-etched ID label — top-outer corner of each ±Z face ── */}
            {[1, -1].map((zSide) => (
              <Text
                key={zSide}
                position={[
                  x,
                  centerY + height * 0.35,
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
