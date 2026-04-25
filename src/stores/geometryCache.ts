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
  /** Optional index buffer — present for CSG results from three-bvh-csg */
  indices?: Uint32Array;
}

/**
 * Module-level geometry cache — lives outside React/Zustand lifecycle.
 * Add entries via geometryCache.set(partId, geometry).
 * Remove entries via geometryCache.delete(partId) when a part is removed.
 */
export const geometryCache = new Map<string, CachedGeometry>();

/** Reserved key for the jaw profile CSG result — legacy single-blank. */
export const JAW_PROFILE_CACHE_KEY = 'jaw-profile-result';

/**
 * Reserved keys for the two-blank CSG results.
 * Each key holds the profiled blank (with workpiece-shaped pocket cut into its
 * inner face) for the corresponding side. Results live in world-space coords.
 */
export const JAW_PROFILE_CACHE_KEY_LEFT  = 'jaw-profile-result-left';
export const JAW_PROFILE_CACHE_KEY_RIGHT = 'jaw-profile-result-right';

/**
 * Reserved keys for the post-mounting-holes CSG results.
 * Each key holds the profiled blank with mounting bolt holes drilled
 * through its outer X-face (counterbore + through-hole pairs).
 * Results live in world-space coords; JawProfileMesh prefers these
 * over the JAW_PROFILE_* keys when present.
 */
export const JAW_HOLED_CACHE_KEY_LEFT  = 'jaw-holed-result-left';
export const JAW_HOLED_CACHE_KEY_RIGHT = 'jaw-holed-result-right';
