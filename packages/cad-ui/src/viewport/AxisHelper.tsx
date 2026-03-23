/**
 * AxisHelper — Axis indicator lines for the 3D viewport floor
 *
 * Renders colored axis lines on the XZ plane (Three.js Y-up).
 * Default: red for X-axis, green for Z-axis (CAD Y), positioned
 * slightly above the grid to prevent z-fighting.
 *
 * @module @rapidtool/cad-ui/viewport
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AxisHelperProps {
  /** Length of each axis line in both directions from origin */
  length?: number;
  /** X-axis color (default: 0xff4444 red) */
  xColor?: number;
  /** Z-axis color (default: 0x44ff44 green) */
  zColor?: number;
  /** Y offset above ground plane to prevent z-fighting */
  yOffset?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AxisHelper: React.FC<AxisHelperProps> = ({
  length = 500,
  xColor = 0xff4444,
  zColor = 0x44ff44,
  yOffset = 0.01,
}) => {
  const xLine = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-length, 0, 0, length, 0, 0], 3),
    );
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: xColor }));
  }, [length, xColor]);

  const zLine = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, -length, 0, 0, length], 3),
    );
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color: zColor }));
  }, [length, zColor]);

  return (
    <group position={[0, yOffset, 0]}>
      <primitive object={xLine} />
      <primitive object={zLine} />
    </group>
  );
};
