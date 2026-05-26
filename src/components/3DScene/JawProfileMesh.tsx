/**
 * JawProfileMesh — Renders the TWO profiled jaw blanks after CSG.
 *
 * Reads left & right result geometries from the cache. Both are in world-
 * space coords (geometry was baked with mesh.matrixWorld before CSG), so
 * the meshes render at position [0, 0, 0].
 *
 * Cache: always `JAW_PROFILE_CACHE_KEY_*`.
 *
 * Architecture note: in the current "holes are part of the blank" workflow,
 * useJawProfile uses the cached `JAW_HOLED_*` blank (drilled by AppShell's
 * auto-drill) as the base geometry it cuts the pocket INTO. The result
 * stored in `JAW_PROFILE_*` already contains BOTH the bolt holes AND the
 * cavity — so this component just renders it directly. The earlier logic
 * `holesReady ? JAW_HOLED : JAW_PROFILE` was a leftover from the old
 * 3-step pipeline and caused the carved profile to disappear as soon as
 * the auto-drill finished (JAW_HOLED contains only the holes, not the
 * cavity, so picking it hides the cavity).
 *
 * When jawProfile.generated is true this component replaces JawBlankMesh
 * in Scene3D — the profile IS the blank after the pocket subtraction.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';
import { rightJawCenterX, effectiveOverlap } from '@/utils/partGeometry';

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
  const jawProfile   = useSoftJawsStore((s) => s.jawProfile);
  const jawBlank     = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig   = useViseStore((s) => s.viseConfig);
  const activePart   = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  // RIGHT-MESH POST-CLAMP SHIFT
  //
  // The CSG SUBTRACTION was computed with the right jaw centred at
  // `rightJawCenterX(..., designOverlap)` and the resulting world-space
  // mesh was baked at that position. After profile.generated we want the
  // right jaw to APPEAR shifted inward — but we mustn't re-bake the CSG.
  // The fix: render the right mesh with a position offset equal to the
  // delta between the effective (closed) and design (open) jaw centres.
  // For the LEFT mesh this delta is always zero (left bracket is fixed).
  const rightMeshOffsetX = useMemo(() => {
    if (!profileReady || !activePart) return 0;
    const effective = effectiveOverlap(jawProfile.jawOverlap, jawProfile);
    return rightJawCenterX(viseConfig, jawBlank, activePart, effective)
         - rightJawCenterX(viseConfig, jawBlank, activePart, jawProfile.jawOverlap);
  }, [profileReady, activePart, viseConfig, jawBlank, jawProfile]);

  const geos = useMemo(() => {
    if (!profileReady) return null;
    // Always JAW_PROFILE — it's cut FROM the holed blank, so holes are
    // already baked in. JAW_HOLED contains only holes (no cavity).
    const left  = buildGeometry(JAW_PROFILE_CACHE_KEY_LEFT);
    const right = buildGeometry(JAW_PROFILE_CACHE_KEY_RIGHT);
    if (!left || !right) return null;
    return { left, right };
  }, [profileReady]);

  // Free the GPU buffers of the OLD geometries whenever `geos` is replaced
  // or this component unmounts. Without this every Generate Profile click
  // leaks two BufferGeometry's worth of vertex / normal / index data on the
  // GPU, eventually triggering "THREE.WebGLRenderer: Context Lost".
  useEffect(() => {
    return () => {
      if (geos) {
        geos.left.dispose();
        geos.right.dispose();
      }
    };
  }, [geos]);

  if (!geos) return null;

  return (
    <group>
      {/*
        No edges overlay on the profiled jaw.
        three-bvh-csg emits hundreds of stitching triangles connecting the
        pocket boundary to the box corners. Even with mergeVertices welding
        and a 35 degree threshold, the per-triangle normal noise on what
        should be coplanar surfaces is large enough that EdgesGeometry
        cannot tell those triangles apart from real corners — and you got
        long diagonal scratch lines fanning across the jaw face. The
        flat-shaded mesh reads as a clean machined surface without the
        overlay.
      */}
      {/* Left mesh: stays at world origin (cavity baked here, left bracket fixed). */}
      <mesh geometry={geos.left} position={[0, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3a4048" roughness={0.4} metalness={0.75} />
      </mesh>
      {/* Right mesh: shifts inward by rightMeshOffsetX once profile generated. */}
      <mesh geometry={geos.right} position={[rightMeshOffsetX, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#3a4048" roughness={0.4} metalness={0.75} />
      </mesh>
    </group>
  );
}
