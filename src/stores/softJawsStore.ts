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
    clearance: 0.2,
    depth: 5,
    generated: false,
  },
  gripFeatures: {
    pattern: 'none',
    depth: 0.5,
    spacing: 2,
  },
  mountingHoles: {
    pattern: 'standard',
    boltSize: 10,           // Screw diameter M10 default
    screwheadHeight: 2.0,   // default 2mm
    screwheadDiameter: 22.0,// default 22mm
    spacing: 100,           // default 100mm
    holesHeight: 17.0,      // default 17mm
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

          // Snapshot BEFORE mutation for change detection.
          const px = part.transform.position.x, py = part.transform.position.y, pz = part.transform.position.z;
          const rx = part.transform.rotation.x, ry = part.transform.rotation.y, rz = part.transform.rotation.z;

          if (transform.position) Object.assign(part.transform.position, transform.position);
          if (transform.rotation) Object.assign(part.transform.rotation, transform.rotation);

          // Only invalidate the jaw profile when the part actually moved — not on
          // the bake-back call that SelectableTransformControls fires on gizmo close
          // with the same world position (which would erase a freshly generated profile).
          const EPS = 0.001;
          const moved =
            Math.abs(part.transform.position.x - px) > EPS ||
            Math.abs(part.transform.position.y - py) > EPS ||
            Math.abs(part.transform.position.z - pz) > EPS ||
            Math.abs(part.transform.rotation.x - rx) > EPS ||
            Math.abs(part.transform.rotation.y - ry) > EPS ||
            Math.abs(part.transform.rotation.z - rz) > EPS;

          if (moved) state.jawProfile.generated = false;
        }),

      updateJawBlank: (config) =>
        set((state) => {
          Object.assign(state.jawBlank, config);
          state.jawProfile.generated = false;
          state.mountingHoles.generated = false;
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
          const geomFields: Array<keyof MountingHolesConfig> = [
            'boltSize',
            'screwheadHeight',
            'screwheadDiameter',
            'spacing',
            'holesHeight',
            'count',
            'pattern'
          ];
          const affected = Object.keys(config).some(k => geomFields.includes(k as keyof MountingHolesConfig));
          Object.assign(state.mountingHoles, config);
          if (affected) {
            state.mountingHoles.generated = false;
            state.jawProfile.generated = false;
          }
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


