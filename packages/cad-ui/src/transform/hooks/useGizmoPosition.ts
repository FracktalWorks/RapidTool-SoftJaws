/**
 * useGizmoPosition
 *
 * Calculates gizmo position and scale based on component type and data.
 * Uses the cad-core utility functions but memoizes them for React.
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  calculateGizmoScale,
  calculateGizmoPosition,
  type TransformComponentType,
} from '@rapidtool/cad-core';

// ============================================================================
// Types
// ============================================================================

export interface UseGizmoPositionOptions {
  /** Component type for determining position/scale heuristics */
  componentType: TransformComponentType;
  /** Component-specific data for position/scale calculation */
  data: Record<string, unknown>;
  /** Override scale ('auto' uses the heuristic, number uses fixed) */
  customScale?: number | 'auto';
}

export interface UseGizmoPositionReturn {
  /** Calculated gizmo world position */
  gizmoPosition: THREE.Vector3;
  /** Calculated gizmo scale */
  gizmoScale: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useGizmoPosition(options: UseGizmoPositionOptions): UseGizmoPositionReturn {
  const { componentType, data, customScale } = options;

  const gizmoPosition = useMemo(
    () => calculateGizmoPosition(componentType, data),
    [componentType, data]
  );

  const gizmoScale = useMemo(() => {
    if (typeof customScale === 'number') return customScale;
    return calculateGizmoScale(componentType, data);
  }, [componentType, data, customScale]);

  return { gizmoPosition, gizmoScale };
}
