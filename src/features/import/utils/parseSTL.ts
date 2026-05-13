/**
 * parseSTL — Binary and ASCII STL parser
 *
 * Binary STL format:
 *   80-byte header
 *   uint32  face count
 *   per face: 12-byte normal (3×float32) + 36-byte verts (3×3×float32) + 2-byte attr = 50 bytes
 *
 * ASCII STL format:
 *   solid <name>
 *     facet normal nx ny nz
 *       outer loop
 *         vertex x y z
 *         vertex x y z
 *         vertex x y z
 *       endloop
 *     endfacet
 *   endsolid
 *
 * ─── Z-up CAD → Y-up R3F rotation ───────────────────────────────────────────
 * Engineering CAD (SolidWorks, Fusion 360, Onshape, NX, CATIA — the
 * dominant authoring tools for CNC workpieces) exports STL with Z as the
 * up axis. Three.js / R3F is Y-up. Without converting at parse time, a
 * workpiece would appear tipped on its side relative to the vise rail.
 *
 * Applied here at the parser so every downstream consumer (boundingBox,
 * geometryCache, CSG workers, JawBlankMesh, computeWorldSpanX, exports)
 * sees R3F coordinates already. Do NOT remove without re-validating
 * every step's geometry assumptions.
 *
 * Y-up STLs (slicer exports, Blender) will land tilted; user re-orients
 * with the gizmo.
 */

import type { ParseResult } from '../types';

/**
 * Rotate a CAD-Z-up triple to R3F-Y-up.
 *   (x, y, z) → (x, z, -y)   — equivalent to a +π/2 rotation around X.
 *
 * Direction vectors (normals) transform identically under pure rotation,
 * so the same helper is used for both positions and normals.
 */
function zUpToYUp(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

function generateId(): string {
  return `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns true if the buffer is almost certainly ASCII STL */
function isASCII(buffer: ArrayBuffer): boolean {
  const view = new DataView(buffer);
  // Binary STL: bytes 80-83 = face count; total size = 84 + faceCount * 50
  if (buffer.byteLength < 84) return true;
  const faceCount = view.getUint32(80, true);
  const expectedBinarySize = 84 + faceCount * 50;
  // If sizes match it's almost certainly binary
  if (Math.abs(buffer.byteLength - expectedBinarySize) <= 2) return false;
  // Otherwise check header bytes for printable ASCII
  const header = new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength));
  for (let i = 0; i < header.length; i++) {
    if (header[i] > 127) return false;
  }
  return true;
}

function parseBinarySTL(buffer: ArrayBuffer, fileName: string, fileSize: number): ParseResult {
  const view = new DataView(buffer);
  const faceCount = view.getUint32(80, true);

  const positions = new Float32Array(faceCount * 9); // 3 verts * 3 coords per face
  const normals   = new Float32Array(faceCount * 9);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let offset = 84;
  for (let i = 0; i < faceCount; i++) {
    const [nx, ny, nz] = zUpToYUp(
      view.getFloat32(offset,     true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    );
    offset += 12;

    const base = i * 9;
    for (let v = 0; v < 3; v++) {
      const [x, y, z] = zUpToYUp(
        view.getFloat32(offset,     true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      );
      offset += 12;

      positions[base + v * 3]     = x;
      positions[base + v * 3 + 1] = y;
      positions[base + v * 3 + 2] = z;
      normals  [base + v * 3]     = nx;
      normals  [base + v * 3 + 1] = ny;
      normals  [base + v * 3 + 2] = nz;

      // Bbox tracked in R3F coords (post-rotation).
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    offset += 2; // attribute byte count
  }

  const id   = generateId();
  const name = fileName.replace(/\.stl$/i, '');

  return {
    meta: {
      id,
      name,
      fileName,
      fileSize,
      vertexCount: faceCount * 3,
      faceCount,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    },
    geometry: { positions, normals, faceCount },
  };
}

function parseASCIISTL(text: string, fileName: string, fileSize: number): ParseResult {
  const posArr: number[] = [];
  const nrmArr: number[] = [];

  const normalRe = /facet\s+normal\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
  const vertexRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;

  let normalMatch: RegExpExecArray | null;
  let faceCount = 0;

  // Collect normals separately — rotated to R3F coords on the way in.
  const faceNormals: [number, number, number][] = [];
  while ((normalMatch = normalRe.exec(text)) !== null) {
    faceNormals.push(zUpToYUp(
      parseFloat(normalMatch[1]),
      parseFloat(normalMatch[2]),
      parseFloat(normalMatch[3]),
    ));
  }

  let vertMatch: RegExpExecArray | null;
  let vertIdx = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  while ((vertMatch = vertexRe.exec(text)) !== null) {
    const [x, y, z] = zUpToYUp(
      parseFloat(vertMatch[1]),
      parseFloat(vertMatch[2]),
      parseFloat(vertMatch[3]),
    );
    posArr.push(x, y, z);

    const faceIdx = Math.floor(vertIdx / 3);
    const [nx, ny, nz] = faceNormals[faceIdx] ?? [0, 1, 0];
    nrmArr.push(nx, ny, nz);

    // Bbox tracked in R3F coords (post-rotation).
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    vertIdx++;
  }

  faceCount = Math.floor(vertIdx / 3);
  const id   = generateId();
  const name = fileName.replace(/\.stl$/i, '');

  return {
    meta: {
      id,
      name,
      fileName,
      fileSize,
      vertexCount: vertIdx,
      faceCount,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    },
    geometry: {
      positions: new Float32Array(posArr),
      normals:   new Float32Array(nrmArr),
      faceCount,
    },
  };
}

export async function parseSTL(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();

  if (isASCII(buffer)) {
    const text = new TextDecoder().decode(buffer);
    return parseASCIISTL(text, file.name, file.size);
  }
  return parseBinarySTL(buffer, file.name, file.size);
}
