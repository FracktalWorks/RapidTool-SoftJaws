import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '../../stores/softJawsStore';
import { geometryCache } from '../../stores/geometryCache';
import { JAW_PROFILE_RESULT_KEY } from '../../features/jaw-profile/hooks/useJawProfile';
import { MOUNTING_HOLES_RESULT_KEY } from '../../features/mounting-holes/hooks/useMountingHoles';

/**
 * Renders the soft jaw geometry in the 3D scene.
 * Priority: mounting-holes result > jaw-profile result > jaw-blank placeholder box.
 */
export function JawBlankMesh() {
  const jawBlank = useSoftJawsStore((s) => s.jawBlank);

  // Check for CSG results
  const finalCached = geometryCache.get(MOUNTING_HOLES_RESULT_KEY);
  const profileCached = geometryCache.get(JAW_PROFILE_RESULT_KEY);
  const cached = finalCached ?? profileCached;

  const jawGeo = useMemo(() => {
    if (cached) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.BufferAttribute(cached.positions, 3),
      );
      if (cached.normals.length > 0) {
        geo.setAttribute(
          'normal',
          new THREE.BufferAttribute(cached.normals, 3),
        );
      } else {
        geo.computeVertexNormals();
      }
      return geo;
    }
    // Placeholder box in mm → m
    return new THREE.BoxGeometry(
      jawBlank.width / 1000,
      jawBlank.height / 1000,
      jawBlank.depth / 1000,
    );
  }, [cached, jawBlank.width, jawBlank.height, jawBlank.depth]);

  const jawMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: cached ? 0x7ab3e0 : 0xaaaaaa,
        roughness: 0.4,
        metalness: 0.6,
        transparent: !cached,
        opacity: cached ? 1.0 : 0.35,
        wireframe: !cached,
      }),
    [cached],
  );

  return <mesh geometry={jawGeo} material={jawMat} castShadow receiveShadow />;
}
