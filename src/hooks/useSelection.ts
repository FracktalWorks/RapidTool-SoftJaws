/**
 * useSelection — App-level selection hook wrapping cad-ui's useSelectionStore
 */

import { useCallback } from 'react';
import { useSelectionStore } from '@rapidtool/cad-ui';

export function useSelection() {
  const store = useSelectionStore();

  const selectPart = useCallback(
    (id: string) => {
      store.select('part', id);
    },
    [store]
  );

  const selectJaw = useCallback(
    (id: string) => {
      store.select('jaw', id);
    },
    [store]
  );

  return {
    selected: store.selected,
    multiSelected: store.multiSelected,
    transformTarget: store.transformTarget,
    isMultiSelectMode: store.isMultiSelectMode,
    selectPart,
    selectJaw,
    clearSelection: store.clear,
    toggleSelection: store.toggleSelection,
    isSelected: store.isSelected,
  };
}
