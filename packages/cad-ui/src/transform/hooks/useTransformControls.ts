/**
 * useTransformControls
 *
 * Hooks for managing side-effects during gizmo interaction:
 *   - Cursor styling (pointer → grab → grabbing)
 *   - Orbit control lock during drag
 *
 * These are low-level hooks composed by useTransformGizmo, but can also
 * be used standalone for custom gizmo implementations.
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

import { useEffect, useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { setOrbitControlsEnabled } from '@rapidtool/cad-core';

// ============================================================================
// Orbit Control Lock
// ============================================================================

export interface UseOrbitLockReturn {
  lockOrbit: () => void;
  unlockOrbit: () => void;
}

/**
 * Provides lock/unlock helpers for orbit controls.
 * Tracks lock state to prevent double-unlock.
 */
export function useOrbitLock(): UseOrbitLockReturn {
  const isLockedRef = useRef(false);

  const lockOrbit = useCallback(() => {
    if (!isLockedRef.current) {
      isLockedRef.current = true;
      setOrbitControlsEnabled(false);
    }
  }, []);

  const unlockOrbit = useCallback(() => {
    if (isLockedRef.current) {
      isLockedRef.current = false;
      setOrbitControlsEnabled(true);
    }
  }, []);

  // Always unlock on unmount
  useEffect(() => {
    return () => {
      if (isLockedRef.current) setOrbitControlsEnabled(true);
    };
  }, []);

  return { lockOrbit, unlockOrbit };
}

// ============================================================================
// Cursor Management
// ============================================================================

export type CursorState = 'auto' | 'pointer' | 'grab' | 'grabbing';

export interface UseTransformCursorReturn {
  setCursor: (state: CursorState) => void;
  resetCursor: () => void;
}

/**
 * Manages cursor styling on the WebGL canvas element.
 * Resets to 'auto' on unmount to prevent cursor leaks.
 */
export function useTransformCursor(): UseTransformCursorReturn {
  const { gl } = useThree();

  const setCursor = useCallback(
    (state: CursorState) => {
      gl.domElement.style.cursor = state;
    },
    [gl.domElement]
  );

  const resetCursor = useCallback(() => {
    gl.domElement.style.cursor = 'auto';
  }, [gl.domElement]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      gl.domElement.style.cursor = 'auto';
    };
  }, [gl.domElement]);

  return { setCursor, resetCursor };
}
