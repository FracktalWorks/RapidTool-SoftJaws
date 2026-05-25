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

  // Build a CACHED BufferGeometry from the holed-blank cache entry.
  //
  // Safety:
  //   • Bail out if positions Float32Array is missing or empty — a
  //     half-populated cache (e.g. mid auto-drill) would otherwise produce
  //     a BufferGeometry with a count-0 position attribute, which crashes
  //     drei's <Edges> during EdgesGeometry construction.
  //   • Returns null on any invariant violation so the render falls back
  //     to the raw boxGeometry branch.
  function buildHoledGeometry(cacheKey: string): THREE.BufferGeometry | null {
    const cached = geometryCache.get(cacheKey);
    if (!cached) return null;
    if (!cached.positions || cached.positions.length === 0) return null;
    if (cached.positions.length % 9 !== 0 && !cached.indices) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
    if (cached.normals && cached.normals.length === cached.positions.length) {
      geo.setAttribute('normal', new THREE.BufferAttribute(cached.normals, 3));
    } else {
      // Fallback — make sure we never hand drei a geometry without normals.
      geo.computeVertexNormals();
    }
    if (cached.indices && cached.indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
    }
    return geo;
  }

  const leftHoledGeo = useMemo(
    () => (holesGenerated ? buildHoledGeometry(JAW_HOLED_CACHE_KEY_LEFT)  : null),
    [holesGenerated],
  );
  const rightHoledGeo = useMemo(
    () => (holesGenerated ? buildHoledGeometry(JAW_HOLED_CACHE_KEY_RIGHT) : null),
    [holesGenerated],
  );

  // Per-geometry dispose effects.  The previous shared effect disposed BOTH
  // geometries whenever EITHER changed — fine today because they're driven
  // by the same `holesGenerated` flag, but a foundational lifecycle bug
  // waiting for a side-by-side regeneration to trigger a use-after-dispose.
  useEffect(() => {
    return () => { leftHoledGeo?.dispose(); };
  }, [leftHoledGeo]);
  useEffect(() => {
    return () => { rightHoledGeo?.dispose(); };
  }, [rightHoledGeo]);

  // Left jaw is fixed to the left L-bracket. Right jaw uses the shared
  // rightJawCenterX helper — same source of truth as ViseModel's bracket
  // carriage AND useJawProfile's CSG bake position. No drift possible.
  const { centerY, leftXOff, rightXOff, renderFace, labelSize } = useMemo(() => {
    const baseY     = jawBaseH(viseConfig.jawHeight);
    const innerX    = bracketInnerX(viseConfig);
    const fixedXOff = innerX - thickness / 2;

    return {
      centerY:    baseY + height / 2,
      leftXOff:   fixedXOff,
      rightXOff:  rightJawCenterX(viseConfig, jawBlank, activePart, clampGap),
      // Jaw face uses the user's jawBlank.face directly — does NOT clamp to
      // pillarFaceWidth(viseConfig). The jaw blank is a separate piece of
      // stock from the vise; changing vise jawWidth/jawHeight/jawStroke
      // should not silently resize the jaw. If `face` exceeds the bracket
      // pillar width, the jaw overhangs visibly — that's the correct cue
      // for the user to either widen the vise or narrow the jaw stock.
      renderFace: face,
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
              /*
               * Drilled blank — geometry is now cached in LOCAL frame (centred
               * at origin). Apply the world position via mesh.position so we
               * can re-position the blank as viseConfig / activePart / clampGap
               * change WITHOUT re-running CSG. This is the key win of the
               * local-frame cache strategy: position changes are free.
               *
               * `<primitive attach="geometry">` (not geometry={obj} prop)
               * guarantees r3f sets the geometry during the same commit step
               * as the mesh, avoiding the race where drei's <Edges> mounted
               * with parent.geometry still undefined.
               *
               * No <Edges> here — three-bvh-csg's output has hundreds of
               * stitching triangles whose face-normal noise trips
               * EdgesGeometry's dihedral threshold and paints diagonal scratch
               * lines across the blank. Flat shading reads cleanly on its own.
               */
              <mesh
                position={[x, centerY, 0]}
                castShadow
                receiveShadow
                raycast={() => {}}
              >
                <primitive object={holedGeo} attach="geometry" />
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
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
