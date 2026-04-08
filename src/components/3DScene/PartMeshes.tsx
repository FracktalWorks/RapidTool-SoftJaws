import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '../../stores/softJawsStore';
import { geometryCache } from '../../stores/geometryCache';

/**
 * Renders imported part meshes in the R3F scene.
 * Reads Float32Arrays from geometryCache (non-serializable, kept off Zustand).
 * Disposes geometries and materials on unmount or when parts change.
 */
export function PartMeshes() {
  const parts = useSoftJawsStore((s) => s.parts);
  const activePart = useSoftJawsStore((s) => s.activePart);
  const setActivePart = useSoftJawsStore((s) => s.setActivePart);

  return (
    <>
      {parts.map((part) => {
        const cached = geometryCache.get(part.id);
        if (!cached) return null;
        return (
          <PartMesh
            key={part.id}
            partId={part.id}
            positions={cached.positions}
            normals={cached.normals}
            isActive={part.id === activePart}
            onClick={() => setActivePart(part.id)}
          />
        );
      })}
    </>
  );
}

interface PartMeshProps {
  partId: string;
  positions: Float32Array;
  normals: Float32Array;
  isActive: boolean;
  onClick: () => void;
}

function PartMesh({ partId, positions, normals, isActive, onClick }: PartMeshProps) {
  const geoRef = useRef<THREE.BufferGeometry | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  // Build geometry from typed arrays
  useEffect(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals.length > 0) {
      geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const prev = geoRef.current;
    geoRef.current = geo;
    prev?.dispose();

    return () => {
      geoRef.current?.dispose();
      geoRef.current = null;
    };
  }, [positions, normals]);

  // Build material
  useEffect(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: isActive ? 0x4488ff : 0x888888,
      emissive: isActive ? 0x112244 : 0x000000,
      roughness: 0.6,
      metalness: 0.3,
    });
    const prev = matRef.current;
    matRef.current = mat;
    prev?.dispose();

    return () => {
      matRef.current?.dispose();
      matRef.current = null;
    };
  }, [isActive]);

  if (!geoRef.current || !matRef.current) return null;

  return (
    <mesh
      geometry={geoRef.current}
      material={matRef.current}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      castShadow
      receiveShadow
    />
  );
}
