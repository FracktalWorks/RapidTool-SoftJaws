/**
 * JawProfileMesh — Renders the TWO profiled jaw blanks after CSG.
 *
 * Reads left & right result geometries from the cache. Both are in world-
 * space coords (geometry was baked with mesh.matrixWorld before CSG), so
 * the meshes render at position [0, 0, 0].
 *
 * Cache priority per side: holed > profile.
 *   - JAW_HOLED_CACHE_KEY_*   = profile + drilled mounting holes (3rd CSG pass)
 *   - JAW_PROFILE_CACHE_KEY_* = profile only (2nd CSG pass, pocket from part)
 *
 * When jawProfile.generated is true this component replaces JawBlankMesh
 * in Scene3D — the profile IS the blank after the pocket subtraction.
 */

import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import {
  geometryCache,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';

function buildGeometry(cacheKey: string): THREE.BufferGeometry | null {
  const cached = geometryCache.get(cacheKey);
  if (!cached) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals,   3));
  if (cached.indices) {
    geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
  }
  return geo;
}

// ─── JawProfileMesh ──────────────────────────────────────────────────────────

export function JawProfileMesh() {
  const profileReady = useSoftJawsStore((s) => s.jawProfile.generated);
  const holesReady   = useSoftJawsStore((s) => s.mountingHoles.generated);

  const geos = useMemo(() => {
    if (!profileReady) return null;
    // Prefer the holed result (3rd CSG pass) when present; fall back to the
    // pocket-only profile.
    const leftKey  = holesReady ? JAW_HOLED_CACHE_KEY_LEFT  : JAW_PROFILE_CACHE_KEY_LEFT;
    const rightKey = holesReady ? JAW_HOLED_CACHE_KEY_RIGHT : JAW_PROFILE_CACHE_KEY_RIGHT;
    const left  = buildGeometry(leftKey);
    const right = buildGeometry(rightKey);
    if (!left || !right) return null;
    return { left, right };
  }, [profileReady, holesReady]);

  if (!geos) return null;

  return (
    <group>
      {([geos.left, geos.right] as const).map((geo, i) => (
        <mesh key={i} geometry={geo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#3a4048" roughness={0.4} metalness={0.75} />
          <Edges color="#08090c" lineWidth={1} threshold={15} />
        </mesh>
      ))}
    </group>
  );
}
