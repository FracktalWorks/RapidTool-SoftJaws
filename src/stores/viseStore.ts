import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { ViseConfig } from './types';

export interface ViseState {
  viseConfig: ViseConfig;
}

export interface ViseActions {
  updateViseConfig: (config: Partial<ViseConfig>) => void;
  resetVise: () => void;
}

export type ViseStore = ViseState & ViseActions;

const INITIAL_STATE: ViseState = {
  viseConfig: {
    type: 'custom',
    jawCount: 2,
    jawWidth: 150.0,
    jawHeight: 65.0,
    jawStroke: 180.0,
    tSlotWidth: 14.0,
    tSlotSpacing: 125.0,
  },
};

export const useViseStore = create<ViseStore>()(
  devtools(
    immer((set) => ({
      ...INITIAL_STATE,

      updateViseConfig: (config) =>
        set((state) => {
          Object.assign(state.viseConfig, config);
        }),

      resetVise: () => set(INITIAL_STATE),
    })),
    { name: 'RapidTool-ViseStore' }
  )
);
