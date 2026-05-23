/**
 * Swept Volume Processor — Module Exports
 *
 * Mirrors the structure of `offset/index.ts` so this folder can drop into
 * `packages/cad-core/src/sweep/` and be re-exported from the cad-core
 * barrel with a single `export * from './sweep'`.
 */

// High-level API (matches `createOffsetMesh` shape)
export { createSweptMesh, extractSilhouetteContour } from './sweepProcessor';
// Renamed to avoid collision with `offset/extractVertices`
export { extractVertices as extractVerticesForSweep } from './sweepProcessor';

// Types & defaults
export type {
  Vec3Like,
  SweptMeshOptions,
  SweptMeshResult,
  SweptMeshMetadata,
} from './types';
export {
  DEFAULT_SWEEP_SETTINGS,
  DEFAULT_SWEEP_DIRECTION,
  BASELINE_YZ_ROTATION,
  SWEEP_DIRECTION_PRESETS,
} from './types';
