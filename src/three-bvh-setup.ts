import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from 'three-mesh-bvh';
import * as THREE from 'three';

// Patch THREE.BufferGeometry and THREE.Mesh with BVH acceleration.
// Must be imported once before any geometry is created.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
