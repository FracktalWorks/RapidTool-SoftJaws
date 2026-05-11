/**
 * softJawsStore — Main domain store for soft jaw configuration
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geometryCache } from './geometryCache';
import type {
  SoftJawsState,
  ProcessedPart,
  PartTransform,
  JawBlankConfig,
  JawProfileConfig,
  GripFeaturesConfig,
  MountingHolesConfig,
  ExportConfig,
} from './types';

const INITIAL_STATE: SoftJawsState = {
  parts: [],
  activePart: null,
  clampGap: 0.01,
  jawBlank: {
    face: 150.0,       // Z, matches jawWidth
    height: 65.0,      // Y, matches jawHeight
    thickness: 30.0,   // X stick-out from carriage — typical soft-jaw stock
    material: 'aluminum-6061',
  },
  jawProfile: {
    clearance: 0.1,
    depth: 20,
    generated: false,
  },
  gripFeatures: {
    pattern: 'none',
    depth: 0.5,
    spacing: 2,
  },
  mountingHoles: {
    pattern: 'standard',
    boltSize: 8,
    // Default matches the initial vise's tSlotSpacing (125 mm — Kurt-style
    // 6" CNC vise). Updated automatically when a vise preset is applied;
    // see ViseConfigStepContent.handlePresetSelect.
    spacing: 125,
    count: 2,
    generated: false,
  },
  exportConfig: {
    format: 'stl',
    quality: 'high',
  },
};

export interface SoftJawsActions {
  addPart: (part: ProcessedPart) => void;
  removePart: (id: string) => void;
  setActivePart: (id: string | null) => void;
  updatePartTransform: (id: string, transform: Partial<PartTransform>) => void;
  updateJawBlank: (config: Partial<JawBlankConfig>) => void;
  updateJawProfile: (config: Partial<JawProfileConfig>) => void;
  updateGripFeatures: (config: Partial<GripFeaturesConfig>) => void;
  updateMountingHoles: (config: Partial<MountingHolesConfig>) => void;
  updateExportConfig: (config: Partial<ExportConfig>) => void;
  reset: () => void;
}

export type SoftJawsStore = SoftJawsState & SoftJawsActions;

export const useSoftJawsStore = create<SoftJawsStore>()(
  devtools(
    immer((set) => ({
      ...INITIAL_STATE,

      // Any change to a CSG input invalidates the cached profile — the baked
      // world-space mesh in geometryCache (JAW_PROFILE_*) was built against
      // the OLD state and no longer matches what the user sees. Leaving
      // `generated: true` would render the wrong jaw and export the wrong STL.
      addPart: (part) =>
        set((state) => {
          state.parts.push(part);
          if (!state.activePart) state.activePart = part.id;
          state.jawProfile.generated = false;
        }),

      removePart: (id) => {
        // Pair the state update with cache deletion — CLAUDE.md Invariant 2.
        // Float32Arrays in geometryCache live outside the store; without this
        // delete, removed parts leak ~MB of geometry until page reload.
        geometryCache.delete(id);
        set((state) => {
          state.parts = state.parts.filter((p) => p.id !== id);
          if (state.activePart === id) {
            state.activePart = state.parts[0]?.id ?? null;
          }
          state.jawProfile.generated = false;
        });
      },

      setActivePart: (id) =>
        set((state) => {
          state.activePart = id;
          state.jawProfile.generated = false;
        }),

      updatePartTransform: (id, transform) =>
        set((state) => {
          const part = state.parts.find((p) => p.id === id);
          if (!part) return;
          if (transform.position) Object.assign(part.transform.position, transform.position);
          if (transform.rotation) Object.assign(part.transform.rotation, transform.rotation);
          state.jawProfile.generated = false;
        }),

      updateJawBlank: (config) =>
        set((state) => {
          Object.assign(state.jawBlank, config);
          state.jawProfile.generated = false;
        }),

      updateJawProfile: (config) =>
        set((state) => {
          // Invalidate when a CSG-input field changes, but allow the
          // hook to set `generated: true` after a successful run.
          const csgInputChanged =
            (config.clearance !== undefined && config.clearance !== state.jawProfile.clearance) ||
            (config.depth     !== undefined && config.depth     !== state.jawProfile.depth);
          Object.assign(state.jawProfile, config);
          if (csgInputChanged) state.jawProfile.generated = false;
        }),

      updateGripFeatures: (config) =>
        set((state) => {
          Object.assign(state.gripFeatures, config);
        }),

      updateMountingHoles: (config) =>
        set((state) => {
          Object.assign(state.mountingHoles, config);
        }),

      updateExportConfig: (config) =>
        set((state) => {
          Object.assign(state.exportConfig, config);
        }),

      reset: () => set(INITIAL_STATE),
    })),
    { name: 'softjaws' }
  )
);


