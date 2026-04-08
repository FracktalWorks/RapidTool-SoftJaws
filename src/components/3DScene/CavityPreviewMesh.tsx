import { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '../../stores/softJawsStore';

/**
 * Shows a translucent cyan box representing the cavity that will be cut
 * into the jaw blank, based on jaw profile dimensions.
 * Only visible when no CSG result exists yet.
 */
export function CavityPreviewMesh() {
  const jawBlank = useSoftJawsStore((s) => s.jawBlank);
  const jawProfile = useSoftJawsStore((s) => s.jawProfile);

  const geo = useMemo(
    () =>
      new THREE.BoxGeometry(
        (jawBlank.width * 0.6) / 1000,
        jawProfile.depth / 1000,
        (jawBlank.depth * 0.8) / 1000,
      ),
    [jawBlank.width, jawBlank.depth, jawProfile.depth],
  );

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Position at the top of the jaw blank
  const posY = (jawBlank.height / 2000) - (jawProfile.depth / 2000);

  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[0, posY, 0]}
    />
  );
}
