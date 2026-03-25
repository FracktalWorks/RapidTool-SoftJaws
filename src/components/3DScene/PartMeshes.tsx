/**
 * PartMeshes — Renders all imported parts from the geometry cache
 *
 * Reads part metadata from useSoftJawsStore (serializable) and
 * geometry data (Float32Arrays) from the module-level geometryCache.
 * Each PartMesh creates a BufferGeometry with position + normal attributes.
 */

import React, { useMemo, useRef } from 'react';
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
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    if (!geomData) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(geomData.positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(geomData.normals,   3));
    return geo;
  }, [geomData]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.2}
        side={THREE.DoubleSide}
        emissive={isActive ? color : '#000000'}
        emissiveIntensity={isActive ? 0.08 : 0}
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
