import type { ProcessedPart } from '@/stores/types';
import type { CachedGeometry } from '@/stores/geometryCache';

export interface ParseResult {
  /** Parsed metadata */
  meta: ProcessedPart;
  geometry: CachedGeometry;
}

export interface ImportError {
  fileName: string;
  message: string;
}
