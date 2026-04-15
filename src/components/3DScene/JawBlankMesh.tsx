/**
 * JawBlankMesh — Renders the jaw blank as a solid box in the 3D scene.
 *
 * Coordinate mapping (CAD Z-up → Three.js Y-up):
 *   store.jawBlank.width  (CAD X) → Three.js X
 *   store.jawBlank.height (CAD Z) → Three.js Y  (label: "Height (Z)")
 *   store.jawBlank.depth  (CAD Y) → Three.js Z  (label: "Depth (Y)")
 *
 * The box is centered on the world X/Z origin and sits flush on the
 * Y = 0 ground plane (positionY = height / 2).
 */

import React, { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { useSoftJawsStore } from '@/stores/softJawsStore';

// ─── Material → visual color map ─────────────────────────────────────────────

const MATERIAL_COLORS: Record<string, string> = {
  'aluminum-6061': '#c0c8d0',
  'aluminum-7075': '#a8b4c0',
  'steel-mild':    '#8090a0',
  'steel-4140':    '#7080a0',
  'brass':         '#c8a860',
  'nylon':         '#e8d8b0',
};

const DEFAULT_BLANK_COLOR = '#b8c0cc';

// ─── JawBlankMesh ─────────────────────────────────────────────────────────────

export function JawBlankMesh() {
  const { width, height, depth, material } = useSoftJawsStore((s) => s.jawBlank);

  // Re-derive position only when dimensions change
  const positionY = useMemo(() => height / 2, [height]);

  const color = MATERIAL_COLORS[material] ?? DEFAULT_BLANK_COLOR;

  return (
    <mesh
      position={[0, positionY, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={color}
        roughness={0.55}
        metalness={0.45}
        transparent
        opacity={0.82}
      />
      {/* Edge highlight so the silhouette reads clearly against the workpiece */}
      <Edges color="#6080a0" lineWidth={1} threshold={15} />
    </mesh>
  );
}
