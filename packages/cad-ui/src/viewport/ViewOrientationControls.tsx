/**
 * ViewOrientationControls — Camera view orientation buttons
 *
 * A row of icon buttons for switching the 3D viewport camera to
 * standard orientations (front, back, left, right, top, isometric).
 * Uses ViewOrientationIcons from cad-ui.
 *
 * @module @rapidtool/cad-ui/viewport
 *
 * @example
 * import { ViewOrientationControls } from '@rapidtool/cad-ui';
 *
 * function Header() {
 *   const handleViewChange = (orientation: string) => {
 *     window.dispatchEvent(new CustomEvent('set-view-orientation', { detail: orientation }));
 *   };
 *   return <ViewOrientationControls onViewChange={handleViewChange} />;
 * }
 */

import React from 'react';
import { IconIsoFace, IconIsoLeftFace, IconIsoTop, IconIsoCorner } from './ViewOrientationIcons';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ViewOrientationControlsProps {
  /** Callback when a view orientation is selected */
  onViewChange: (orientation: string) => void;
  /** Additional CSS classes for the container */
  className?: string;
  /** Size of each button in pixels (default: 32) */
  buttonSize?: number;
  /** Size of the icon class (default: 'w-4 h-4') */
  iconSize?: string;
}

// ─── View Button ─────────────────────────────────────────────────────────────

interface ViewButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  iconSize: string;
}

const ViewButton: React.FC<ViewButtonProps> = ({ icon, title, onClick, iconSize }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent tech-transition"
    title={title}
  >
    {icon}
  </button>
);

// ─── Component ───────────────────────────────────────────────────────────────

export const ViewOrientationControls: React.FC<ViewOrientationControlsProps> = ({
  onViewChange,
  className = '',
  iconSize = 'w-4 h-4',
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ViewButton
        icon={<IconIsoFace className={iconSize} />}
        title="Front View"
        onClick={() => onViewChange('front')}
        iconSize={iconSize}
      />
      <ViewButton
        icon={<IconIsoFace className={`${iconSize} rotate-180`} />}
        title="Back View"
        onClick={() => onViewChange('back')}
        iconSize={iconSize}
      />
      <ViewButton
        icon={<IconIsoLeftFace className={iconSize} />}
        title="Left View"
        onClick={() => onViewChange('left')}
        iconSize={iconSize}
      />
      <ViewButton
        icon={<IconIsoFace className={iconSize} />}
        title="Right View"
        onClick={() => onViewChange('right')}
        iconSize={iconSize}
      />
      <ViewButton
        icon={<IconIsoTop className={iconSize} />}
        title="Top View"
        onClick={() => onViewChange('top')}
        iconSize={iconSize}
      />
      <ViewButton
        icon={<IconIsoCorner className={iconSize} />}
        title="Isometric View"
        onClick={() => onViewChange('iso')}
        iconSize={iconSize}
      />
    </div>
  );
};
