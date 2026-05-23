/**
 * Step metadata — labels, descriptions, icons, and help text
 */

import type { SoftJawsWorkflowStep } from './steps';

export interface StepMeta {
  label: string;
  shortLabel: string;
  description: string;
  helpText: string;
  skippable: boolean;
}

export const STEP_CONFIG: Record<SoftJawsWorkflowStep, StepMeta> = {
  import: {
    label: 'Import Part',
    shortLabel: 'Import',
    description: 'Load the 3D workpiece model (STL/3MF)',
    helpText: 'Drag and drop or browse to import your workpiece geometry.',
    skippable: false,
  },
  'vise-config': {
    label: 'Vise / Chuck Configuration',
    shortLabel: 'Vise',
    description: 'Select vise or chuck type, jaw count, and dimensions',
    helpText: 'Choose the workholding device your soft jaws will mount to.',
    skippable: false,
  },
  'jaw-blank': {
    label: 'Jaw Blank Setup',
    shortLabel: 'Blank',
    description: 'Configure jaw blank dimensions and material',
    helpText: 'Define the raw stock dimensions for the jaw blank.',
    skippable: false,
  },
  'jaw-profile': {
    label: 'Jaw Profile',
    shortLabel: 'Profile',
    description: 'Generate the cavity/profile from the workpiece shape',
    helpText: 'The cavity will be generated from the workpiece geometry with configurable clearance.',
    skippable: false,
  },
  'grip-features': {
    label: 'Grip Features',
    shortLabel: 'Grip',
    description: 'Add serrations, grip patterns, and contact surfaces',
    helpText: 'Configure grip patterns to improve part holding force.',
    skippable: true,
  },

  export: {
    label: 'Export',
    shortLabel: 'Export',
    description: 'Export jaw geometry as STL or 3MF',
    helpText: 'Download the finished jaw design for CNC manufacturing.',
    skippable: false,
  },
};
