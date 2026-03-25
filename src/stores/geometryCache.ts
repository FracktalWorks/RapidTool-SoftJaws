/**
 * geometryCache — Module-level cache for non-serializable Three.js geometry data
 *
 * Three.js Float32Arrays cannot be stored in Zustand (non-serializable).
 * This module-level Map holds parsed geometry keyed by part ID,
 * kept in sync with the Zustand store by the useImport hook.
 */

export interface CachedGeometry {
  /** Flat Float32Array of XYZ vertex positions (3 per vertex, 9 per triangle) */
  positions: Float32Array;
  /** Flat Float32Array of XYZ vertex normals (3 per vertex, 9 per triangle) */
  normals: Float32Array;
  /** Total number of triangular faces */
  faceCount: number;
}

/**
 * Module-level geometry cache — lives outside React/Zustand lifecycle.
 * Add entries via geometryCache.set(partId, geometry).
 * Remove entries via geometryCache.delete(partId) when a part is removed.
 */
export const geometryCache = new Map<string, CachedGeometry>();
