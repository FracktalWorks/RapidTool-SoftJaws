/**
 * ContextOptionsPanel — Step-based workflow panel
 *
 * Renders the active step's content with a rich step header, help text,
 * skip capabilities, and navigation controls.
 *
 * Matches Fixture's ContextOptionsPanel structure:
 *   - Step header: icon badge + title + description + processing spinner
 *   - StepProgress bar (inline)
 *   - SkipStep button for optional steps
 *   - Scrollable step content area
 *   - WorkflowNavigation (step mini-map + back/next) pinned at bottom
 */

import React from 'react';
import {
  Upload,
  Settings,
  Box,
  Wrench,
  Grip,
  CircleDot,
  Download,
} from 'lucide-react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { STEP_CONFIG } from '@/workflow';
import { SOFTJAWS_WORKFLOW_STEPS } from '@/workflow';
import type { SoftJawsWorkflowStep } from '@/workflow';
import {
  CollapsiblePanel,
  WorkflowNavigation,
  StepProgress,
  SkipStep,
} from '@rapidtool/cad-ui';
import type { StepDefinition } from '@rapidtool/cad-ui';

// ─── Step Icon Map ───────────────────────────────────────────────────────────

const STEP_ICONS: Record<SoftJawsWorkflowStep, React.FC<{ className?: string }>> = {
  'import': Upload,
  'vise-config': Settings,
  'jaw-blank': Box,
  'jaw-profile': Wrench,
  'grip-features': Grip,
  'mounting-holes': CircleDot,
  'export': Download,
};

// ─── Step definitions for WorkflowNavigation ─────────────────────────────────

const WORKFLOW_STEP_DEFS: StepDefinition[] = SOFTJAWS_WORKFLOW_STEPS.map((stepId) => {
  const meta = STEP_CONFIG[stepId];
  return {
    id: stepId,
    label: meta.label,
    icon: STEP_ICONS[stepId],
    skippable: meta.skippable,
    description: meta.description,
  };
});

// ─── Placeholder Step Content ─────────────────────────────────────────────────

function StepPlaceholder({ stepId }: { stepId: string }) {
  const meta = STEP_CONFIG[stepId as keyof typeof STEP_CONFIG];
  if (!meta) return null;

  return (
    <div className="p-4 space-y-4">
      <div className="p-4 bg-white/[0.03] rounded-md border border-dashed border-border text-center text-muted-foreground text-[11px]">
        <div className="text-2xl mb-2">🚧</div>
        Step content will be implemented in
        <br />
        <code className="text-primary">features/{stepId}/</code>
      </div>
    </div>
  );
}

// ─── ContextOptionsPanel ──────────────────────────────────────────────────────

export function ContextOptionsPanel() {
  const {
    currentStep,
    currentStepMeta,
    currentStepIndex,
    totalSteps,
    completedSteps,
    skippedSteps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    skipAndAdvance,
    goToStep,
  } = useWorkflow();

  if (!currentStep || !currentStepMeta) return null;

  const StepIcon = STEP_ICONS[currentStep];
  const completedCount = completedSteps.length;
  const skippedCount = skippedSteps.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Step Header ──────────────────────────────────────────────── */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <StepIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-tech font-semibold text-lg leading-tight">
              {currentStepMeta.label}
            </h2>
            <p className="text-xs text-muted-foreground font-tech">
              {currentStepMeta.description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <StepProgress
          currentStep={currentStepIndex + 1}
          totalSteps={totalSteps}
          completedCount={completedCount}
          skippedCount={skippedCount}
          barHeight={6}
        />

        {/* Skip button for optional steps */}
        {currentStepMeta.skippable && (
          <div className="mt-3">
            <SkipStep onSkip={skipAndAdvance} />
          </div>
        )}
      </div>

      {/* ── Step Content (scrollable) ────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        {/* Help text accordion */}
        <CollapsiblePanel title="Help" defaultOpen={false}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentStepMeta.helpText}
          </p>
        </CollapsiblePanel>

        {/* Step-specific content */}
        <StepPlaceholder stepId={currentStep} />
      </div>

      {/* ── Workflow Navigation (bottom-pinned) ──────────────────── */}
      <WorkflowNavigation
        steps={WORKFLOW_STEP_DEFS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isCurrentStepSkippable={currentStepMeta.skippable}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipAndAdvance}
        onGoToStep={goToStep}
        lastStepLabel="Export"
      />
    </div>
  );
}
