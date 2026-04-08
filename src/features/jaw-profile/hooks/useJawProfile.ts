import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { performCSGSubtractionInWorker } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '../../../stores/softJawsStore';
import { geometryCache } from '../../../stores/geometryCache';
import { useProcessingStore } from '../../../stores/processingStore';
import { dispatchAppEvent, EVENTS } from '../../../core/events';
import { logger } from '../../../utils/logger';

/** Geometry cache key for the jaw-blank-with-cavity result. */
export const JAW_PROFILE_RESULT_KEY = 'jaw-profile-result';

export interface UseJawProfileReturn {
  isGenerating: boolean;
  error: string | null;
  hasResult: boolean;
  generateProfile: () => Promise<void>;
  clearResult: () => void;
}

/**
 * Subtracts a cavity (derived from the imported part's bounding box, scaled by
 * clearance) from the jaw blank box geometry using the off-thread CSG worker.
 */
export function useJawProfile(): UseJawProfileReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(
    () => geometryCache.has(JAW_PROFILE_RESULT_KEY),
  );

  const jawBlank = useSoftJawsStore((s) => s.jawBlank);
  const jawProfile = useSoftJawsStore((s) => s.jawProfile);
  const activePart = useSoftJawsStore((s) => s.activePart);
  const parts = useSoftJawsStore((s) => s.parts);

  const setProcessing = useProcessingStore((s) => s.setProcessing);
  const setProgress = useProcessingStore((s) => s.setProgress);

  const generateProfile = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    dispatchAppEvent(EVENTS.CSG_STARTED, {});
    setProcessing(true, 'Generating jaw profile…');
    setProgress(5);

    const start = performance.now();

    try {
      // 1. Build the jaw blank as a THREE.BoxGeometry
      const blankGeo = new THREE.BoxGeometry(
        jawBlank.width / 1000,  // mm → m for Three.js
        jawBlank.height / 1000,
        jawBlank.depth / 1000,
      );
      const blankMesh = new THREE.Mesh(blankGeo);

      setProgress(15);

      // 2. Build the cavity cutter from the active part or jaw profile dims
      let cavityGeo: THREE.BufferGeometry;

      const partId = activePart ?? parts[0]?.id ?? null;
      const cached = partId ? geometryCache.get(partId) : null;

      if (cached) {
        // Reconstruct part geometry to derive bounding box
        const partGeo = new THREE.BufferGeometry();
        partGeo.setAttribute(
          'position',
          new THREE.BufferAttribute(cached.positions, 3),
        );
        partGeo.computeBoundingBox();
        const box = partGeo.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);

        // Cavity = part bounding-box + clearance on each side
        const clearance = (jawProfile.clearance ?? 0.1) / 1000;
        cavityGeo = new THREE.BoxGeometry(
          size.x + clearance * 2,
          size.y + clearance * 2,
          jawProfile.depth / 1000,
        );
        // Position cavity centred at the blank top face
        cavityGeo.translate(0, (jawBlank.height / 2000) - (jawProfile.depth / 2000), 0);

        partGeo.dispose();
      } else {
        // No part imported: cavity from jaw profile dimensions directly
        cavityGeo = new THREE.BoxGeometry(
          (jawBlank.width * 0.6) / 1000,
          jawProfile.depth / 1000,
          (jawBlank.depth * 0.8) / 1000,
        );
        cavityGeo.translate(0, (jawBlank.height / 2000) - (jawProfile.depth / 2000), 0);
      }

      setProgress(30);

      // 3. CSG subtract in worker
      const result = await performCSGSubtractionInWorker(
        blankMesh.geometry,
        cavityGeo,
        'jaw-blank',
      );

      cavityGeo.dispose();
      blankGeo.dispose();

      if (!result) {
        throw new Error('CSG worker returned null — check part geometry.');
      }

      setProgress(85);

      // 4. Cache the result
      const pos = result.attributes.position.array as Float32Array;
      const norm = result.attributes.normal?.array as Float32Array ?? new Float32Array(pos.length);
      geometryCache.set(JAW_PROFILE_RESULT_KEY, {
        positions: pos,
        normals: norm,
        faceCount: pos.length / 9,
      });

      result.dispose();
      setHasResult(true);

      const durationMs = performance.now() - start;
      dispatchAppEvent(EVENTS.CSG_COMPLETED, { durationMs });
      logger.info('Jaw profile CSG completed in', Math.round(durationMs), 'ms');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      dispatchAppEvent(EVENTS.CSG_FAILED, { error: msg });
      logger.error('Jaw profile CSG failed:', msg);
    } finally {
      setProgress(100);
      setProcessing(false);
      setIsGenerating(false);
    }
  }, [jawBlank, jawProfile, activePart, parts, setProcessing, setProgress]);

  const clearResult = useCallback(() => {
    geometryCache.delete(JAW_PROFILE_RESULT_KEY);
    setHasResult(false);
  }, []);

  return { isGenerating, error, hasResult, generateProfile, clearResult };
}
