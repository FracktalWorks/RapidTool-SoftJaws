import type { ProcessedPart } from '@/stores/types';
import type { CachedGeometry } from '@/stores/geometryCache';

export interface ParseResult {
  /** Parsed metadata — excludes transform, which useImport injects before addPart */
  meta: Omit<ProcessedPart, 'transform'>;
  geometry: CachedGeometry;
}

export interface ImportError {
  fileName: string;
  message: string;
}
