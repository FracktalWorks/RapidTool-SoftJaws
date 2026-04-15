/**
 * PartMeshes — Renders all imported parts from the geometry cache
 *
 * Reads part metadata from useSoftJawsStore (serializable) and
 * geometry data (Float32Arrays) from the module-level geometryCache.
 * Each PartMesh creates a BufferGeometry with position + normal attributes.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { geometryCache } from '@/stores/geometryCache';
import type { ProcessedPart } from '@/stores/types';

// Stable color palette for parts (cycles if more than palette length)
const PART_COLORS = [
  '#4ade80', // green
  '#60a5fa', // blue
  '#f472b6', // pink
  '#fb923c', // orange
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
];

// ─── PartMesh ────────────────────────────────────────────────────────────────

function PartMesh({
  part,
  color,
  isActive,
}: {
  part: ProcessedPart;
  color: string;
  isActive: boolean;
}) {
  const geomData = geometryCache.get(part.id);
  const meshRef  = useRef<THREE.Mesh>(null);

  // Build a centered BufferGeometry — STL files can have arbitrary origins,
  // so we translate by -center so the mesh sits at the world origin.
  const geometry = useMemo(() => {
    if (!geomData) return null;

    const { min, max } = part.boundingBox;
    const cx = (min[0] + max[0]) / 2;
    const cy = (min[1] + max[1]) / 2;
    const cz = (min[2] + max[2]) / 2;

    // Clone positions and shift so the bounding-box center lands at origin
    const shifted = new Float32Array(geomData.positions.length);
    for (let i = 0; i < geomData.positions.length; i += 3) {
      shifted[i]     = geomData.positions[i]     - cx;
      shifted[i + 1] = geomData.positions[i + 1] - cy;
      shifted[i + 2] = geomData.positions[i + 2] - cz;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(shifted, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(geomData.normals.slice(), 3));
    return geo;
  }, [geomData, part.boundingBox]);

  if (!geometry) return null;

  const { position: pos, rotation: rot } = part.transform;
  // Base Y lifts the part to sit on the ground plane; user offset adds on top
  const baseY  = (part.boundingBox.max[1] - part.boundingBox.min[1]) / 2;
  // Rotation stored in degrees → convert to radians for Three.js
  const deg2rad = Math.PI / 180;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[pos.x, baseY + pos.y, pos.z]}
      rotation={[rot.x * deg2rad, rot.y * deg2rad, rot.z * deg2rad]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.15}
        side={THREE.DoubleSide}
        emissive={isActive ? color : '#000000'}
        emissiveIntensity={isActive ? 0.1 : 0}
      />
    </mesh>
  );
}

// ─── PartMeshes ──────────────────────────────────────────────────────────────

export function PartMeshes() {
  const parts    = useSoftJawsStore((s) => s.parts);
  const activePart = useSoftJawsStore((s) => s.activePart);

  if (parts.length === 0) return null;

  return (
    <>
      {parts.map((part, idx) => (
        <PartMesh
          key={part.id}
          part={part}
          color={PART_COLORS[idx % PART_COLORS.length]}
          isActive={activePart === part.id}
        />
      ))}
    </>
  );
}
