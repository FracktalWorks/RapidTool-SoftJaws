/**
 * useUI — App-level UI hook wrapping cad-ui's useUIStore
 */

import { useCallback } from 'react';
import { useUIStore } from '@rapidtool/cad-ui';

export function useUI() {
  const store = useUIStore();

  const toggleSidebar = useCallback(
    () => store.togglePanel('leftSidebar'),
    [store]
  );

  const toggleContextPanel = useCallback(
    () => store.togglePanel('rightSidebar'),
    [store]
  );

  const toggleGrid = useCallback(
    () => store.toggleViewportOption('showGrid'),
    [store]
  );

  const toggleAxes = useCallback(
    () => store.toggleViewportOption('showAxes'),
    [store]
  );

  const toggleWireframe = useCallback(
    () => store.toggleViewportOption('showWireframe'),
    [store]
  );

  const toggleDebugMode = useCallback(
    () => store.toggleDebugOption('showDebugInfo'),
    [store]
  );

  const togglePerformanceStats = useCallback(
    () => store.toggleDebugOption('showStats'),
    [store]
  );

  return {
    theme: store.theme,
    setTheme: store.setTheme,
    panels: store.panels,
    toggleSidebar,
    toggleContextPanel,
    togglePanel: store.togglePanel,
    viewport: store.viewport,
    toggleGrid,
    toggleAxes,
    toggleWireframe,
    toggleViewportOption: store.toggleViewportOption,
    debug: store.debug,
    toggleDebugMode,
    togglePerformanceStats,
    toggleDebugOption: store.toggleDebugOption,
    reset: store.reset,
  };
}
