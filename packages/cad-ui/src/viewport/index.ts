/**
 * Viewport Components
 * 
 * Reusable 3D viewport components for CAD applications.
 * Includes turnkey CADViewport, view orientation icons/controls,
 * grid, axis helpers, navigation help, and more.
 * 
 * @module @rapidtool/cad-ui/viewport
 */

// Types
export type { BoundsSummary, ViewOrientation, GridConfig } from './types';

// Components
export { default as ViewCube } from './ViewCube';
export { default as ScalableGrid } from './ScalableGrid';
export { default as SnapIndicator } from './SnapIndicator';
export { NavigationHelp, type NavigationHelpProps, type NavigationControl } from './NavigationHelp';

// CADViewport — Turnkey 3D viewport with grid, axes, gizmo, controls
export { CADViewport, type CADViewportProps, type CADViewportCameraConfig, type CADViewportGridConfig } from './CADViewport';

// Axis Helper — Floor-plane axis lines
export { AxisHelper, type AxisHelperProps } from './AxisHelper';

// View Orientation Icons — Isometric cube SVGs
export { IconIsoFace, IconIsoTop, IconIsoLeftFace, IconIsoCorner } from './ViewOrientationIcons';

// View Orientation Controls — Header buttons for camera views
export { ViewOrientationControls, type ViewOrientationControlsProps } from './ViewOrientationControls';
