/**
 * Scene3D — Main 3D viewport for RapidTool Soft Jaws
 *
 * Wraps cad-ui's CADViewport and composes domain-specific scene content
 * inside the R3F Canvas:
 *   - Environment   : warehouse HDRI envMap so metallic materials reflect
 *   - ViseModel     : procedural parametric CNC vise (drawing-spec)
 *   - JawBlankMesh  : jaw blank box driven by jawBlank store state
 *   - JawProfileMesh: replaces jaw blank after CSG profile is generated
 *   - PartMeshes    : renders imported STL parts from the geometry cache
 *   - PillarBoltDecals: visible exit-hole decals on pillar back faces
 *                       (only after mounting holes have been drilled)
 */

import { Environment } from '@react-three/drei';
import { useTheme } from 'next-themes';
import { CADViewport } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { CameraController } from './3DScene/CameraController';
import { ViseModel } from './3DScene/ViseModel';
import { JawBlankMesh } from './3DScene/JawBlankMesh';
import { JawProfileMesh } from './3DScene/JawProfileMesh';
import { PartMeshes } from './3DScene/PartMeshes';
import { PillarBoltDecals } from './3DScene/PillarBoltDecals';

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark       = resolvedTheme === 'dark';
  const profileReady = useSoftJawsStore((s) => s.jawProfile.generated);

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      showGrid={false}
    >
      {/* HDRI for realistic metallic reflections — invisible (no background swap) */}
      <Environment preset="warehouse" background={false} />

      {/* Fits the camera whenever a new part is imported */}
      <CameraController />

      {/* Procedural parametric vise (drawing-spec geometry) */}
      <ViseModel />

      {/*
        * Show the jaw blank until the CSG profile is generated,
        * then replace it with the profiled result mesh.
        */}
      {profileReady ? <JawProfileMesh /> : <JawBlankMesh />}

      {/* Visible exit-hole decals on pillar back faces — no-op until
          mounting holes have been drilled. */}
      <PillarBoltDecals />

      {/* Imported workpiece meshes */}
      <PartMeshes />
    </CADViewport>
  );
}
