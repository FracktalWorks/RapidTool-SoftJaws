import type { ProcessedPart } from '@/stores/types';
import type { CachedGeometry } from '@/stores/geometryCache';

export interface ParseResult {
  meta: ProcessedPart;
  geometry: CachedGeometry;
}

export interface ImportError {
  fileName: string;
  message: string;
}
