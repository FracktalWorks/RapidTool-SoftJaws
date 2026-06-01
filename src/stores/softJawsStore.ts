/**
 * softJawsStore — Main domain store for soft jaw configuration
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { geometryCache } from './geometryCache';
import { useViseStore } from './viseStore';
import type { ViseConfig } from './types';
import type {
  SoftJawsState,
  ProcessedPart,
  PartTransform,
  JawBlankConfig,
  UpdateJawBlankConfig,
  JawProfileConfig,
  GripFeaturesConfig,
  MountingHolesConfig,
  ExportConfig,
} from './types';

function applyAutoPositioning(state: any, viseConfig: ViseConfig) {
  if (!state.mountingHoles.autoPosition) return;

  const minFace = Math.min(state.jawBlank.left.face, state.jawBlank.right.face);
  const minHeight = Math.min(state.jawBlank.left.height, state.jawBlank.right.height);
  const boltSize = state.mountingHoles.boltSize;
  const screwheadDiameter = state.mountingHoles.screwheadDiameter;

  // 1. Spacing & Count
  const pitch = viseConfig.tSlotSpacing ?? 100;
  state.mountingHoles.spacing = pitch;

  // If jaw face width is too small to fit 2 holes with standard spacing plus margin, set count to 1
  const minFaceForTwoHoles = pitch + boltSize * 2.0; // edge margin of 1x bolt diameter on each side
  if (minFace < minFaceForTwoHoles) {
    state.mountingHoles.count = 1;
  } else {
    state.mountingHoles.count = 2;
  }

  // 2. Holes Height (clamped to stay inside BOTH jaw blanks safely)
  const counterboreR = screwheadDiameter / 2;
  const yMargin = counterboreR + 1.0;
  const yMin = yMargin;
  const yMax = Math.max(yMin, minHeight - yMargin);
  // Do NOT scale holesHeight with height. Keep it at its current value, just clamp it.
  state.mountingHoles.holesHeight = Math.max(yMin, Math.min(yMax, state.mountingHoles.holesHeight || 30.0));
}

const INITIAL_STATE: SoftJawsState = {
  parts: [],
  activePart: null,
  clampGap: 0.01,
  jawBlank: {
    left: { face: 150.0, height: 65.0, thickness: 30.0 },
    right: { face: 150.0, height: 65.0, thickness: 30.0 },
    material: 'aluminum-6061',
    clearance: 0.1,
    isDragging: false,
  },
  jawProfile: {
    depth: 5.0,
    leftDepth: 5.0,
    rightDepth: 5.0,
    generated: false,
    hideModel: false,
    tolerance: 0.2,
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
    holesHeight: 30.0,      // default 30mm (aligns with BR_BOLT_Y_OFFSET initially)
    count: 2,
    generated: false,
    autoPosition: true,
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
  updateJawBlank: (config: UpdateJawBlankConfig) => void;
  updateJawProfile: (config: Partial<JawProfileConfig>) => void;
  updateGripFeatures: (config: Partial<GripFeaturesConfig>) => void;
  updateMountingHoles: (config: Partial<MountingHolesConfig>) => void;
  updateExportConfig: (config: Partial<ExportConfig>) => void;
  syncWithViseConfig: (viseConfig: ViseConfig) => void;
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
          // mountingHoles.generated is NOT invalidated — JAW_HOLED is now
          // cached at LOCAL frame, so changes that only MOVE the blank
          // (active-part swap, bracket carriage motion) don't require a
          // re-drill. JawBlankMesh just re-renders the cached local geo
          // at the new world position via mesh.position.
        }),

      removePart: (id) => {
        // Pair the state update with cache deletion — CLAUDE.md Invariant 2.
        geometryCache.delete(id);
        set((state) => {
          state.parts = state.parts.filter((p) => p.id !== id);
          if (state.activePart === id) {
            state.activePart = state.parts[0]?.id ?? null;
          }
          state.jawProfile.generated = false;
          // No mountingHoles invalidation — see addPart comment.
        });
      },

      setActivePart: (id) =>
        set((state) => {
          state.activePart = id;
          state.jawProfile.generated = false;
          // No mountingHoles invalidation — see addPart comment.
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

          if (moved) {
            state.jawProfile.generated = false;
            // No mountingHoles invalidation — JAW_HOLED is cached at LOCAL
            // frame, so bracket motion (driven by computeWorldSpanX(part))
            // is just a render-time mesh.position change. See addPart.
          }
        }),

      updateJawBlank: (config) =>
        set((state) => {
          if (config.material !== undefined) {
            state.jawBlank.material = config.material;
          }
          if (config.clearance !== undefined) {
            if (state.jawBlank.clearance !== config.clearance) {
              state.jawBlank.clearance = config.clearance;
              state.jawProfile.generated = false;
            }
          }
          if (config.isDragging !== undefined) {
            state.jawBlank.isDragging = config.isDragging;
          }

          if (config.left !== undefined) {
            Object.assign(state.jawBlank.left, config.left);
          }

          if (config.right !== undefined) {
            Object.assign(state.jawBlank.right, config.right);
          }

          state.jawProfile.generated = false;

          const affectsLeft = config.left && (config.left.height !== undefined || config.left.thickness !== undefined || config.left.face !== undefined);
          const affectsRight = config.right && (config.right.height !== undefined || config.right.thickness !== undefined || config.right.face !== undefined);
          
          if ((affectsLeft || affectsRight) && !state.jawBlank.isDragging) {
            state.mountingHoles.generated = false;
          }

          const viseConfig = useViseStore.getState().viseConfig;
          applyAutoPositioning(state, viseConfig);
        }),

      updateJawProfile: (config) =>
        set((state) => {
          // Invalidate when a CSG-input field changes, but allow the
          // hook to set `generated: true` after a successful run.
          const csgInputChanged =
            (config.depth     !== undefined && config.depth     !== state.jawProfile.depth) ||
            (config.leftDepth !== undefined && config.leftDepth !== state.jawProfile.leftDepth) ||
            (config.rightDepth !== undefined && config.rightDepth !== state.jawProfile.rightDepth) ||
            (config.tolerance !== undefined && config.tolerance !== state.jawProfile.tolerance);
          Object.assign(state.jawProfile, config);
          if (csgInputChanged && config.generated !== true) {
            state.jawProfile.generated = false;
          }
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
            'pattern',
            'autoPosition'
          ];
          const affected = Object.keys(config).some(k => geomFields.includes(k as keyof MountingHolesConfig));
          Object.assign(state.mountingHoles, config);
          
          const viseConfig = useViseStore.getState().viseConfig;
          applyAutoPositioning(state, viseConfig);

          if (affected) {
            state.mountingHoles.generated = false;
            state.jawProfile.generated = false;
          }
        }),

      updateExportConfig: (config) =>
        set((state) => {
          Object.assign(state.exportConfig, config);
        }),

      syncWithViseConfig: (viseConfig) =>
        set((state) => {
          if (state.mountingHoles.autoPosition) {
            const oldSpacing = state.mountingHoles.spacing;
            const oldHeight = state.mountingHoles.holesHeight;
            const oldCount = state.mountingHoles.count;

            applyAutoPositioning(state, viseConfig);

            const changed =
              state.mountingHoles.spacing !== oldSpacing ||
              state.mountingHoles.holesHeight !== oldHeight ||
              state.mountingHoles.count !== oldCount;

            if (changed) {
              state.mountingHoles.generated = false;
              state.jawProfile.generated = false;
            }
          }
        }),

      reset: () => set(INITIAL_STATE),
    })),
    { name: 'softjaws' }
  )
);

// Subscribe to vise config changes to sync jaw blanks and mounting holes
useViseStore.subscribe((viseState) => {
  useSoftJawsStore.getState().syncWithViseConfig(viseState.viseConfig);
});


