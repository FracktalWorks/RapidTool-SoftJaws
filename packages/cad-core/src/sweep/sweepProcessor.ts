/**
 * Swept Volume Processor — Main API
 *
 * High-level wrapper around the slice/accumulate/loft pipeline in
 * `sweepCore.js`. Mirrors the shape of `offsetMeshProcessor.createOffsetMesh`
 * so this module can drop into RapidTool's `cad-core/src/` as a peer of the
 * existing `offset/` module — same Float32Array-in / `{ geometry, metadata }`-
 * out contract, same `progressCallback`, same options pattern.
 *
 * NOTE: Unlike the offset module, no smoothing (Taubin / Laplacian / etc.) is
 * applied — this is the un-smoothed swept-volume path.
 */

import * as THREE from 'three';
import {
  offsetMeshVerts,
  extractContour,
  accumulateContours,
  loftContoursToMesh,
} from './sweepCore.js';
import {
  DEFAULT_SWEEP_SETTINGS,
  DEFAULT_SWEEP_DIRECTION,
  BASELINE_YZ_ROTATION,
  type SweptMeshOptions,
  type SweptMeshResult,
  type SweptMeshMetadata,
  type Vec3Like,
} from './types';

// ============================================
// Constants
// ============================================

const DEG = Math.PI / 180;

const PROGRESS = {
  VALIDATE:    0,
  RESOLVE_DIR: 2,
  OFFSET:      5,
  EXTRACT:     20,
  ACCUMULATE:  60,
  LOFT:        75,
  FINALIZE:    98,
  COMPLETE:   100,
} as const;

// ============================================
// Helpers
// ============================================

const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const reportProgress = (
  cb: SweptMeshOptions['progressCallback'],
  pct: number,
  stage: string
): void => {
  cb?.(pct, 100, stage);
};

/**
 * Resolve the final sweep direction from caller-supplied options.
 *
 * Convention — IDENTICAL to `offset/offsetMeshProcessor.createRotationMatrix`:
 *   - explicit `direction` wins outright;
 *   - otherwise start from `DEFAULT_SWEEP_DIRECTION` (= -Y, the effective
 *     sweep direction of the offset module when no angles are supplied);
 *   - apply rotation around **Z** by `rotationXZ` degrees;
 *   - then apply rotation around **X** by `BASELINE_YZ_ROTATION + rotationYZ`
 *     degrees (the same baseline 180° flip the offset module always adds).
 *
 * Order matches `offset/`: Z first, then X.
 */
function resolveDirection(opts: SweptMeshOptions): { dir: Vec3Like; rotXZ: number; rotYZ: number } {
  const rotXZ = opts.rotationXZ ?? 0;
  const rotYZ = opts.rotationYZ ?? 0;

  if (opts.direction) {
    const v = new THREE.Vector3(opts.direction.x, opts.direction.y, opts.direction.z);
    if (v.lengthSq() < 1e-20) throw new Error('Sweep direction is the zero vector');
    v.normalize();
    return { dir: { x: v.x, y: v.y, z: v.z }, rotXZ, rotYZ };
  }

  const v = new THREE.Vector3(DEFAULT_SWEEP_DIRECTION.x, DEFAULT_SWEEP_DIRECTION.y, DEFAULT_SWEEP_DIRECTION.z);
  const actualYZ = BASELINE_YZ_ROTATION + rotYZ;
  const m = new THREE.Matrix4();
  if (rotXZ !== 0)    m.multiply(new THREE.Matrix4().makeRotationZ(rotXZ    * DEG));
  if (actualYZ !== 0) m.multiply(new THREE.Matrix4().makeRotationX(actualYZ * DEG));
  v.applyMatrix4(m);
  v.normalize();
  return { dir: { x: v.x, y: v.y, z: v.z }, rotXZ, rotYZ };
}

/**
 * Build a `THREE.BufferGeometry` from a triangle-soup `Float32Array`.
 * Matches the input convention used by `offset/offsetMeshProcessor.createOffsetMesh`.
 */
function geometryFromVertexArray(vertices: Float32Array): THREE.BufferGeometry {
  if (!vertices || vertices.length === 0) throw new Error('No vertices provided');
  if (vertices.length % 9 !== 0) {
    throw new Error(
      `Vertex array length (${vertices.length}) is not a multiple of 9 ` +
      `(3 floats × 3 vertices per triangle).`
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}

// ============================================
// Public API
// ============================================

/**
 * Build a watertight swept-volume mesh from a triangle-soup vertex array.
 *
 * Pipeline:
 *   1. Optional 3D mesh offset (per-vertex pseudonormal displacement).
 *   2. Slice along the sweep direction at `layerHeight` spacing → 2D profiles.
 *   3. Optional monotone forward-union of profiles.
 *   4. Loft profiles into a watertight mesh (walls + shelves + caps).
 *
 * @param vertices Triangle-soup vertices (xyz per vertex, 9 floats per triangle).
 * @param options  See `SweptMeshOptions`.
 * @returns        `{ geometry, metadata }`.
 */
export async function createSweptMesh(
  vertices: Float32Array,
  options: SweptMeshOptions = {}
): Promise<SweptMeshResult> {
  // ── Validate ─────────────────────────────────────────────────────────────
  reportProgress(options.progressCallback, PROGRESS.VALIDATE, 'Validating input');
  if (!vertices || vertices.length === 0) throw new Error('No vertices provided');

  const cfg = {
    layerHeight:    options.layerHeight    ?? DEFAULT_SWEEP_SETTINGS.layerHeight,
    offsetDistance: options.offsetDistance ?? DEFAULT_SWEEP_SETTINGS.offsetDistance,
    contourOffset:  options.contourOffset  ?? DEFAULT_SWEEP_SETTINGS.contourOffset,
    accumulate:     options.accumulate     ?? DEFAULT_SWEEP_SETTINGS.accumulate,
    limitMin:       options.limitMin       ?? null,
    limitMax:       options.limitMax       ?? null,
    progressCallback: options.progressCallback ?? null,
  };

  if (cfg.layerHeight <= 0) throw new Error('layerHeight must be positive');

  // ── Resolve direction ────────────────────────────────────────────────────
  reportProgress(cfg.progressCallback, PROGRESS.RESOLVE_DIR, 'Resolving sweep direction');
  const { dir, rotXZ, rotYZ } = resolveDirection(options);

  const t0 = performance.now();
  const timings = { offset: 0, extract: 0, accumulate: 0, loft: 0 };

  // ── Step 0: Mesh offset (optional) ───────────────────────────────────────
  let geom = geometryFromVertexArray(vertices);
  const inputTriangles = geom.attributes.position.count / 3;

  if (Math.abs(cfg.offsetDistance) > 1e-10) {
    reportProgress(cfg.progressCallback, PROGRESS.OFFSET, 'Offsetting mesh vertices');
    await yieldToBrowser();
    const tA = performance.now();
    geom = offsetMeshVerts(geom, cfg.offsetDistance);
    timings.offset = performance.now() - tA;
  }

  // ── Step 1: Extract per-slice contours ───────────────────────────────────
  reportProgress(cfg.progressCallback, PROGRESS.EXTRACT, 'Extracting cross-section contours');
  await yieldToBrowser();
  const tB = performance.now();
  let contour = extractContour(geom, dir, {
    layerHeight: cfg.layerHeight,
    offset:      cfg.contourOffset,
    limitMin:    cfg.limitMin,
    limitMax:    cfg.limitMax,
  });
  timings.extract = performance.now() - tB;

  // ── Step 1b: Accumulate (optional) ───────────────────────────────────────
  if (cfg.accumulate) {
    reportProgress(cfg.progressCallback, PROGRESS.ACCUMULATE, 'Accumulating contour profiles');
    await yieldToBrowser();
    const tC = performance.now();
    contour = accumulateContours(contour);
    timings.accumulate = performance.now() - tC;
  }

  // ── Step 1c: Loft to watertight mesh ─────────────────────────────────────
  reportProgress(cfg.progressCallback, PROGRESS.LOFT, 'Lofting contour stack');
  await yieldToBrowser();
  const tD = performance.now();
  const outGeom: THREE.BufferGeometry = loftContoursToMesh(contour);
  timings.loft = performance.now() - tD;

  // ── Finalize ─────────────────────────────────────────────────────────────
  reportProgress(cfg.progressCallback, PROGRESS.FINALIZE, 'Finalizing mesh');
  outGeom.computeBoundingBox();
  outGeom.computeBoundingSphere();

  const vertexCount   = outGeom.getAttribute('position').count;
  const triangleCount = outGeom.index ? outGeom.index.count / 3 : vertexCount / 3;

  const metadata: SweptMeshMetadata = {
    direction:      dir,
    rotationXZ:     rotXZ,
    rotationYZ:     rotYZ,
    layerHeight:    cfg.layerHeight,
    offsetDistance: cfg.offsetDistance,
    contourOffset:  cfg.contourOffset,
    accumulate:     cfg.accumulate,

    inputVertices:  vertices.length / 3,
    inputTriangles,
    vertexCount,
    triangleCount,

    totalSlices:        contour.stats.totalSlices,
    slicesWithContours: contour.stats.slicesWithContours,
    loops:              contour.stats.loops,
    profileShapes:      contour.stats.profileShapes,
    mergedExtrusions:   contour.stats.mergedExtrusions,

    processingTime: performance.now() - t0,
    timings,
  };

  reportProgress(cfg.progressCallback, PROGRESS.COMPLETE, 'Complete');
  return { geometry: outGeom, metadata };
}

/**
 * Run the slice + accumulate pipeline and return the final accumulated
 * silhouette polygon together with the local basis vectors.
 *
 * The last merged-slice polygon is the maximum-footprint cross-section of
 * the mesh swept along `options.direction` — a monotonically grown union of
 * all per-layer profiles. Callers can extrude this polygon into a prismatic
 * cutter without the staircase artifacts produced by `createSweptMesh`.
 *
 * Returns `null` if no cross-sections are found.
 */
export async function extractSilhouetteContour(
  vertices: Float32Array,
  options: SweptMeshOptions = {}
): Promise<{
  /** Final accumulated silhouette polygon (MultiPolygon — outer ring first, holes after). */
  poly: [number, number][][][];
  /** First local axis of the slicing plane, in world space. */
  lx: THREE.Vector3;
  /** Second local axis of the slicing plane, in world space. */
  ly: THREE.Vector3;
} | null> {
  if (!vertices || vertices.length === 0) return null;

  const cfg = {
    layerHeight:   options.layerHeight   ?? DEFAULT_SWEEP_SETTINGS.layerHeight,
    contourOffset: options.contourOffset ?? DEFAULT_SWEEP_SETTINGS.contourOffset,
  };

  const { dir } = resolveDirection(options);

  const geom = geometryFromVertexArray(vertices);
  await yieldToBrowser();

  let contour = extractContour(geom, dir, {
    layerHeight: cfg.layerHeight,
    offset:      cfg.contourOffset,
  });
  contour = accumulateContours(contour);

  if (!contour.mergedSlices || contour.mergedSlices.length === 0) return null;

  const lastSlice = contour.mergedSlices[contour.mergedSlices.length - 1];
  if (!lastSlice?.poly) return null;

  return {
    poly: lastSlice.poly as [number, number][][][],
    lx:   contour.lx as THREE.Vector3,
    ly:   contour.ly as THREE.Vector3,
  };
}

// ============================================
// Utility
// ============================================

/**
 * Extract the underlying `Float32Array` from a `THREE.BufferGeometry` for
 * passing into `createSweptMesh`. Mirrors `offset/offsetMeshProcessor.extractVertices`.
 *
 * If the geometry is indexed, it is expanded to a non-indexed triangle soup
 * (a defensive copy — caller's geometry is not mutated).
 */
export function extractVertices(geometry: THREE.BufferGeometry): Float32Array {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const arr = g.getAttribute('position').array as Float32Array;
  // Always return a fresh, non-shared buffer so the caller can transfer it
  // to a worker without neutering the source geometry.
  return new Float32Array(arr);
}
