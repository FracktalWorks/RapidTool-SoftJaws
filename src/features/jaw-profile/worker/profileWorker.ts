import * as THREE from 'three';
import { CSGEngine } from '@rapidtool/cad-core';

export interface ProfileWorkerInput {
  id: string;
  blankPositions: Float32Array;
  blankNormals: Float32Array;
  blankIndices?: Uint32Array;
  partPositions: Float32Array;
  partNormals: Float32Array;
  partIndices?: Uint32Array;
  partTransform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  partBoundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  removalDir: [number, number, number];
  depth: number;
  offset: number;
}

export interface ProfileWorkerOutput {
  id: string;
  success: boolean;
  positions?: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
  error?: string;
}

function buildPartMesh(
  geomData: { positions: Float32Array; normals: Float32Array; indices?: Uint32Array },
  boundingBox: { min: [number, number, number]; max: [number, number, number] },
  transform: ProfileWorkerInput['partTransform']
): THREE.Mesh {
  const { min, max } = boundingBox;
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const partHeight = max[1] - min[1];

  const shifted = new Float32Array(geomData.positions.length);
  for (let i = 0; i < geomData.positions.length; i += 3) {
    shifted[i]     = geomData.positions[i]     - cx;
    shifted[i + 1] = geomData.positions[i + 1] - cy;
    shifted[i + 2] = geomData.positions[i + 2] - cz;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(shifted, 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(geomData.normals), 3));
  if (geomData.indices) {
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(geomData.indices), 1));
  }

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  
  const baseY = partHeight / 2;
  const deg2rad = Math.PI / 180;
  
  mesh.position.set(
    transform.position.x, 
    baseY + transform.position.y, 
    transform.position.z
  );
  
  mesh.rotation.set(
    transform.rotation.x * deg2rad, 
    transform.rotation.y * deg2rad, 
    transform.rotation.z * deg2rad
  );
  
  mesh.updateMatrixWorld(true);
  return mesh;
}

self.onmessage = (e: MessageEvent<ProfileWorkerInput>) => {
  const data = e.data;
  
  try {
    // 1. Build Blank Mesh
    const blankGeo = new THREE.BufferGeometry();
    blankGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.blankPositions), 3));
    blankGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.blankNormals), 3));
    if (data.blankIndices) {
      blankGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.blankIndices), 1));
    }
    const blankMesh = new THREE.Mesh(blankGeo, new THREE.MeshBasicMaterial());
    blankMesh.updateMatrixWorld(true);

    // 2. Build Part Mesh
    const partMesh = buildPartMesh(
      { positions: data.partPositions, normals: data.partNormals, indices: data.partIndices },
      data.partBoundingBox,
      data.partTransform
    );

    // 3. CSG Engine Negative Space
    const engine = new CSGEngine();
    const removalDirVector = new THREE.Vector3().fromArray(data.removalDir);
    
    const resultMesh = engine.createNegativeSpace(
      blankMesh,
      [partMesh],
      removalDirVector,
      { depth: data.depth, offset: data.offset }
    );

    // 4. Extract geometry and send back
    const resGeo = resultMesh.geometry;
    
    // Ensure index exists for cleaner data transfer
    if (!resGeo.index) {
        const positions = resGeo.getAttribute('position');
        const indexArray = new Uint32Array(positions.count);
        for (let i = 0; i < positions.count; i++) indexArray[i] = i;
        resGeo.setIndex(new THREE.BufferAttribute(indexArray, 1));
    }

    const posArray = new Float32Array(resGeo.getAttribute('position').array);
    const normArray = new Float32Array(resGeo.getAttribute('normal').array);
    const idxArray = new Uint32Array(resGeo.index!.array);

    (self as unknown as Worker).postMessage({
      id: data.id,
      success: true,
      positions: posArray,
      normals: normArray,
      indices: idxArray
    } as ProfileWorkerOutput, [
      posArray.buffer,
      normArray.buffer,
      idxArray.buffer
    ]);
    
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id: data.id,
      success: false,
      error: err.message
    } as ProfileWorkerOutput);
  }
};
