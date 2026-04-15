/**
 * Scene3D — Main 3D viewport for RapidTool Soft Jaws
 *
 * Wraps cad-ui's CADViewport and composes domain-specific scene content
 * inside the R3F Canvas:
 *   - ViseModel     : procedural parametric CNC vise, always visible
 *   - JawBlankMesh  : jaw blank box driven by jawBlank store state
 *   - JawProfileMesh: replaces jaw blank after CSG profile is generated
 *   - PartMeshes    : renders imported STL parts from the geometry cache
 *
 * The vise is always visible as the foundational context geometry.
 * The empty-state overlay is shown only when no parts have been imported.
 */

import { useTheme } from 'next-themes';
import { CADViewport } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { CameraController } from './3DScene/CameraController';
import { ViseModel } from './3DScene/ViseModel';
import { JawBlankMesh } from './3DScene/JawBlankMesh';
import { JawProfileMesh } from './3DScene/JawProfileMesh';
import { PartMeshes } from './3DScene/PartMeshes';

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark        = resolvedTheme === 'dark';
  const hasParts      = useSoftJawsStore((s) => s.parts.length > 0);
  const profileReady  = useSoftJawsStore((s) => s.jawProfile.generated);

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      overlay={
        !hasParts ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center tech-glass p-6 rounded-lg border border-border/50">
              <h3 className="font-tech font-semibold text-lg mb-2">3D Viewport</h3>
              <p className="text-sm text-muted-foreground font-tech">
                Select a vise, then import your workpiece to start designing soft jaws
              </p>
            </div>
          </div>
        ) : undefined
      }
    >
      {/* Fits the camera whenever a new part is imported */}
      <CameraController />

      {/* Procedural parametric vise — always visible as the base context */}
      <ViseModel />

      {/*
        * Show the jaw blank until the CSG profile is generated,
        * then replace it with the profiled result mesh.
        */}
      {profileReady ? <JawProfileMesh /> : <JawBlankMesh />}

      {/* Imported workpiece meshes */}
      <PartMeshes />
    </CADViewport>
  );
}
