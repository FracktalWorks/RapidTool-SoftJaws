import * as THREE from 'three';

let totalGeometries = 0;
let totalMaterials = 0;

export function trackGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  totalGeometries++;
  return geometry;
}

export function trackMaterial(material: THREE.Material): THREE.Material {
  totalMaterials++;
  return material;
}

export function disposeGeometry(
  geometry: THREE.BufferGeometry | null | undefined,
): void {
  if (!geometry) return;
  geometry.dispose();
  totalGeometries = Math.max(0, totalGeometries - 1);
}

export function disposeMaterial(
  material: THREE.Material | THREE.Material[] | null | undefined,
): void {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((m) => {
      m.dispose();
      totalMaterials = Math.max(0, totalMaterials - 1);
    });
  } else {
    material.dispose();
    totalMaterials = Math.max(0, totalMaterials - 1);
  }
}

export function disposeTexture(
  texture: THREE.Texture | null | undefined,
): void {
  if (!texture) return;
  texture.dispose();
}

export function getMemoryStats() {
  return { geometries: totalGeometries, materials: totalMaterials };
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      disposeGeometry(child.geometry);
      disposeMaterial(child.material as THREE.Material);
    }
  });
}
