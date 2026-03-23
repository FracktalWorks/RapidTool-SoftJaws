/**
 * 3DScene — Main 3D viewport for RapidTool Soft Jaws
 *
 * Uses the generic CADViewport from cad-ui and adds
 * domain-specific overlays and scene children.
 */

import { useTheme } from 'next-themes';
import { CADViewport } from '@rapidtool/cad-ui';

// ─── Scene3D Component ───────────────────────────────────────────────────────

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      overlay={
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center tech-glass p-6 rounded-lg border border-border/50">
            <h3 className="font-tech font-semibold text-lg mb-2">3D Viewport</h3>
            <p className="text-sm text-muted-foreground font-tech">
              Upload a 3D model to start designing soft jaws
            </p>
          </div>
        </div>
      }
    >
      {/* Domain-specific scene children will be added here */}
      {/* e.g. <JawRenderer />, <PartRenderer />, <ViseRenderer /> */}
    </CADViewport>
  );
}
