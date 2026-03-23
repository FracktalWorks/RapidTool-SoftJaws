/**
 * RapidToolLogo — Brand logo component for the RapidTool suite
 *
 * Displays "RapidTool" in Thuast font with:
 * - Lightning bolt icon in amber
 * - "Rapid" in foreground color
 * - "Tool" in primary/accent color
 * - Optional subscript for app name (e.g., "soft jaws", "fixtures")
 *
 * Requirements for consuming app:
 * - Define @font-face for 'Thuast' in your CSS
 * - Define Tailwind fontFamily.thuast extension
 *
 * @module @rapidtool/cad-ui/branding
 */

import React from 'react';

// ─── Inline SVG: Lightning bolt (replaces Lucide Zap) ────────────────────────

const ZapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RapidToolLogoProps {
  /** Subscript text below the logo (e.g., "soft jaws", "fixtures") */
  subscript?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the subscript */
  showSubscript?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ─── Size Configuration ──────────────────────────────────────────────────────

const sizeConfig = {
  sm: {
    main: 'text-lg',
    subscript: 'text-[9px]',
    gap: 'gap-0',
    icon: 'w-[14px] h-[14px]',
    iconGap: 'gap-0.5',
  },
  md: {
    main: 'text-xl',
    subscript: 'text-[10px]',
    gap: 'gap-0.5',
    icon: 'w-4 h-4',
    iconGap: 'gap-1',
  },
  lg: {
    main: 'text-3xl',
    subscript: 'text-xs',
    gap: 'gap-1',
    icon: 'w-6 h-6',
    iconGap: 'gap-1',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const RapidToolLogo: React.FC<RapidToolLogoProps> = ({
  subscript = 'soft jaws',
  size = 'sm',
  showSubscript = true,
  className = '',
}) => {
  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col ${config.gap} leading-none ${className}`}>
      <div className={`flex items-center ${config.iconGap}`}>
        <div
          className={`font-thuast ${config.main} tracking-tight`}
          style={{ fontFamily: "'Thuast', sans-serif" }}
        >
          <span className="text-foreground">Rapid</span>
          <span className="text-primary">Tool</span>
        </div>
        <ZapIcon className={`${config.icon} text-amber-500 fill-amber-500 flex-shrink-0`} />
      </div>

      {showSubscript && subscript && (
        <span
          className={`font-tech ${config.subscript} text-muted-foreground tracking-widest uppercase`}
        >
          {subscript}
        </span>
      )}
    </div>
  );
};
