import { useCallback } from 'react';
import { useSoftJawsStore } from '../stores/softJawsStore';

/**
 * Lightweight undo/redo using Zustand's temporal middleware pattern.
 * SoftJaws uses immer — here we expose a simple snapshot-based undo
 * until a full history store is wired.
 *
 * For now this exposes canUndo/canRedo/undo/redo placeholders that
 * components can bind to. Wire to useHistoryStore from @rapidtool/cad-ui
 * when the compute graph is introduced.
 */
export function useUndoRedo() {
  // Placeholder: no-op until history store is wired
  const canUndo = false;
  const canRedo = false;

  const undo = useCallback(() => {
    console.warn('[SoftJaws] Undo not yet wired to history store');
  }, []);

  const redo = useCallback(() => {
    console.warn('[SoftJaws] Redo not yet wired to history store');
  }, []);

  return { canUndo, canRedo, undo, redo };
}

export function useUndoStack() {
  return useSoftJawsStore(() => [] as unknown[]);
}

export function useRedoStack() {
  return useSoftJawsStore(() => [] as unknown[]);
}
