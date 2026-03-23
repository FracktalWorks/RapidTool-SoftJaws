/**
 * useTransformGizmo
 *
 * Main composite hook that provides everything needed to wire up PivotControls
 * for any entity type. This is the primary API surface — applications compose
 * their domain-specific transform controls by calling this hook and spreading
 * the returned props onto &lt;PivotControls&gt;.
 *
 * Composes:
 *   - TransformController   (cad-core constraint engine)
 *   - useDragState           (anti-jitter position lock)
 *   - useGizmoPosition       (scale/position calculation)
 *   - useOrbitLock            (orbit control lock)
 *   - useTransformCursor     (canvas cursor management)
 *
 * @example
 * ```tsx
 * const gizmo = useTransformGizmo({
 *   config: JAW_TRANSFORM_CONFIG,
 *   entityId: jaw.id,
 *   entityType: 'jaw',
 *   componentData: { width: jaw.width },
 *   currentPosition: jawPosition,
 *   onTransformChange: (output) => updateJaw(output),
 * });
 *
 * <PivotControls {...gizmo.pivotProps}>
 *   <mesh ref={meshRef} />
 * </PivotControls>
 * ```
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

import { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  TransformController,
  dispatchTransformUpdate,
  resetPivotMatrix,
  type TransformConfig,
  type TransformOutput,
  type TransformCallbacks,
} from '@rapidtool/cad-core';

import { useDragState } from './useDragState';
import { useGizmoPosition } from './useGizmoPosition';
import { useOrbitLock } from './useTransformControls';
import { useTransformCursor } from './useTransformControls';

// ============================================================================
// Types
// ============================================================================

export interface UseTransformGizmoOptions extends TransformCallbacks {
  /** Transform config defining constraints and behavior */
  config: TransformConfig;
  /** Unique entity identifier (for event dispatch) */
  entityId?: string;
  /** Entity type string (for gizmo position/scale heuristics and event naming) */
  entityType: string;
  /** Data bag passed to gizmo position/scale calculators */
  componentData: Record<string, unknown>;
  /** Current world position of the entity */
  currentPosition: THREE.Vector3;
  /** Current rotation (optional, defaults to identity) */
  currentRotation?: THREE.Euler;
  /** Override gizmo scale */
  customGizmoScale?: number | 'auto';
}

/**
 * Props that can be spread directly onto drei's <PivotControls>.
 */
export interface PivotControlsProps {
  /** Active translation axes derived from constraints */
  activeAxes: [boolean, boolean, boolean];
  /** Whether rotation is disabled */
  disableRotations: boolean;
  /** Whether scaling is disabled */
  disableScaling: boolean;
  /** Gizmo size */
  scale: number;
  /** Drag start handler */
  onDragStart: () => void;
  /** Drag handler — apply constraints and dispatch updates */
  onDrag: (
    localMatrix: THREE.Matrix4,
    deltaLocalMatrix: THREE.Matrix4,
    worldMatrix: THREE.Matrix4,
    deltaWorldMatrix: THREE.Matrix4
  ) => void;
  /** Drag end handler */
  onDragEnd: () => void;
}

export interface UseTransformGizmoReturn {
  /** Ref to attach to <PivotControls ref={...}> */
  pivotRef: React.RefObject<THREE.Group>;
  /** Instantiated TransformController */
  controller: TransformController;
  /** Calculated gizmo position (use for <group position={...}>) */
  gizmoPosition: THREE.Vector3;
  /** Calculated gizmo scale */
  gizmoScale: number;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Display position (locked during drag to prevent jitter) */
  displayPosition: THREE.Vector3;
  /** Props to spread onto <PivotControls> */
  pivotProps: PivotControlsProps;
  /** Manually fire a transform update event */
  emitUpdate: () => void;
}

// ============================================================================
// Temp objects (reused, NOT refs — pure math)
// ============================================================================

const _position = new THREE.Vector3();
const _rotation = new THREE.Euler();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();

// ============================================================================
// Hook
// ============================================================================

export function useTransformGizmo(options: UseTransformGizmoOptions): UseTransformGizmoReturn {
  const {
    config,
    entityId,
    entityType,
    componentData,
    currentPosition,
    currentRotation,
    customGizmoScale,
    onTransformStart,
    onTransformChange,
    onTransformEnd,
    onActivate,
    onDeactivate,
  } = options;

  // --- TransformController (constraint engine) ---
  const controller = useMemo(() => new TransformController(config), [config]);

  // --- Pivot ref ---
  const pivotRef = useRef<THREE.Group>(null!);

  // --- Drag state (anti-jitter) ---
  const dragState = useDragState({
    disableOrbitOnDrag: config.disableOrbitOnDrag ?? true,
    onDragStart: onTransformStart,
  });

  // --- Gizmo position & scale ---
  const gizmoPos = useGizmoPosition({
    componentType: entityType,
    data: componentData,
    customScale: customGizmoScale ?? config.gizmoScale,
  });

  // --- Orbit lock + cursor ---
  const { lockOrbit, unlockOrbit } = useOrbitLock();
  const { setCursor, resetCursor } = useTransformCursor();

  // --- Emit a manual transform update event ---
  const emitUpdate = useCallback(() => {
    if (entityId) {
      dispatchTransformUpdate(entityType, entityId);
    }
  }, [entityType, entityId]);

  // --- Derived PivotControls configuration ---
  const activeAxes = useMemo(() => controller.getActiveAxes(), [controller]);
  const disableRotations = useMemo(() => !controller.hasRotation(), [controller]);
  const disableScaling = useMemo(() => !controller.hasScale(), [controller]);

  // --- Drag handlers ---
  const handleDragStart = useCallback(() => {
    lockOrbit();
    setCursor('grabbing');
    dragState.handleDragStart(currentPosition);
    onActivate?.();
  }, [lockOrbit, setCursor, dragState, currentPosition, onActivate]);

  const handleDrag = useCallback(
    (
      localMatrix: THREE.Matrix4,
      _deltaLocalMatrix: THREE.Matrix4,
      worldMatrix: THREE.Matrix4,
      _deltaWorldMatrix: THREE.Matrix4
    ) => {
      // Decompose the world matrix produced by PivotControls
      worldMatrix.decompose(_position, _quaternion, _scale);
      _rotation.setFromQuaternion(_quaternion, config.useYXZEulerOrder ? 'YXZ' : 'XYZ');

      // Apply constraints through the controller
      const constrained = controller.applyConstraints({
        position: _position,
        rotation: _rotation,
        scale: _scale,
      });

      const output: TransformOutput = {
        position: constrained.position,
        rotation: constrained.rotation,
        scale: constrained.scale,
      };

      // Extract Y rotation if using YXZ order (common for top-down / turntable rotation)
      if (config.useYXZEulerOrder) {
        output.rotationY = controller.extractYRotation(constrained.rotation);
      }

      onTransformChange?.(output);
    },
    [controller, config.useYXZEulerOrder, onTransformChange]
  );

  const handleDragEnd = useCallback(() => {
    unlockOrbit();
    resetCursor();

    if (pivotRef.current) {
      resetPivotMatrix(pivotRef.current);
    }

    dragState.handleDragEnd(pivotRef);

    // Final transform snapshot
    const finalOutput: TransformOutput = {
      position: currentPosition.clone(),
      rotation: currentRotation?.clone() ?? new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
    };

    onTransformEnd?.(finalOutput);
    onDeactivate?.();
    emitUpdate();
  }, [
    unlockOrbit,
    resetCursor,
    dragState,
    currentPosition,
    currentRotation,
    onTransformEnd,
    onDeactivate,
    emitUpdate,
  ]);

  // --- Display position (locked during drag to prevent jitter) ---
  const displayPosition = dragState.getDisplayPosition(currentPosition);

  return {
    pivotRef,
    controller,
    gizmoPosition: gizmoPos.gizmoPosition,
    gizmoScale: gizmoPos.gizmoScale,
    isDragging: dragState.isDraggingRef.current,
    displayPosition,
    pivotProps: {
      activeAxes,
      disableRotations,
      disableScaling,
      scale: gizmoPos.gizmoScale,
      onDragStart: handleDragStart,
      onDrag: handleDrag,
      onDragEnd: handleDragEnd,
    },
    emitUpdate,
  };
}
