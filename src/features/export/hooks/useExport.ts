/**
 * useExport — Triggers a browser download of the final jaw design.
 *
 * Export priority:
 *   1. If the jaw profile has been generated → export the CSG result geometry
 *      (jaw blank with cavity) from geometryCache.
 *   2. Otherwise → export the jaw blank box geometry as raw stock.
 *
 * STL is fully supported via cad-core's meshToSTL + downloadFile.
 * 3MF export is not yet implemented in cad-core and returns an error message.
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { meshToSTL, downloadFile } from '@rapidtool/cad-core';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { geometryCache, JAW_PROFILE_CACHE_KEY } from '@/stores/geometryCache';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseExportReturn {
  status: ExportStatus;
  error: string | null;
  exportJaw: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a THREE.Mesh from the jaw profile CSG result in the geometry cache. */
function buildProfileMesh(jawHeight: number): THREE.Mesh | null {
  const cached = geometryCache.get(JAW_PROFILE_CACHE_KEY);
  if (!cached) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cached.positions.slice(), 3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals.slice(),   3));

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(0, jawHeight / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** Builds a THREE.Mesh for the raw jaw blank box. */
function buildBlankMesh(width: number, height: number, depth: number): THREE.Mesh {
  const geo  = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(0, height / 2, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExport(): UseExportReturn {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { jawBlank, jawProfile, exportConfig } = useSoftJawsStore();

  const exportJaw = useCallback(() => {
    if (exportConfig.format === '3mf') {
      setError('3MF export is not yet implemented. Please select STL.');
      return;
    }

    setStatus('running');
    setError(null);

    // Defer so the "running" state renders before the synchronous STL work
    setTimeout(() => {
      try {
        // Prefer the generated profile; fall back to the raw blank
        const mesh = jawProfile.generated
          ? buildProfileMesh(jawBlank.height)
          : null;

        const exportMesh = mesh ?? buildBlankMesh(
          jawBlank.width,
          jawBlank.height,
          jawBlank.depth,
        );

        const stlData = meshToSTL(exportMesh, { binary: true });
        const filename = `SoftJaw_RapidTool.stl`;
        downloadFile(stlData, filename, 'application/sla');

        setStatus('success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown export error.';
        console.error('[useExport] Export failed:', err);
        setError(msg);
        setStatus('error');
      }
    }, 0);
  }, [jawBlank, jawProfile, exportConfig]);

  return { status, error, exportJaw };
}
