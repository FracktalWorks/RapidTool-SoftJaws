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

/**
 * Single canonical vise type. Multi-preset catalog was removed in favour of
 * one fully-customizable vise — all dimensions editable in the vise-config
 * step. The `type` field is retained for forward compatibility if presets
 * ever return.
 */
export type ViseType = 'custom' | 'kurt-d688' | 'schunk-ksr' | 'three-jaw-chuck' | 'four-jaw-chuck' | 'six-jaw-chuck';

export interface ViseConfig {
  type: ViseType;
  jawCount: number;      // always 2 for milling vises
  jawWidth: number;      // mm — jaw face width (Z extent)
  jawHeight: number;     // mm — jaw face height (Y extent)
  jawStroke: number;     // mm — max opening
  tSlotWidth?: number;   // mm — T-slot width for mounting bolts
  tSlotSpacing?: number; // mm — bolt hole centre spacing
  customName?: string;
}

/**
 * Soft-jaw blank stock. Axis-named fields prevent the field-vs-axis
 * confusion that previously hit JawBlankStepContent.
 */
export interface JawBlankConfig {
  /** Z extent — along the jaw face, typically matches viseConfig.jawWidth */
  face: number;
  /** Y extent — vertical height of the blank */
  height: number;
  /** X extent — thickness sticking out from the carriage toward the workpiece */
  thickness: number;
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
  boltSize: number; // Screw diameter
  screwheadHeight: number; // Screwhead height
  screwheadDiameter: number; // Screwhead diameter
  spacing: number; // Holes distance
  holesHeight: number; // Holes height
  count: number;
  /** True once the hole CSG has populated JAW_HOLED_CACHE_KEY_{LEFT,RIGHT}. */
  generated: boolean;
}

export interface ExportConfig {
  format: 'stl' | '3mf';
  quality: 'low' | 'medium' | 'high';
}

export interface SoftJawsState {
  parts: ProcessedPart[];
  activePart: string | null;
  clampGap: number;        // mm clearance between right jaw and part on import
  jawBlank: JawBlankConfig;
  jawProfile: JawProfileConfig;
  gripFeatures: GripFeaturesConfig;
  mountingHoles: MountingHolesConfig;
  exportConfig: ExportConfig;
}

export type { SoftJawsWorkflowStep };
