/**
 * PillarBoltDecals — Bracket-face bolt-hole visualisation.
 *
 * Bracket tapped holes are FACTORY HARDWARE — they exist from the moment the
 * vise renders, independently of whether the user has run any Step-6 CSG.
 * Step 6 only drills the SOFT JAW BLANK to match this fixed pattern.
 *
 * Visual model:
 *   • Each pillar exposes the bolt-exit hole on its OUTER (back) face only.
 *     The INNER face is flush against the jaw blank and therefore hidden in
 *     normal viewing — drawing it there is wasted geometry.
 *   • Each hole is a short protruding rim cylinder (catches light, gives an
 *     edge to read against) plus a darker disc just inside the rim opening
 *     (reads as the cavity floor). No CSG required — the pillar geometry
 *     stays procedural and cheap.
 *
 * Position invariant:
 *   • Right pillar X tracks `rightBracketInnerX(...)` — the SAME formula
 *     ViseModel uses to render the moving right bracket. The decals and the
 *     bracket are guaranteed to land on the same X face by construction.
 *   • Left pillar X is the fixed `bracketInnerX(viseConfig)`.
 *   • Both consume the bolt Y/Z from `computeMountingHolePositions`, which
 *     also drives the jaw CSG drill — same source of truth across the chain.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  bracketInnerX,
  VISE_GEOMETRY,
} from '@/features/vise-config/data/presets';
import { rightBracketInnerX, effectiveOverlap } from '@/utils/partGeometry';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';

const HOLE_DARK_COLOR = '#0a0c10';
const HOLE_RING_COLOR = '#3a3e44';
const HOLE_CLEARANCE  = 0.4;       // matches buildHoleTool.ts (per side)
const RING_DIA_K      = 1.4;       // outer rim is 1.4× the through-hole dia
const RIM_DEPTH       = 0.6;       // mm — protruding rim thickness on the pillar face
const CAVITY_INSET    = 0.04;      // mm — floor sits this far behind the rim opening

/**
 * Single bolt-exit feature on one pillar face.
 * @param faceX        World X of the pillar's outer face (signed by side).
 * @param outwardSign  Direction the hole opens (away from the pillar interior).
 *                     +1 for the right pillar's back face, -1 for the left's.
 */
function ExitHole({
  faceX, y, z, throughR, outwardSign,
}: {
  faceX: number;
  y: number;
  z: number;
  throughR: number;
  outwardSign: 1 | -1;
}) {
  const ringR = throughR * RING_DIA_K;
  // Cylinder is Y-up by default — rotateZ(π/2) aligns its axis to world X.
  const yRot  = outwardSign === 1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[faceX, y, z]}>
      {/* Rim — short open-ended cylinder protruding outward from the pillar.
          Open-ended (last arg) shows only the lateral surface — reads as a
          ring of metal around the hole opening. */}
      <mesh
        position={[outwardSign * (RIM_DEPTH / 2), 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[ringR, ringR, RIM_DEPTH, 32, 1, true]} />
        <meshStandardMaterial
          color={HOLE_RING_COLOR}
          roughness={0.32}
          metalness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cavity floor — dark disc just inside the rim. Sits at the back of
          the rim cylinder so the rim's interior reads as a hole opening. */}
      <mesh
        position={[outwardSign * CAVITY_INSET, 0, 0]}
        rotation={[0, yRot, 0]}
      >
        <circleGeometry args={[throughR, 32]} />
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

export function PillarBoltDecals() {
  const viseConfig    = useViseStore((s) => s.viseConfig);
  const jawBlank      = useSoftJawsStore((s) => s.jawBlank);
  const mountingHoles = useSoftJawsStore((s) => s.mountingHoles);
  const jawProfile    = useSoftJawsStore((s) => s.jawProfile);
  const activePart    = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  // RENDER-TIME overlap. Tracks the moving carriage post-profile.
  const renderOverlap = effectiveOverlap(jawProfile.jawOverlap, jawProfile);

  const decals = useMemo(() => {
    const { left, right } = computeMountingHolePositions(
      viseConfig, jawBlank, mountingHoles, activePart, renderOverlap, jawProfile.generated,
    );

    // Left bracket is fixed at the max-stroke position.
    const leftInnerXAbs  = bracketInnerX(viseConfig);
    const leftOuterX     = -(leftInnerXAbs + VISE_GEOMETRY.BR_PILLAR_LEN);

    // Right bracket TRACKS the part — same formula ViseModel uses to render
    // the moving pillar, so the decals land on the actual pillar back face.
    const rightInnerXAbs = rightBracketInnerX(viseConfig, jawBlank, activePart, renderOverlap, jawProfile.generated);
    const rightOuterX    =  rightInnerXAbs + VISE_GEOMETRY.BR_PILLAR_LEN;

    const throughR = mountingHoles.boltSize / 2 + HOLE_CLEARANCE;

    return { throughR, leftOuterX, rightOuterX, left, right };
  }, [viseConfig, jawBlank, mountingHoles, activePart, renderOverlap]);

  const { throughR, leftOuterX, rightOuterX, left, right } = decals;

  return (
    <group>
      {right.map((p, i) => (
        <ExitHole
          key={`r${i}`}
          faceX={rightOuterX}
          y={p.y}
          z={p.z}
          throughR={throughR}
          outwardSign={1}
        />
      ))}
      {left.map((p, i) => (
        <ExitHole
          key={`l${i}`}
          faceX={leftOuterX}
          y={p.y}
          z={p.z}
          throughR={throughR}
          outwardSign={-1}
        />
      ))}
    </group>
  );
}
