/**
 * useExport — Downloads the final jaw pair as two STL files.
 *
 * Cache key priority per side (falls back down the chain):
 *   JAW_HOLED_*   — profile pocket + mounting holes drilled  (best)
 *   JAW_PROFILE_* — profile pocket only, no holes
 *   raw blank box — nothing generated yet (fallback)
 *
 * Geometry stored under JAW_HOLED_* and JAW_PROFILE_* is already baked
 * to world-space coordinates by the CSG pipeline, so the mesh must have
 * an identity transform (no extra position applied).
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { meshToSTL, downloadFile } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import {
  geometryCache,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
  type CachedGeometry,
} from '@/stores/geometryCache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseExportReturn {
  status:     ExportStatus;
  error:      string | null;
  exportJaws: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Geometry is already in world space — mesh stays at origin so STLExporter
// does not apply an extra matrixWorld offset.
function cachedToMesh(cached: CachedGeometry): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cached.positions.slice(), 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals.slice(),   3));
  if (cached.indices) {
    geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
  }
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
}

// Raw stock blank centered at origin — used as last-resort fallback.
function buildBlankMesh(thickness: number, height: number, face: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(thickness, height, face);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExport(): UseExportReturn {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const jawBlank    = useSoftJawsStore((s) => s.jawBlank);
  const exportConfig = useSoftJawsStore((s) => s.exportConfig);

  const exportJaws = useCallback(() => {
    if (exportConfig.format === '3mf') {
      setError('3MF export is not yet implemented. Please select STL.');
      return;
    }

    setStatus('running');
    setError(null);

    // Defer so "running" state renders before the synchronous STL work.
    setTimeout(() => {
      try {
        const sides = [
          { label: 'Left',  holedKey: JAW_HOLED_CACHE_KEY_LEFT,  profileKey: JAW_PROFILE_CACHE_KEY_LEFT  },
          { label: 'Right', holedKey: JAW_HOLED_CACHE_KEY_RIGHT, profileKey: JAW_PROFILE_CACHE_KEY_RIGHT },
        ] as const;

        for (const { label, holedKey, profileKey } of sides) {
          const cached = geometryCache.get(profileKey) ?? geometryCache.get(holedKey);
          const mesh   = cached
            ? cachedToMesh(cached)
            : buildBlankMesh(jawBlank.thickness, jawBlank.height, jawBlank.face);

          const stlData = meshToSTL(mesh, { binary: true });
          downloadFile(stlData, `SoftJaw-${label}.stl`, 'application/sla');
        }

        setStatus('success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown export error.';
        console.error('[useExport] Export failed:', err);
        setError(msg);
        setStatus('error');
      }
    }, 0);
  }, [jawBlank, exportConfig]);

  return { status, error, exportJaws };
}
