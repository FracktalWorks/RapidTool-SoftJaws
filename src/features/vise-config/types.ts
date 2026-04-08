export type { ViseConfig, ViseType } from '@/stores/types';

export interface VisePreset {
  type: import('@/stores/types').ViseType;
  label: string;
  manufacturer: string;
  jawWidth: number;
  jawHeight: number;
  jawStroke: number;
}
