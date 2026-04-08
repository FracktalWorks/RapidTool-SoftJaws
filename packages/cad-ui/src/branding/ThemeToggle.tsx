/**
 * ThemeToggle — Dark/Light/System theme cycle button
 *
 * A framework-agnostic theme toggle that cycles through light → dark → system.
 * Takes theme state and callback as props — the consuming app provides
 * the actual theme provider integration (e.g., next-themes).
 *
 * @module @rapidtool/cad-ui/branding
 *
 * @example
 * // With next-themes
 * import { useTheme } from 'next-themes';
 * import { ThemeToggle } from '@rapidtool/cad-ui';
 *
 * function MyApp() {
 *   const { theme, setTheme } = useTheme();
 *   return <ThemeToggle theme={theme ?? 'system'} onThemeChange={setTheme} />;
 * }
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThemeToggleProps {
  /** Current theme value ('light' | 'dark' | 'system') */
  theme: string;
  /** Callback when theme changes */
  onThemeChange: (theme: string) => void;
  /** Additional CSS classes */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onThemeChange,
  className = '',
}) => {
  const cycleTheme = () => {
    if (theme === 'light') onThemeChange('dark');
    else if (theme === 'dark') onThemeChange('system');
    else onThemeChange('light');
  };

  return (
    <button
      onClick={cycleTheme}
      className={`relative inline-flex items-center justify-center h-10 w-10 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground tech-glow tech-transition ${className}`}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
};
