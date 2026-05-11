/**
 * Standard CAD axis colours, used by both the panel labels and the 3D
 * dimension arrows so the two can never drift.
 *
 * Trinckle convention (Z-up):
 *   X — clamping direction      → red
 *   Y — along the jaw face      → green   (= R3F world Z)
 *   Z — vertical                → blue    (= R3F world Y)
 */

export const AXIS_COLORS = {
  x: '#ef4444',  // red-500
  y: '#22c55e',  // green-500
  z: '#3b82f6',  // blue-500
} as const;

/** Matching Tailwind text-colour classes — same hex as AXIS_COLORS so the
 *  panel labels and 3D arrows can never visually drift. */
export const AXIS_TEXT_CLASS = {
  x: 'text-red-500',
  y: 'text-green-500',
  z: 'text-blue-500',
} as const;

export type Axis = keyof typeof AXIS_COLORS;
