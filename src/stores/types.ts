/**
 * App store types — domain-specific state types
 */

import type { SoftJawsWorkflowStep } from '@/workflow/steps';

/** XYZ position offset applied to a part mesh in the scene (mm). */
export interface PartTransform {
  position: { x: number; y: number; z: number };
  /** Euler angles in degrees (applied in XYZ order). */
  rotation: { x: number; y: number; z: number };
}

export interface ProcessedPart {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  vertexCount: number;
  faceCount: number;
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  /** User-applied transform; defaults to zero position and rotation. */
  transform: PartTransform;
}

/** Known vise form-factors with standard jaw width/stroke specs */
export type ViseType =
  | 'kurt-d60'
  | 'kurt-d688'
  | 'schunk-ksr-125'
  | 'schunk-ksr-160'
  | 'glacern-gmc-606'
  | 'three-jaw-chuck'
  | 'four-jaw-chuck'
  | 'six-jaw-chuck'
  | 'custom';

export interface ViseConfig {
  type: ViseType;
  jawCount: number;   // 2 for vises, 3/4/6 for chucks
  jawWidth: number;   // mm — jaw face width
  jawHeight: number;  // mm — jaw face height
  jawStroke: number;  // mm — max opening
  tSlotWidth?: number;    // mm - for mounting holes
  tSlotSpacing?: number;  // mm
  customName?: string; // label when type === 'custom'
}

export interface JawBlankConfig {
  width: number;
  height: number;
  depth: number;
  material: string;
}

export interface JawProfileConfig {
  clearance: number;
  depth: number;
  generated: boolean;
}

export interface GripFeaturesConfig {
  pattern: 'none' | 'serrated' | 'diamond' | 'custom';
  depth: number;
  spacing: number;
}

export interface MountingHolesConfig {
  pattern: 'standard' | 'custom';
  boltSize: number;
  spacing: number;
  count: number;
}

export interface ExportConfig {
  format: 'stl' | '3mf';
  quality: 'low' | 'medium' | 'high';
}

export interface SoftJawsState {
  parts: ProcessedPart[];
  activePart: string | null;
  viseConfig: ViseConfig;
  jawBlank: JawBlankConfig;
  jawProfile: JawProfileConfig;
  gripFeatures: GripFeaturesConfig;
  mountingHoles: MountingHolesConfig;
  exportConfig: ExportConfig;
}

export type { SoftJawsWorkflowStep };
