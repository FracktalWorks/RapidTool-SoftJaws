// ============================================
// Workers Module Exports
// ============================================

export { 
  performBatchCSGSubtractionInWorker,
  performCSGSubtractionInWorker,
  performBatchCSGUnionInWorker,
  performRealCSGUnionInWorker,
  performClampCSGInWorker,
  performHoleCSGInWorker,
  terminateHoleCSGWorker,
  serializeGeometryForClampWorker,
  extractGeometryForWorker,
  reconstructGeometry,
  terminateWorkers
} from './workerManager';
export { suppressDeprecatedMaxLeafTrisWarning } from './suppressBvhWarnings';

export type { CSGWorkerInput, CSGWorkerOutput } from './csgWorker';
export type { OffsetMeshWorkerInput, OffsetMeshWorkerOutput } from './offsetMeshWorker';
