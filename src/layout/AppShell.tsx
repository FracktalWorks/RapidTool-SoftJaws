/**
 * AppShell — Main application shell for RapidTool Soft Jaws
 *
 * Uses DashboardLayout from @rapidtool/cad-ui for the layout shell,
 * matching the same pattern as RapidTool-Fixture's AppShell.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  DashboardLayout,
  SidebarIcon,
  SidebarIconGroup,
  ViewOrientationControls,
  useWorkflowStore,
} from '@rapidtool/cad-ui';
import { RapidToolLogo } from '@/components/RapidToolLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { geometryCache } from '@/stores/geometryCache';
import {
  Upload,
  Settings,
  RotateCcw,
  Undo2,
  Redo2,
  Wrench,
  Box,
  Grip,
  CircleDot,
  Download,
  UserCircle2,
} from 'lucide-react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { STEP_CONFIG, getStepGate } from '@/workflow';
import type { SoftJawsWorkflowStep } from '@/workflow';
import { ContextOptionsPanel } from '@/components/ContextOptionsPanel';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Scene3D } from '@/components/3DScene';
import { DesignBlockPreview } from '@/components/DesignBlockPreview';
import { useMountingHoles } from '@/features/mounting-holes/hooks/useMountingHoles';

// ─── Lucide icon map for workflow steps ──────────────────────────────────────

const STEP_ICONS: Record<SoftJawsWorkflowStep, React.FC<{ className?: string }>> = {
  'import': Upload,
  'vise-config': Settings,
  'jaw-blank': Box,
  'jaw-profile': Wrench,
  'grip-features': Grip,
  'export': Download,
};

// ─── Header Content ──────────────────────────────────────────────────────────

function AppHeader() {
  // Undo/redo stacks — disabled until useHistoryStore is wired up (Task 7+)
  const [undoStack] = useState<unknown[]>([]);
  const [redoStack] = useState<unknown[]>([]);

  const handleUndo = useCallback(() => {
    // TODO: connect to useHistoryStore when implemented
  }, []);

  const handleRedo = useCallback(() => {
    // TODO: connect to useHistoryStore when implemented
  }, []);

  const handleResetSession = useCallback(() => {
    // 1. Clear all non-serializable geometry from the module-level cache.
    geometryCache.clear();
    // 2. Reset the vise store — restores default jawWidth/jawHeight/jawStroke
    //    and the bolt-pattern tSlotSpacing. Without this, the vise dimensions
    //    the user changed would stick around after the "reset".
    useViseStore.getState().resetVise();
    // 3. Reset the domain store (parts, jaw blank, profile, holes, export).
    useSoftJawsStore.getState().reset();
    // 4. Navigate the workflow back to the first step.
    useWorkflowStore.getState().goToStep('vise-config');
    // 5. Re-fit the camera to the now-default scene (no parts, default vise).
    window.dispatchEvent(new CustomEvent('set-view-orientation', { detail: 'iso' }));
  }, []);

  const handleSetOrientation = useCallback((orientation: string) => {
    window.dispatchEvent(
      new CustomEvent('set-view-orientation', { detail: orientation })
    );
  }, []);

  return (
    <div className="flex items-center justify-between w-full h-full px-4">
      {/* Left Section — Logo & Actions */}
      <div className="flex items-center gap-4">
        <RapidToolLogo size="sm" subscript="soft jaws" />

        <div className="w-px h-6 bg-border/50" />

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSession}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent tech-transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <div className="w-px h-6 bg-border/50" />

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent tech-transition disabled:opacity-40"
              disabled={undoStack.length === 0}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent tech-transition disabled:opacity-40"
              disabled={redoStack.length === 0}
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Section — View Orientation & Theme */}
      <div className="flex items-center gap-2">
        <ViewOrientationControls onViewChange={handleSetOrientation} />

        <div className="w-px h-6 bg-border/50" />

        <ThemeToggle />
      </div>
    </div>
  );
}

// ─── Toolbar Content ─────────────────────────────────────────────────────────

function AppToolbar() {
  const { currentStep, steps, goToStep } = useWorkflow();
  const partCount        = useSoftJawsStore((s) => s.parts.length);
  const profileGenerated = useSoftJawsStore((s) => s.jawProfile.generated);

  const handleToolSelect = useCallback(
    (stepId: string) => {
      const gate = getStepGate(stepId as SoftJawsWorkflowStep, { partCount, profileGenerated });
      if (!gate.allowed) return;
      goToStep(stepId as SoftJawsWorkflowStep);
    },
    [goToStep, partCount, profileGenerated],
  );

  return (
    <nav
      className="flex flex-col h-full"
      role="toolbar"
      aria-label="Soft jaw design tools"
    >
      <SidebarIconGroup direction="vertical" gap={8} className="p-2 flex-1">
        {steps.map((stepId) => {
          const meta = STEP_CONFIG[stepId];
          const Icon = STEP_ICONS[stepId];
          const gate = getStepGate(stepId, { partCount, profileGenerated });
          const tooltip = gate.allowed ? meta.description : `${meta.label} — ${gate.reason}`;
          return (
            <SidebarIcon
              key={stepId}
              disabled={!gate.allowed}
              icon={
                <Icon
                  className={`w-4 h-4 ${
                    !gate.allowed ? 'opacity-30' : currentStep === stepId ? 'opacity-100' : 'opacity-60'
                  }`}
                />
              }
              label={meta.label}
              tooltip={tooltip}
              active={currentStep === stepId}
              onClick={() => handleToolSelect(stepId)}
              size="md"
            />
          );
        })}
      </SidebarIconGroup>

      <div className="p-3 border-t border-border/50">
        <SidebarIcon
          icon={<UserCircle2 className="w-4 h-4 opacity-60" />}
          label="Account Settings"
          onClick={() => {}}
          size="sm"
        />
      </div>
    </nav>
  );
}

// ─── Footer Content ──────────────────────────────────────────────────────────

function AppFooter() {
  return (
    <div className="flex items-center justify-between w-full h-full px-4 text-xs font-tech text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>Ready</span>
        <span>•</span>
        <span>WebGL 2.0</span>
      </div>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell() {
  const [isContextPanelCollapsed, setIsContextPanelCollapsed] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(true);

  const { generated: holesGenerated } = useSoftJawsStore((s) => s.mountingHoles);
  const jawBlank = useSoftJawsStore((s) => s.jawBlank);
  const { generate: generateHoles, error: drillError } = useMountingHoles();

  // Auto-drill mounting holes when parameters change.
  //
  // We log any failure to the console explicitly. Previously the holeCSGWorker
  // silently returned the un-drilled baseplate on CSG failure — the cache
  // ended up with a flat blank that LOOKED drilled in the viewport (faint
  // shading suggested holes) but exported as a hole-less STL. The worker is
  // now fixed to throw on failure, but the auto-drill is fire-and-forget so
  // we surface the rejection here.
  useEffect(() => {
    if (!holesGenerated && !jawBlank.isDragging) {
      generateHoles().catch((err) => {
        // Don't swallow — print the CSG failure so the user (and any open
        // devtools session) can see exactly why drilling failed.
        // eslint-disable-next-line no-console
        console.error('[AppShell] Auto-drill failed:', err);
      });
    }
  }, [holesGenerated, generateHoles, jawBlank.isDragging]);

  // Bubble the auto-drill error to the console for visibility. (Hook keeps
  // it in state; the auto-drill effect above has no UI to render it.)
  useEffect(() => {
    if (drillError) {
      // eslint-disable-next-line no-console
      console.error('[useMountingHoles]', drillError);
    }
  }, [drillError]);

  // Cross-store invalidation on viseConfig change:
  //
  //   jawProfile.generated → INVALIDATE. The cavity CSG is baked in WORLD
  //     frame against the OLD workpiece position (workpiece position is
  //     derived from bracketInnerX), so a new vise dimension would render
  //     the cavity at a stale location relative to the new workpiece position.
  //
  //   mountingHoles.generated → DO NOT INVALIDATE. JAW_HOLED is cached in
  //     LOCAL frame and survives any vise dimension change — JawBlankMesh
  //     re-positions the holed blank via mesh.position at render time. This
  //     is what eliminates the 3–4 s "decoration → real holes" pop-in the
  //     user was hitting on every vise parameter tweak.
  useEffect(() => {
    let prev = useViseStore.getState().viseConfig;
    return useViseStore.subscribe((state) => {
      if (state.viseConfig !== prev) {
        prev = state.viseConfig;
        if (useSoftJawsStore.getState().jawProfile.generated) {
          useSoftJawsStore.getState().updateJawProfile({ generated: false });
        }
      }
    });
  }, []);

  return (
    <DashboardLayout
      config={{
        header: { height: 56, visible: true },
        toolbar: { width: 56, position: 'left', visible: true },
        contextPanel: { enabled: true, width: 320, collapsedWidth: 48 },
        propertiesPanel: { enabled: true, width: 280, collapsedWidth: 48 },
        footer: { height: 24, visible: true },
      }}
      header={<AppHeader />}
      toolbar={<AppToolbar />}
      contextPanel={<ContextOptionsPanel />}
      contextPanelHeader={
        <span className="font-tech font-semibold text-sm">Context Options</span>
      }
      propertiesPanel={<PropertiesPanel />}
      propertiesPanelHeader={
        <span className="font-tech font-semibold text-sm">Properties</span>
      }
      footer={<AppFooter />}
      contextPanelCollapsedExternal={isContextPanelCollapsed}
      propertiesPanelCollapsedExternal={isPropertiesCollapsed}
      onContextPanelCollapse={setIsContextPanelCollapsed}
      onPropertiesPanelCollapse={setIsPropertiesCollapsed}
    >
      {/* Main 3D Viewport */}
      <Scene3D />

      {/* Floating Trinckle-style design preview — visible when a sidebar
          dimension input is hovered or focused. */}
      <DesignBlockPreview />
    </DashboardLayout>
  );
}
