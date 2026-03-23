/**
 * useDeselection
 *
 * Hooks for handling transform control deselection via various input methods.
 * These are generic behaviors shared by ALL transform gizmo variants:
 *   - Escape key closes gizmo
 *   - Clicking UI elements outside canvas closes gizmo
 *   - Clicking anywhere outside canvas closes gizmo (strict mode)
 *   - Another pivot control activation closes this one
 *
 * @module @rapidtool/cad-ui/transform/hooks
 */

import { useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';

// ============================================================================
// UI Click Selectors
// ============================================================================

/** Default selectors for UI elements that should trigger deselection */
const DEFAULT_UI_SELECTORS =
  'button, input, select, [role="button"], [role="slider"], [data-radix-collection-item], [class*="accordion"]';

// ============================================================================
// Escape Key Hook
// ============================================================================

/**
 * Calls onDeselect when Escape key is pressed.
 * Used by all transform controls for keyboard deselection.
 */
export function useEscapeDeselect(onDeselect: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onDeselect();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeselect]);
}

// ============================================================================
// Click Outside Hooks
// ============================================================================

export interface UseClickOutsideDeselectionOptions {
  /** Selectors that, when clicked, trigger deselection (default: standard UI elements) */
  uiSelectors?: string;
  /** Selectors to ignore — clicks on these elements will NOT trigger deselection */
  ignoreSelectors?: string;
  /** If true, ANY click outside canvas deselects (not just UI elements) */
  strict?: boolean;
}

/**
 * Deselects when clicking outside the 3D canvas.
 *
 * In default mode, only clicks on recognized UI elements (buttons, inputs, etc.)
 * trigger deselection. In strict mode, any click outside canvas deselects.
 */
export function useClickOutsideDeselect(
  onDeselect: () => void,
  options: UseClickOutsideDeselectionOptions = {}
): void {
  const { gl } = useThree();
  const {
    uiSelectors = DEFAULT_UI_SELECTORS,
    ignoreSelectors,
    strict = false,
  } = options;

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Allow clicks on canvas (for camera controls)
      if (gl.domElement.contains(target) || gl.domElement === target) return;

      // Ignore specified selectors (tutorial popovers, overlays, etc.)
      if (ignoreSelectors && target.closest(ignoreSelectors)) return;

      if (strict) {
        // Strict mode: any click outside canvas deselects
        onDeselect();
      } else {
        // Default mode: only UI element clicks deselect
        if (target.closest(uiSelectors)) {
          onDeselect();
        }
      }
    };

    document.addEventListener('mousedown', handleDocumentClick, true);
    return () => document.removeEventListener('mousedown', handleDocumentClick, true);
  }, [onDeselect, gl.domElement, uiSelectors, ignoreSelectors, strict]);
}

// ============================================================================
// Pivot Conflict Hook
// ============================================================================

export interface PivotConflictOptions {
  /** Current entity ID (to skip self-deselection) */
  entityId?: string;
  /** Entity type key used in the pivot-control-activated event detail */
  entityType: string;
  /** Custom event name (default: 'pivot-control-activated') */
  eventName?: string;
}

/**
 * Deselects when another pivot control is activated.
 * Prevents multiple pivot controls from being active simultaneously.
 *
 * Listens for `pivot-control-activated` events. If the event's detail
 * contains a different entity ID for the same entity type, deselects this one.
 */
export function usePivotConflictDeselect(
  onDeselect: () => void,
  options: PivotConflictOptions
): void {
  const { entityId, entityType, eventName = 'pivot-control-activated' } = options;

  useEffect(() => {
    const handleOtherActivated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      // If the activated entity is of the same type but different ID, deselect
      const activatedId = detail[`${entityType}Id`] ?? detail.partId ?? detail.id;

      // If no entityId specified, always deselect when another activates
      if (!entityId || activatedId !== entityId) {
        onDeselect();
      }
    };

    window.addEventListener(eventName, handleOtherActivated);
    return () => window.removeEventListener(eventName, handleOtherActivated);
  }, [onDeselect, entityId, entityType, eventName]);
}
