/**
 * JawProfileMesh — Renders the CSG jaw profile result in the 3D scene.
 *
 * Reads the result geometry from geometryCache under JAW_PROFILE_CACHE_KEY.
 * Only renders when jawProfile.generated is true AND the cache entry exists.
 *
 * When the jaw profile is visible, the jaw blank box is intentionally
 * replaced by this mesh (the profile IS the blank after subtraction).
 * Visual style: metallic aluminum with a contrasting edge line.
 */

import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { geometryCache, JAW_PROFILE_CACHE_KEY } from '@/stores/geometryCache';

// ─── JawProfileMesh ──────────────────────────────────────────────────────────

export function JawProfileMesh() {
  const generated = useSoftJawsStore((s) => s.jawProfile.generated);
  const jawHeight = useSoftJawsStore((s) => s.jawBlank.height);

  const geometry = useMemo(() => {
    if (!generated) return null;

    const cached = geometryCache.get(JAW_PROFILE_CACHE_KEY);
    if (!cached) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals,   3));
    return geo;
  }, [generated]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      // The CSG result inherits the blank's world transform — sit on Y = 0
      position={[0, jawHeight / 2, 0]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color="#c0c8d0"
        roughness={0.45}
        metalness={0.6}
      />
      <Edges color="#4a6080" lineWidth={1} threshold={15} />
    </mesh>
  );
}
