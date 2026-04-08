import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { exportPartsToSTL, downloadFile } from '@rapidtool/cad-core';
import { geometryCache } from '../../../stores/geometryCache';
import { useProcessingStore } from '../../../stores/processingStore';
import { dispatchAppEvent, EVENTS } from '../../../core/events';
import { logger } from '../../../utils/logger';
import { MOUNTING_HOLES_RESULT_KEY } from '../../mounting-holes/hooks/useMountingHoles';
import { JAW_PROFILE_RESULT_KEY } from '../../jaw-profile/hooks/useJawProfile';

export type ExportFormat = 'stl-binary' | 'stl-ascii';

export interface UseExportReturn {
  isExporting: boolean;
  error: string | null;
  exportJaw: (format?: ExportFormat) => Promise<void>;
}

/**
 * Exports the final soft jaw geometry to a downloadable STL file.
 * Prefers mounting-holes result, falls back to jaw-profile result.
 */
export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setProcessing = useProcessingStore((s) => s.setProcessing);
  const setProgress = useProcessingStore((s) => s.setProgress);

  const exportJaw = useCallback(
    async (format: ExportFormat = 'stl-binary') => {
      setIsExporting(true);
      setError(null);
      dispatchAppEvent(EVENTS.EXPORT_STARTED, { format });
      setProcessing(true, 'Exporting jaw…');
      setProgress(10);

      try {
        const cached =
          geometryCache.get(MOUNTING_HOLES_RESULT_KEY) ??
          geometryCache.get(JAW_PROFILE_RESULT_KEY);

        if (!cached) {
          throw new Error(
            'No jaw geometry to export. Generate the profile first.',
          );
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          'position',
          new THREE.BufferAttribute(cached.positions, 3),
        );
        if (cached.normals.length > 0) {
          geo.setAttribute(
            'normal',
            new THREE.BufferAttribute(cached.normals, 3),
          );
        }

        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());

        setProgress(40);

        const binary = format === 'stl-binary';
        const result = exportPartsToSTL(
          [{ mesh, name: 'soft-jaw' }],
          {
            filename: 'soft-jaw',
            format: 'stl',
            splitParts: false,
            options: { binary },
          },
          (_current, _total, filename) => {
            logger.debug('Exporting:', filename);
            setProgress(70);
          },
        );

        setProgress(90);

        if (!result.success) {
          throw new Error(result.error ?? 'Export failed');
        }

        // exportPartsToSTL triggers download internally; this is the fallback
        // if it returns data instead.
        logger.info('Export completed');

        const sizeBytes = cached.positions.byteLength + cached.normals.byteLength;
        dispatchAppEvent(EVENTS.EXPORT_COMPLETED, { format, sizeBytes });

        geo.dispose();
        (mesh.material as THREE.Material).dispose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        dispatchAppEvent(EVENTS.EXPORT_FAILED, { error: msg });
        logger.error('Export failed:', msg);
      } finally {
        setProgress(100);
        setProcessing(false);
        setIsExporting(false);
      }
    },
    [setProcessing, setProgress],
  );

  return { isExporting, error, exportJaw };
}
