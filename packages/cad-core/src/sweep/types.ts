/**
 * Swept Volume Processor — Types
 *
 * Mirrors the structure of `offset/types.ts` so this module can drop into
 * `packages/cad-core/src/sweep/` (or `…/offset/`) with no shape changes.
 *
 * The sweep algorithm itself is the un-smoothed analogue of the heightmap
 * offset pipeline: it produces a watertight swept-volume mesh by slicing →
 * accumulating → lofting (no Gaussian / Taubin / Laplacian smoothing).
 */

import type * as THREE from 'three';

// ============================================
// Core Options / Result
// ============================================

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface SweptMeshOptions {
  /**
   * Sweep direction (will be normalized).
   * If omitted, the direction is derived from `rotationXZ` + `rotationYZ`
   * applied to `DEFAULT_SWEEP_DIRECTION`.
   */
  direction?: Vec3Like;

  /**
   * Rotation around the **Z axis** in degrees.
   *
   * Naming kept identical to `OffsetMeshOptions.rotationXZ` for drop-in
   * compatibility — note the name is historical: it does NOT rotate around Y.
   * Used to derive the sweep direction when `direction` is not supplied.
   */
  rotationXZ?: number;

  /**
   * Rotation around the **X axis** in degrees, added on top of
   * `BASELINE_YZ_ROTATION` (180°). Mirrors `OffsetMeshOptions.rotationYZ`.
   * Used to derive the sweep direction when `direction` is not supplied.
   */
  rotationYZ?: number;

  /**
   * Slice plane spacing along the sweep axis (world units).
   * Smaller = finer profiles, more memory + CPU.
   */
  layerHeight?: number;

  /**
   * Per-vertex 3D mesh offset applied BEFORE slicing
   * (positive = expand, negative = shrink). Mirrors MeshLib's `offsetVerts`.
   * Set to 0 to disable.
   */
  offsetDistance?: number;

  /**
   * Per-slice 2D contour offset applied to each cross-section
   * (positive = expand, negative = shrink). Miter-join with limit.
   * Set to 0 to disable.
   */
  contourOffset?: number;

  /**
   * Whether to monotonically accumulate (forward-union) the slice profiles
   * before lofting. When true, the swept volume is the *envelope* (Minkowski-
   * sum-style); when false, the loft is taken from raw per-slice profiles.
   * Default: true.
   */
  accumulate?: boolean;

  /**
   * Optional lower bound limit for the sweep slice range along the sweep axis.
   * If set, slices are generated down to this limit and filled with the bottom profile.
   */
  limitMin?: number | null;

  /**
   * Optional upper bound limit for the sweep slice range along the sweep axis.
   * If set, slices are generated up to this limit and filled with the top profile.
   */
  limitMax?: number | null;

  /** Progress callback (current, total, stage). */
  progressCallback?: ((current: number, total: number, stage: string) => void) | null;
}

export interface SweptMeshMetadata {
  direction: Vec3Like;
  rotationXZ: number;
  rotationYZ: number;
  layerHeight: number;
  offsetDistance: number;
  contourOffset: number;
  accumulate: boolean;

  inputVertices: number;
  inputTriangles: number;
  vertexCount: number;
  triangleCount: number;

  totalSlices: number;
  slicesWithContours: number;
  loops: number;
  profileShapes: number;
  mergedExtrusions: number;

  /** Wall-clock processing time (ms). */
  processingTime: number;
  /** Sub-stage timings (ms). */
  timings: {
    offset: number;
    extract: number;
    accumulate: number;
    loft: number;
  };
}

export interface SweptMeshResult {
  geometry: THREE.BufferGeometry | null;
  metadata: SweptMeshMetadata;
}

// ============================================
// Defaults
// ============================================

/**
 * Default sweep direction when neither `direction` nor any rotation is
 * supplied.
 *
 * Matches the `offset/` module convention exactly:
 *   - The toolchain is **Y-up** (Y is the height/sweep axis).
 *   - `offsetMeshProcessor` always pre-rotates by `BASELINE_YZ_ROTATION = 180°`
 *     around X before rendering the heightmap, which means the heightmap is
 *     captured looking **down +Y** in the rotated frame, equivalently looking
 *     **down -Y** in the original (caller) world frame.
 *
 * So with `rotationXZ = 0`, `rotationYZ = 0`, the effective sweep direction
 * in caller space is `-Y`. Both modules now agree on this datum.
 */
export const DEFAULT_SWEEP_DIRECTION: Readonly<Vec3Like> = Object.freeze({
  x: 0,
  y: -1,
  z: 0,
});

/**
 * Baseline rotation around X (in degrees) added to `rotationYZ` before
 * applying any user angle. Mirrors `BASELINE_YZ_ROTATION` in
 * `offset/offsetMeshProcessor.ts`.
 */
export const BASELINE_YZ_ROTATION = 180;

/**
 * Six axis-aligned presets — convenient for UIs that expose a direction picker.
 */
export const SWEEP_DIRECTION_PRESETS: ReadonlyArray<{ label: string; dir: Vec3Like }> = Object.freeze([
  { label: '+X', dir: { x:  1, y: 0, z:  0 } },
  { label: '-X', dir: { x: -1, y: 0, z:  0 } },
  { label: '+Y', dir: { x:  0, y: 1, z:  0 } },
  { label: '-Y', dir: { x:  0, y:-1, z:  0 } },
  { label: '+Z', dir: { x:  0, y: 0, z:  1 } },
  { label: '-Z', dir: { x:  0, y: 0, z: -1 } },
]);

/**
 * Sensible defaults matching the existing test harness. Mirrors
 * `DEFAULT_CAVITY_SETTINGS` in `offset/types.ts`.
 */
export const DEFAULT_SWEEP_SETTINGS: Required<Omit<SweptMeshOptions, 'progressCallback' | 'direction'>> & {
  direction: Vec3Like;
  progressCallback: null;
} = {
  direction: { ...DEFAULT_SWEEP_DIRECTION },
  rotationXZ: 0,
  rotationYZ: 0,
  layerHeight: 0.15,
  offsetDistance: 0,
  contourOffset: 0,
  accumulate: true,
  limitMin: null,
  limitMax: null,
  progressCallback: null,
};
