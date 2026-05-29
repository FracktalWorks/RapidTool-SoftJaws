/**
 * dimensionHover — Tracks which sidebar dimension input the user is currently
 * hovering or focusing, so the 3D scene can draw a matching measurement arrow.
 *
 * `scope`  — which artefact the dimension belongs to (vise body or jaw blank)
 * `field`  — the specific dimension key within that scope
 *
 * Cleared on mouse-leave and blur. A single hovered dimension at a time is
 * sufficient — we never need to overlay multiple arrows.
 */

import { create } from 'zustand';

export type HoverScope   = 'vise' | 'jaw' | 'profile' | 'holes';
export type ViseField    = 'jawStroke' | 'jawWidth' | 'jawHeight';
export type JawField     = 'thickness' | 'face' | 'height';
export type ProfileField = 'depth' | 'clearance';
export type HolesField   = 'boltSize' | 'screwheadHeight' | 'screwheadDiameter' | 'spacing' | 'holesHeight';

export interface HoveredDimension {
  scope: HoverScope;
  field: ViseField | JawField | ProfileField | HolesField;
}

interface DimensionHoverState {
  hovered: HoveredDimension | null;
  setHovered: (h: HoveredDimension) => void;
  clear: () => void;
}

export const useDimensionHoverStore = create<DimensionHoverState>((set) => ({
  hovered: null,
  setHovered: (h) => set({ hovered: h }),
  clear:      () => set({ hovered: null }),
}));
