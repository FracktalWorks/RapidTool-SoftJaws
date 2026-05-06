/**
 * CADViewport — Turnkey 3D viewport for CAD applications
 *
 * Provides a complete React Three Fiber canvas with:
 * - Orthographic camera (standard CAD projection)
 * - Dual-layer grid (minor + major lines) on the XZ floor plane
 * - Colored axis lines (X red, Z green)
 * - GizmoHelper with GizmoViewport (labels remapped for CAD Z-up display)
 * - OrbitControls (rotate, pan, zoom)
 * - Default three-point lighting
 * - NavigationHelp tooltip (dismissible)
 * - Children slot for domain-specific scene content
 *
 * Internally uses Three.js Y-up convention. GizmoViewport labels
 * are remapped to ['X', 'Z', 'Y'] so the display reads as CAD Z-up.
 *
 * @module @rapidtool/cad-ui/viewport
 *
 * @example
 * import { CADViewport } from '@rapidtool/cad-ui';
 *
 * function MyScene() {
 *   return (
 *     <CADViewport isDark={false}>
 *       <mesh><boxGeometry /><meshStandardMaterial /></mesh>
 *     </CADViewport>
 *   );
 * }
 */

import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { NavigationHelp } from './NavigationHelp';
import { AxisHelper } from './AxisHelper';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CADViewportCameraConfig {
  position?: [number, number, number];
  zoom?: number;
  near?: number;
  far?: number;
}

export interface CADViewportGridConfig {
  size?: number;
  divisions?: number;
  majorDivisions?: number;
}

export interface CADViewportProps {
  /** Whether dark mode is active */
  isDark?: boolean;
  /** Background color override (default: auto from isDark) */
  backgroundColor?: string;
  /** Camera configuration overrides */
  camera?: CADViewportCameraConfig;
  /** Whether to show the floor grid (default: true) */
  showGrid?: boolean;
  /** Grid configuration */
  grid?: CADViewportGridConfig;
  /** Whether to show axis lines (default: true) */
  showAxes?: boolean;
  /** Whether to show the gizmo orientation helper (default: true) */
  showGizmo?: boolean;
  /** Gizmo axis labels (default: ['X', 'Z', 'Y'] for CAD Z-up display) */
  gizmoLabels?: [string, string, string];
  /** Gizmo axis colors */
  gizmoAxisColors?: [string, string, string];
  /** Whether to show the navigation help tooltip (default: true) */
  showNavigationHelp?: boolean;
  /** LocalStorage key for navigation help dismissal */
  navigationHelpKey?: string;
  /** Domain-specific scene content */
  children?: React.ReactNode;
  /** Overlay content rendered on top of the canvas (e.g. empty states) */
  overlay?: React.ReactNode;
  /** Additional CSS class for the wrapper div */
  className?: string;
}

// ─── Default Grid Colors ─────────────────────────────────────────────────────

const GRID_COLORS = {
  dark: {
    minor: '#2a2a3a',
    major: '#4a4a5a',
    center: '#3a3a4a',
  },
  light: {
    minor: '#e8e8e8',
    major: '#a0a0a0',
    center: '#d0d0d0',
  },
};

// ─── Inner Scene ─────────────────────────────────────────────────────────────

interface SceneContentProps {
  isDark: boolean;
  showGrid: boolean;
  grid: Required<CADViewportGridConfig>;
  showAxes: boolean;
  showGizmo: boolean;
  gizmoLabels: [string, string, string];
  gizmoAxisColors: [string, string, string];
  children?: React.ReactNode;
}

function SceneContent({
  isDark,
  showGrid,
  grid,
  showAxes,
  showGizmo,
  gizmoLabels,
  gizmoAxisColors,
  children,
}: SceneContentProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const colors = isDark ? GRID_COLORS.dark : GRID_COLORS.light;

  // Toggle OrbitControls during PivotControls drag so they don't fight.
  useEffect(() => {
    const handler = (e: Event) => {
      const { disabled } = (e as CustomEvent<{ disabled: boolean }>).detail;
      if (controlsRef.current) controlsRef.current.enabled = !disabled;
    };
    window.addEventListener('disable-orbit-controls', handler);
    return () => window.removeEventListener('disable-orbit-controls', handler);
  }, []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.9} />
      <hemisphereLight args={[0xffffff, 0x888888, 0.4]} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Grid on XZ floor plane */}
      {showGrid && (
        <group position={[0, -0.01, 0]}>
          {/* Minor grid */}
          <gridHelper
            args={[grid.size, grid.divisions, colors.center, colors.minor]}
          />
          {/* Major grid */}
          <gridHelper
            args={[
              grid.size,
              Math.floor(grid.divisions / grid.majorDivisions),
              colors.major,
              colors.major,
            ]}
            position={[0, 0.001, 0]}
          />
        </group>
      )}

      {/* Axis lines */}
      {showAxes && <AxisHelper />}

      {/* Gizmo orientation helper */}
      {showGizmo && (
        <GizmoHelper alignment="top-right" margin={[80, 80]}>
          <GizmoViewport
            axisColors={gizmoAxisColors}
            labels={gizmoLabels}
            labelColor="white"
          />
        </GizmoHelper>
      )}

      {/* OrbitControls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={0.01}
        maxDistance={Infinity}
        enableDamping={false}
      />

      {/* Domain-specific content */}
      {children}
    </>
  );
}

// ─── CADViewport Component ───────────────────────────────────────────────────

export const CADViewport: React.FC<CADViewportProps> = ({
  isDark = false,
  backgroundColor,
  camera,
  showGrid = true,
  grid,
  showAxes = true,
  showGizmo = true,
  gizmoLabels = ['X', 'Z', 'Y'],
  gizmoAxisColors = ['#ff4060', '#40ff60', '#4080ff'],
  showNavigationHelp = true,
  navigationHelpKey = 'cad-viewport-nav-tooltip-dismissed',
  children,
  overlay,
  className = '',
}) => {
  const bg = backgroundColor ?? (isDark ? '#1a1a2e' : '#ffffff');

  const cameraConfig = {
    position: camera?.position ?? [8, 8, 8] as [number, number, number],
    zoom: camera?.zoom ?? 38,
    near: camera?.near ?? -2000,
    far: camera?.far ?? 2000,
  };

  const gridConfig: Required<CADViewportGridConfig> = {
    size: grid?.size ?? 200,
    divisions: grid?.divisions ?? 200,
    majorDivisions: grid?.majorDivisions ?? 10,
  };

  return (
    <div className={`w-full h-full relative ${className}`}>
      <Canvas
        orthographic
        camera={cameraConfig}
        style={{ background: bg }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <SceneContent
          isDark={isDark}
          showGrid={showGrid}
          grid={gridConfig}
          showAxes={showAxes}
          showGizmo={showGizmo}
          gizmoLabels={gizmoLabels}
          gizmoAxisColors={gizmoAxisColors}
        >
          {children}
        </SceneContent>
      </Canvas>

      {/* Overlay content (empty states, etc.) */}
      {overlay}

      {/* Navigation help tooltip */}
      {showNavigationHelp && (
        <NavigationHelp storageKey={navigationHelpKey} />
      )}
    </div>
  );
};
