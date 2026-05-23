/**
 * JawBoltDecorations — Counterbore previews on the soft-jaw inner faces.
 *
 * The pattern mirrors `PillarBoltDecals`:
 *   • Both consume `computeMountingHolePositions` so the planned position
 *     can never disagree with what Step-6 CSG eventually drills.
 *   • Both are pure visual hardware — no CSG cost.
 *   • Both are gated complementarily: bracket decorations show always
 *     (factory hardware); jaw decorations show ONLY while
 *     `mountingHoles.generated === false`, because once the CSG runs the
 *     `JAW_HOLED` cache replaces the blank and the geometry IS the hole.
 *
 * Visual model:
 *   • A short rim cylinder protrudes ~0.8 mm out of the jaw inner face,
 *     catching light around the opening (counterbore-diameter circle).
 *   • A dark disc sits just behind the rim opening, reading as the cavity
 *     interior. Together they communicate "hole that goes into the jaw"
 *     without actually CSG-cutting one (the real cut happens in Step 6).
 *
 * Why only the inner face is decorated:
 *   • The outer face of the jaw is flush against the pillar inner face —
 *     hidden in every normal viewing angle. Adding decoration there would
 *     never be seen. `PillarBoltDecals` already shows the bolt exit on the
 *     pillar BACK face, which together with these inner-face counterbores
 *     completes the inside-to-out bolt path visually.
 *
 * Position math:
 *   • Each side's positions[].x is the JAW CENTER X (see positions.ts).
 *   • Inner face X = jawCenterX − sign × (thickness / 2)
 *     − Right jaw (sign=+1): innerX = jawCenterX − thickness/2,
 *                            opens toward −X (workpiece) → outwardSign = −1.
 *     − Left  jaw (sign=−1): innerX = jawCenterX + thickness/2,
 *                            opens toward +X (workpiece) → outwardSign = +1.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';
import { COUNTERBORE_DIA_K } from '@/features/mounting-holes/utils/buildHoleTool';
import { effectiveClampGap } from '@/utils/partGeometry';

const HOLE_DARK_COLOR  = '#06080c';
const HOLE_RING_COLOR  = '#2f343b';   // slightly darker than the bracket rim so the
                                       // two reads remain visually distinct
const RIM_DEPTH        = 0.8;          // mm — protrudes from the inner face
const CAVITY_INSET     = 0.05;         // mm — floor sits just behind the rim opening

interface JawCounterboreProps {
  /** World X of the jaw's inner (workpiece-facing) face. */
  faceX: number;
  y: number;
  z: number;
  /** Counterbore diameter — `boltSize × COUNTERBORE_DIA_K`. */
  cboreR: number;
  /** +1 for left jaw (opens toward +X), −1 for right jaw (opens toward −X). */
  outwardSign: 1 | -1;
}

function JawCounterbore({ faceX, y, z, cboreR, outwardSign }: JawCounterboreProps) {
  const yRot = outwardSign === 1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[faceX, y, z]}>
      {/* Rim — short open-ended cylinder protruding outward from the inner face.
          Counterbore-sized radius so it reads as the bolt-HEAD opening, not the
          shank through-hole. */}
      <mesh
        position={[outwardSign * (RIM_DEPTH / 2), 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[cboreR, cboreR, RIM_DEPTH, 32, 1, true]} />
        <meshStandardMaterial
          color={HOLE_RING_COLOR}
          roughness={0.32}
          metalness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cavity floor — dark disc just behind the rim opening, communicates
          that the hole goes INTO the jaw (would be where the bolt-head face
          seats after Step-6 CSG actually recesses the counterbore). */}
      <mesh
        position={[outwardSign * CAVITY_INSET, 0, 0]}
        rotation={[0, yRot, 0]}
      >
        <circleGeometry args={[cboreR, 32]} />
        <meshStandardMaterial
          color={HOLE_DARK_COLOR}
          roughness={0.95}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function JawBoltDecorations() {
  const viseConfig     = useViseStore((s) => s.viseConfig);
  const jawBlank       = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles  = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap       = useSoftJawsStore((s) => s.clampGap);
  const jawProfile     = useSoftJawsStore((s) => s.jawProfile);
  const holesGenerated = useSoftJawsStore((s) => s.mountingHoles.generated);
  const activePart     = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  // Decals track the moving carriage post-profile.
  const renderClampGap = effectiveClampGap(clampGap, jawProfile);

  const data = useMemo(() => {
    const { left, right } = computeMountingHolePositions(
      viseConfig, jawBlank, mountingHoles, activePart, renderClampGap,
    );
    const cboreR = (mountingHoles.boltSize * COUNTERBORE_DIA_K) / 2;
    const halfThickness = jawBlank.thickness / 2;
    return { left, right, cboreR, halfThickness };
  }, [viseConfig, jawBlank, mountingHoles, activePart, renderClampGap]);

  // Once real CSG holes exist (JAW_HOLED cache), the geometry itself shows the
  // counterbore — decorations would visually double up. Hide.
  if (holesGenerated) return null;

  const { left, right, cboreR, halfThickness } = data;

  return (
    <group>
      {right.map((p, i) => (
        <JawCounterbore
          key={`r${i}`}
          faceX={p.x - halfThickness}
          y={p.y}
          z={p.z}
          cboreR={cboreR}
          outwardSign={-1}
        />
      ))}
      {left.map((p, i) => (
        <JawCounterbore
          key={`l${i}`}
          faceX={p.x + halfThickness}
          y={p.y}
          z={p.z}
          cboreR={cboreR}
          outwardSign={+1}
        />
      ))}
    </group>
  );
}
