export type { ViseConfig, ViseType } from '@/stores/types';

export interface VisePreset {
  type: import('@/stores/types').ViseType;
  label: string;
  manufacturer: string;
  jawCount: number;
  jawWidth: number;
  jawHeight: number;
  jawStroke: number;
  tSlotWidth?: number;
  tSlotSpacing?: number;
}
