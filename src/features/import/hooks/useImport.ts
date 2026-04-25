import { useState, useCallback } from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { geometryCache } from '@/stores/geometryCache';
import { parseSTL } from '../utils/parseSTL';

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB
const ACCEPTED_EXTENSIONS = ['.stl'];

export function useImport() {
  const { parts, addPart, removePart: storeRemovePart } = useSoftJawsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const importFile = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Max 200 MB.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await parseSTL(file);
      geometryCache.set(result.meta.id, result.geometry);
      addPart({
        ...result.meta,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
    } finally {
      setIsLoading(false);
    }
  }, [addPart]);

  const removePart = useCallback((id: string) => {
    geometryCache.delete(id);
    storeRemovePart(id);
  }, [storeRemovePart]);

  const clearError = useCallback(() => setError(null), []);

  return { parts, importFile, removePart, isLoading, error, clearError };
}
