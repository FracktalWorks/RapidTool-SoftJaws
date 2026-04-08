import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { performHoleCSGInWorker } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '../../../stores/softJawsStore';
import { geometryCache } from '../../../stores/geometryCache';
import { useProcessingStore } from '../../../stores/processingStore';
import { dispatchAppEvent, EVENTS } from '../../../core/events';
import { logger } from '../../../utils/logger';
import { JAW_PROFILE_RESULT_KEY } from '../../jaw-profile/hooks/useJawProfile';

export const MOUNTING_HOLES_RESULT_KEY = 'mounting-holes-result';

export interface UseMountingHolesReturn {
  isApplying: boolean;
  error: string | null;
  hasResult: boolean;
  applyHoles: () => Promise<void>;
  clearResult: () => void;
}

/**
 * Punches mounting holes into the jaw profile result geometry using the
 * off-thread CSG hole worker.
 */
export function useMountingHoles(): UseMountingHolesReturn {
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(
    () => geometryCache.has(MOUNTING_HOLES_RESULT_KEY),
  );

  const mountingHoles = useSoftJawsStore((s) => s.mountingHoles);
  const jawBlank = useSoftJawsStore((s) => s.jawBlank);

  const setProcessing = useProcessingStore((s) => s.setProcessing);
  const setProgress = useProcessingStore((s) => s.setProgress);

  const applyHoles = useCallback(async () => {
    setIsApplying(true);
    setError(null);
    setProcessing(true, 'Punching mounting holes…');
    setProgress(5);

    try {
      // Resolve base geometry — prefer jaw-profile result, fall back to blank
      const baseCache =
        geometryCache.get(JAW_PROFILE_RESULT_KEY) ??
        geometryCache.get('jaw-blank-fallback');

      let baseGeo: THREE.BufferGeometry;

      if (baseCache) {
        baseGeo = new THREE.BufferGeometry();
        baseGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(baseCache.positions, 3),
        );
        if (baseCache.normals.length > 0) {
          baseGeo.setAttribute(
            'normal',
            new THREE.BufferAttribute(baseCache.normals, 3),
          );
        }
      } else {
        // Fallback: just punch holes through a solid blank
        baseGeo = new THREE.BoxGeometry(
          jawBlank.width / 1000,
          jawBlank.height / 1000,
          jawBlank.depth / 1000,
        );
      }

      setProgress(20);

      // Build merged holes geometry
      const holeMeshes: THREE.BufferGeometry[] = [];
      const count = Math.max(1, Math.min(mountingHoles.count ?? 4, 8));
      const spacing = (mountingHoles.spacing ?? 20) / 1000;
      const boltRadius =
        (mountingHoles.boltSize === 'M5'
          ? 2.5
          : mountingHoles.boltSize === 'M6'
            ? 3
            : mountingHoles.boltSize === 'M8'
              ? 4
              : 3) / 1000;

      const holeDepth = (jawBlank.height / 1000) * 1.1; // slightly taller than blank

      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * spacing;
        const holeGeo = new THREE.CylinderGeometry(
          boltRadius,
          boltRadius,
          holeDepth,
          16,
        );
        holeGeo.translate(x, 0, 0);
        holeMeshes.push(holeGeo);
      }

      // Merge all hole cylinders into one geometry
      const mergedHoles = mergeGeometries(holeMeshes);
      holeMeshes.forEach((g) => g.dispose());

      setProgress(35);

      const result = await performHoleCSGInWorker(
        baseGeo,
        mergedHoles,
        (progress) => setProgress(35 + Math.round(progress * 50)),
      );

      mergedHoles.dispose();
      baseGeo.dispose();

      if (!result) {
        throw new Error('Hole CSG worker returned null.');
      }

      setProgress(90);

      const pos = result.attributes.position.array as Float32Array;
      const norm =
        (result.attributes.normal?.array as Float32Array) ??
        new Float32Array(pos.length);
      geometryCache.set(MOUNTING_HOLES_RESULT_KEY, {
        positions: pos,
        normals: norm,
        faceCount: pos.length / 9,
      });

      result.dispose();
      setHasResult(true);
      dispatchAppEvent(EVENTS.MOUNTING_HOLES_CHANGED, {});
      logger.info('Mounting holes applied successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      logger.error('Mounting holes CSG failed:', msg);
    } finally {
      setProgress(100);
      setProcessing(false);
      setIsApplying(false);
    }
  }, [mountingHoles, jawBlank, setProcessing, setProgress]);

  const clearResult = useCallback(() => {
    geometryCache.delete(MOUNTING_HOLES_RESULT_KEY);
    setHasResult(false);
  }, []);

  return { isApplying, error, hasResult, applyHoles, clearResult };
}

/** Merge multiple BufferGeometries into one by concatenating position arrays. */
function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: Float32Array[] = [];
  let totalCount = 0;
  for (const g of geos) {
    const pos = g.attributes.position.array as Float32Array;
    positions.push(pos);
    totalCount += pos.length;
  }
  const merged = new Float32Array(totalCount);
  let offset = 0;
  for (const p of positions) {
    merged.set(p, offset);
    offset += p.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(merged, 3));
  out.computeVertexNormals();
  return out;
}
