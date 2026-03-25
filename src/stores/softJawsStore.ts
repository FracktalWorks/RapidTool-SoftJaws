/**
 * softJawsStore — Main domain store for soft jaw configuration
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  SoftJawsState,
  ProcessedPart,
  ViseConfig,
  JawBlankConfig,
  JawProfileConfig,
  GripFeaturesConfig,
  MountingHolesConfig,
  ExportConfig,
} from './types';

const INITIAL_STATE: SoftJawsState = {
  parts: [],
  activePart: null,
  viseConfig: {
    type: 'kurt-d60',
    jawWidth: 152.4,  // 6"
    jawHeight: 38.1,  // 1.5"
    jawStroke: 152.4, // 6"
  },
  jawBlank: {
    width: 150,
    height: 50,
    depth: 40,
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
    spacing: 50,
    count: 2,
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
  updateViseConfig: (config: Partial<ViseConfig>) => void;
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

      addPart: (part) =>
        set((state) => {
          state.parts.push(part);
          if (!state.activePart) state.activePart = part.id;
        }),

      removePart: (id) =>
        set((state) => {
          state.parts = state.parts.filter((p) => p.id !== id);
          if (state.activePart === id) {
            state.activePart = state.parts[0]?.id ?? null;
          }
        }),

      setActivePart: (id) =>
        set((state) => {
          state.activePart = id;
        }),

      updateViseConfig: (config) =>
        set((state) => {
          Object.assign(state.viseConfig, config);
        }),

      updateJawBlank: (config) =>
        set((state) => {
          Object.assign(state.jawBlank, config);
        }),

      updateJawProfile: (config) =>
        set((state) => {
          Object.assign(state.jawProfile, config);
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
