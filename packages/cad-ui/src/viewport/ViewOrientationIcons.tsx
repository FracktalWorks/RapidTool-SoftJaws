/**
 * View Orientation Icons
 *
 * Isometric cube SVG icons for camera view orientation controls.
 * Used in header toolbars and view-switching UI across all RapidTool apps.
 *
 * @module @rapidtool/cad-ui/viewport
 */

import React from 'react';

interface IconProps {
  className?: string;
}

/** Isometric view icon with right face filled — used for Front/Right views */
export const IconIsoFace: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="12,4 19,8 12,12 5,8" fill="none" />
    <polygon points="5,8 12,12 12,20 5,16" fill="none" />
    <polygon points="19,8 12,12 12,20 19,16" fill="currentColor" />
    <polyline points="5,8 12,12 19,8" />
    <polyline points="5,16 12,20 19,16" />
    <line x1="12" y1="12" x2="12" y2="20" />
  </svg>
);

/** Isometric view icon with top face filled — used for Top view */
export const IconIsoTop: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="12,4 19,8 12,12 5,8" fill="currentColor" />
    <polygon points="5,8 12,12 12,20 5,16" fill="none" />
    <polygon points="19,8 12,12 12,20 19,16" fill="none" />
    <polyline points="5,8 12,12 19,8" />
    <polyline points="5,16 12,20 19,16" />
    <line x1="12" y1="12" x2="12" y2="20" />
  </svg>
);

/** Isometric view icon with left face filled — used for Left view */
export const IconIsoLeftFace: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="12,4 19,8 12,12 5,8" fill="none" />
    <polygon points="5,8 12,12 12,20 5,16" fill="currentColor" />
    <polygon points="19,8 12,12 12,20 19,16" fill="none" />
    <polyline points="5,8 12,12 19,8" />
    <polyline points="5,16 12,20 19,16" />
    <line x1="12" y1="12" x2="12" y2="20" />
  </svg>
);

/** Isometric corner view icon — all three faces visible with gradient shading */
export const IconIsoCorner: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="12,4 19,8 12,12 5,8" fill="currentColor" fillOpacity="0.3" />
    <polygon points="5,8 12,12 12,20 5,16" fill="currentColor" fillOpacity="0.5" />
    <polygon points="19,8 12,12 12,20 19,16" fill="currentColor" fillOpacity="0.7" />
    <polyline points="5,8 12,12 19,8" />
    <polyline points="5,16 12,20 19,16" />
  </svg>
);
