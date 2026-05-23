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

import { Suspense, useState, useEffect } from 'react';
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
import { JawBoltDecorations } from './3DScene/JawBoltDecorations';
import { CavityPreview } from './3DScene/CavityPreview';

/** Offline-safe lighting fallback — matches warehouse HDRI tone */
function OfflineLighting() {
  return (
    <>
      <ambientLight intensity={0.4} color="#e8e0d8" />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#fff5ee" />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#d0d8e8" />
    </>
  );
}

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark       = resolvedTheme === 'dark';
  const profileReady = useSoftJawsStore((s) => s.jawProfile.generated);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      showGrid={false}
    >
      {/* HDRI for realistic metallic reflections — falls back to local lights offline */}
      {isOnline ? (
        <Suspense fallback={<OfflineLighting />}>
          <Environment preset="warehouse" background={false} />
        </Suspense>
      ) : (
        <OfflineLighting />
      )}

      {/* Fits the camera whenever a new part is imported */}
      <CameraController />

      {/* Procedural parametric vise (drawing-spec geometry) */}
      <ViseModel />

      {/*
        * Show the jaw blank until the CSG profile is generated,
        * then replace it with the profiled result mesh.
        */}
      {profileReady ? <JawProfileMesh /> : <JawBlankMesh />}

      {/* Bracket back-face bolt-exit decoration — factory hardware,
          always visible from frame 1. */}
      <PillarBoltDecals />

      {/* Jaw inner-face counterbore preview — shows where Step-6 CSG will
          drill the mounting holes. Hides itself once the real holes are
          in the JAW_HOLED cache (the geometry then carries the holes). */}
      <JawBoltDecorations />

      {/* Step-4 cavity preview — translucent ghost of the workpiece swept
          into each jaw by `pocket depth`. Hides itself once the profile
          CSG has run (JawProfileMesh then renders the real cavity). */}
      <CavityPreview />

      {/* Imported workpiece meshes */}
      <PartMeshes />
    </CADViewport>
  );
}
