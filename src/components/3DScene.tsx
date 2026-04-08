/**
 * 3DScene — Main 3D viewport for RapidTool Soft Jaws
 *
 * Wraps the generic CADViewport from cad-ui and injects domain meshes:
 * - JawBlankMesh: the jaw blank box (or CSG result when generated)
 * - CavityPreviewMesh: translucent preview of the cavity to be cut
 * - PartMeshes: imported reference parts highlighted in the scene
 */

import { Suspense } from 'react';
import { useTheme } from 'next-themes';
import { CADViewport } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '../stores/softJawsStore';
import { JawBlankMesh } from './3DScene/JawBlankMesh';
import { CavityPreviewMesh } from './3DScene/CavityPreviewMesh';
import { PartMeshes } from './3DScene/PartMeshes';
import { geometryCache } from '../stores/geometryCache';
import { JAW_PROFILE_RESULT_KEY } from '../features/jaw-profile/hooks/useJawProfile';

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const parts = useSoftJawsStore((s) => s.parts);
  const hasJawResult = geometryCache.has(JAW_PROFILE_RESULT_KEY);
  const hasNothingToShow = parts.length === 0 && !hasJawResult;

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      overlay={
        hasNothingToShow ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center tech-glass p-6 rounded-lg border border-border/50">
              <h3 className="font-tech font-semibold text-lg mb-2">
                3D Viewport
              </h3>
              <p className="text-sm text-muted-foreground font-tech">
                Upload a 3D model to start designing soft jaws
              </p>
            </div>
          </div>
        ) : undefined
      }
    >
      <Suspense fallback={null}>
        {/* Jaw blank / CSG result */}
        <JawBlankMesh />

        {/* Cavity preview (shown before CSG is run) */}
        {!hasJawResult && <CavityPreviewMesh />}

        {/* Imported reference parts */}
        <PartMeshes />
      </Suspense>
    </CADViewport>
  );
}
