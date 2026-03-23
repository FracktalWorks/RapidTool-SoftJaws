/**
 * useDragState
 *
 * Manages drag state for transform controls with anti-jitter position locking.
 *
 * CRITICAL: This implements the "drag start position lock" pattern
 * that prevents jittering during drag operations. Without this,
 * the gizmo group position feeds back into itself each frame,
 * causing visual jitter.
 *
 * Pattern:
 * 1. On drag start: Lock the display position to current value
 * 2. During drag: Use locked position for display (prevents feedback loop)
 * 3. On drag end: Reset pivot matrix to identity, unlock position
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { setOrbitControlsEnabled, resetPivotMatrix } from '@rapidtool/cad-core';

// ============================================================================
// Types
// ============================================================================

export interface UseDragStateOptions {
  /** Whether to disable orbit controls during drag (default: true) */
  disableOrbitOnDrag?: boolean;
  /** Called when drag starts */
  onDragStart?: () => void;
  /** Called when drag ends */
  onDragEnd?: () => void;
}

export interface UseDragStateReturn {
  /** Ref indicating current drag state */
  isDraggingRef: React.MutableRefObject<boolean>;
  /** Ref to drag-start position (for locking) */
  dragStartPosRef: React.MutableRefObject<THREE.Vector3 | null>;
  /** Call when drag starts — locks display position */
  handleDragStart: (currentPosition: THREE.Vector3) => void;
  /** Call when drag ends — resets pivot and unlocks position */
  handleDragEnd: (pivotRef: React.RefObject<THREE.Object3D>) => void;
  /** Returns locked position during drag, or current position otherwise */
  getDisplayPosition: (currentPosition: THREE.Vector3) => THREE.Vector3;
}

// ============================================================================
// Hook
// ============================================================================

export function useDragState(options: UseDragStateOptions = {}): UseDragStateReturn {
  const { disableOrbitOnDrag = true, onDragStart, onDragEnd } = options;

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null);

  const handleDragStart = useCallback((currentPosition: THREE.Vector3) => {
    isDraggingRef.current = true;
    // LOCK the display position to prevent feedback loop
    dragStartPosRef.current = currentPosition.clone();

    if (disableOrbitOnDrag) {
      setOrbitControlsEnabled(false);
    }

    onDragStart?.();
  }, [disableOrbitOnDrag, onDragStart]);

  const handleDragEnd = useCallback((pivotRef: React.RefObject<THREE.Object3D>) => {
    isDraggingRef.current = false;
    dragStartPosRef.current = null;

    // CRITICAL: Reset pivot to identity after drag
    if (pivotRef.current) {
      resetPivotMatrix(pivotRef.current);
    }

    if (disableOrbitOnDrag) {
      setOrbitControlsEnabled(true);
    }

    onDragEnd?.();
  }, [disableOrbitOnDrag, onDragEnd]);

  const getDisplayPosition = useCallback((currentPosition: THREE.Vector3): THREE.Vector3 => {
    // During drag, use the LOCKED position for display
    if (isDraggingRef.current && dragStartPosRef.current) {
      return dragStartPosRef.current;
    }
    return currentPosition;
  }, []);

  return {
    isDraggingRef,
    dragStartPosRef,
    handleDragStart,
    handleDragEnd,
    getDisplayPosition,
  };
}
