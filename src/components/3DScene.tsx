/**
 * 3DScene — Main 3D viewport for RapidTool Soft Jaws
 *
 * Wraps cad-ui's CADViewport and injects domain-specific scene content
 * (PartMeshes) as children rendered inside the R3F Canvas.
 * The placeholder overlay is shown only when no parts are loaded.
 */

import { useTheme } from 'next-themes';
import { CADViewport } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { PartMeshes } from './3DScene/PartMeshes';

export function Scene3D() {
  const { resolvedTheme } = useTheme();
  const isDark  = resolvedTheme === 'dark';
  const hasParts = useSoftJawsStore((s) => s.parts.length > 0);

  return (
    <CADViewport
      isDark={isDark}
      navigationHelpKey="softjaws-view-nav-tooltip-dismissed"
      overlay={
        !hasParts ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center tech-glass p-6 rounded-lg border border-border/50">
              <h3 className="font-tech font-semibold text-lg mb-2">3D Viewport</h3>
              <p className="text-sm text-muted-foreground font-tech">
                Import an STL in the left panel to start designing soft jaws
              </p>
            </div>
          </div>
        ) : undefined
      }
    >
      <PartMeshes />
    </CADViewport>
  );
}
