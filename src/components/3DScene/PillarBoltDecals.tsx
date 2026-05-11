/**
 * PillarBoltDecals — Visible "exit hole" decals on the back face of each
 * L-bracket pillar.
 *
 * The mounting-hole CSG (useMountingHoles) drills the through-hole through
 * the SOFT JAW only — the L-bracket pillars are part of the procedural vise
 * mesh and aren't CSG'd. Without these decals the pillar covers the back of
 * the bolt path, breaking the visual story of a bolt that goes "inside to
 * outward" through both jaw and bracket.
 *
 * This component renders dark countersink-style discs on the OUTER ±X face
 * of each pillar, at the same Y/Z as the soft-jaw mounting bolts. Purely
 * visual — the vise body geometry isn't exported anyway.
 *
 * Renders nothing until `mountingHoles.generated` is true (i.e. the user
 * has actually drilled the holes).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  bracketInnerX,
  VISE_GEOMETRY,
} from '@/features/vise-config/data/presets';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';

const HOLE_DARK_COLOR = '#0a0c10';
const HOLE_RING_COLOR = '#3a3e44';
const HOLE_CLEARANCE  = 0.4;       // matches buildHoleTool.ts (per side)
const RING_DIA_K      = 1.4;       // outer ring is 1.4× the through-hole dia

function ExitHole({
  x, y, z, throughR, sign,
}: { x: number; y: number; z: number; throughR: number; sign: 1 | -1 }) {
  const ringR = throughR * RING_DIA_K;
  const eps   = 0.06;
  const yRot  = sign === 1 ? -Math.PI / 2 : Math.PI / 2;  // face outward

  return (
    <group position={[x + sign * eps, y, z]}>
      {/* Outer ring — slight metallic chamfer around the hole */}
      <mesh rotation={[0, yRot, 0]}>
        <circleGeometry args={[ringR, 32]} />
        <meshStandardMaterial
          color={HOLE_RING_COLOR}
          roughness={0.5}
          metalness={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner dark disc — reads as the bolt-shank exit */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.01, 0, 0]}>
        <circleGeometry args={[throughR, 24]} />
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
  const holesReady    = useSoftJawsStore((s) => s.mountingHoles.generated);

  const decals = useMemo(() => {
    if (!holesReady) return null;

    const { left, right } = computeMountingHolePositions(viseConfig, jawBlank, mountingHoles);

    // Pillar outer X = inner face + fixed pillar X thickness.
    // BR_PILLAR_LEN is a hardware constant — doesn't scale with jawStroke.
    const pillarOuterRight = bracketInnerX(viseConfig) + VISE_GEOMETRY.BR_PILLAR_LEN;

    const throughR = mountingHoles.boltSize / 2 + HOLE_CLEARANCE;

    return {
      throughR,
      pillarOuterRight,
      left,
      right,
    };
  }, [holesReady, viseConfig, jawBlank, mountingHoles]);

  if (!decals) return null;
  const { throughR, pillarOuterRight, left, right } = decals;

  return (
    <group>
      {right.map((p, i) => (
        <ExitHole
          key={`r${i}`}
          x={pillarOuterRight}
          y={p.y}
          z={p.z}
          throughR={throughR}
          sign={1}
        />
      ))}
      {left.map((p, i) => (
        <ExitHole
          key={`l${i}`}
          x={-pillarOuterRight}
          y={p.y}
          z={p.z}
          throughR={throughR}
          sign={-1}
        />
      ))}
    </group>
  );
}
