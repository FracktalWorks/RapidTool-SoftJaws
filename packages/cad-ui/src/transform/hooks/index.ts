/**
 * Transform hooks — public API
 *
 * Composable hooks for building transform gizmos:
 *
 *   useTransformGizmo     — Main composite hook (start here)
 *   useDragState           — Anti-jitter position lock during drag
 *   useGizmoPosition       — Gizmo position/scale calculation
 *   useDeselection         — Escape, click-outside, pivot-conflict deselection
 *   useTransformControls   — Orbit lock + cursor management
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

// Composite hook (primary API surface)
export { useTransformGizmo } from './useTransformGizmo';
export type {
  UseTransformGizmoOptions,
  UseTransformGizmoReturn,
  PivotControlsProps,
} from './useTransformGizmo';

// Drag state (anti-jitter)
export { useDragState } from './useDragState';
export type { UseDragStateOptions, UseDragStateReturn } from './useDragState';

// Gizmo position/scale
export { useGizmoPosition } from './useGizmoPosition';
export type { UseGizmoPositionOptions, UseGizmoPositionReturn } from './useGizmoPosition';

// Deselection behaviors
export {
  useEscapeDeselect,
  useClickOutsideDeselect,
  usePivotConflictDeselect,
} from './useDeselection';
export type {
  UseClickOutsideDeselectionOptions,
  PivotConflictOptions,
} from './useDeselection';

// Low-level controls
export { useOrbitLock, useTransformCursor } from './useTransformControls';
export type {
  UseOrbitLockReturn,
  UseTransformCursorReturn,
  CursorState,
} from './useTransformControls';
