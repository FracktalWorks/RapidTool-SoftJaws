/**
 * Vise Preset Catalogue — Fixed Hardware Specs
 *
 * We only expose a Custom Machine Vise preset. The 3D vise dimensions
 * represent the absolute, physical cast-iron limits of the machine's workholding.
 * Scaling these scales the machine bed. Soft jaws are consumable aluminum blocks
 * configured independently in the next step.
 */

import type { ViseConfig, ViseType } from '@/stores/types';

export interface VisePreset {
  label: string;
  manufacturer: string;
  description: string;
  config: Omit<ViseConfig, 'type' | 'customName'>;
}

export const VISE_PRESETS: Record<ViseType, VisePreset> = {
  'custom': {
    label: 'Custom Machine Vise',
    manufacturer: 'CNC Machine Vise',
    description: 'Fixed physical hardware specs. These define the maximum opening and base height of the cast-iron vise.',
    config: {
      jawCount: 2,
      jawWidth: 150,
      jawHeight: 65,
      jawStroke: 180,
      tSlotWidth: 14,
      tSlotSpacing: 125,
    },
  },

  // Retain the type keys for safety/legacy in stores but map them to the same custom config
  'kurt-d688': {
    label: 'Kurt D688 (6")',
    manufacturer: 'Kurt Manufacturing',
    description: '6" precision anglock vise — the industry standard for CNC milling.',
    config: {
      jawCount: 2,
      jawWidth: 152.4,   // 6.000"
      jawHeight: 66.7,   // 2.625"
      jawStroke: 190.5,  // 7.500"
      tSlotWidth: 14.3,  // 9/16"
      tSlotSpacing: 127, // 5.000"
    },
  },

  'schunk-ksr': {
    label: 'Schunk KSR 160',
    manufacturer: 'Schunk SE',
    description: 'KSR 160-B self-centering clamping vise for 5-axis machining. 160mm jaw width.',
    config: {
      jawCount: 2,
      jawWidth: 160,
      jawHeight: 70,
      jawStroke: 200,
      tSlotWidth: 14,
      tSlotSpacing: 125,
    },
  },

  'three-jaw-chuck': {
    label: '3-Jaw Chuck',
    manufacturer: 'Generic',
    description: 'Standard 3-jaw self-centering scroll chuck (Ø200mm).',
    config: { jawCount: 3, jawWidth: 200, jawHeight: 60, jawStroke: 130, tSlotWidth: 12, tSlotSpacing: 120 },
  },

  'four-jaw-chuck': {
    label: '4-Jaw Chuck',
    manufacturer: 'Generic',
    description: '4-jaw independent chuck (Ø250mm).',
    config: { jawCount: 4, jawWidth: 250, jawHeight: 65, jawStroke: 160, tSlotWidth: 14, tSlotSpacing: 140 },
  },

  'six-jaw-chuck': {
    label: '6-Jaw Chuck',
    manufacturer: 'Generic',
    description: '6-jaw scroll chuck (Ø250mm).',
    config: { jawCount: 6, jawWidth: 250, jawHeight: 55, jawStroke: 140, tSlotWidth: 14, tSlotSpacing: 140 },
  },
};

/** We ONLY expose the custom preset to the UI now to enforce the conceptual separation */
export const PRESET_LIST = [
  { value: 'custom' as ViseType, ...VISE_PRESETS['custom'] }
];
