/**
 * ContextOptionsPanel — Step-based workflow panel
 *
 * Dispatches to the correct feature component for each workflow step
 * via a STEP_COMPONENTS map, replacing the earlier StepPlaceholder.
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
import { STEP_CONFIG, SOFTJAWS_WORKFLOW_STEPS } from '@/workflow';
import type { SoftJawsWorkflowStep } from '@/workflow';
import {
  CollapsiblePanel,
  WorkflowNavigation,
  StepProgress,
  SkipStep,
} from '@rapidtool/cad-ui';
import type { StepDefinition } from '@rapidtool/cad-ui';

// Feature step components
import { ImportStepContent }       from '@/features/import';
import { ViseConfigStepContent }   from '@/features/vise-config';
import { JawBlankStepContent }     from '@/features/jaw-blank';
import { JawProfileStepContent }   from '@/features/jaw-profile';
import { GripFeaturesStepContent } from '@/features/grip-features';
import { MountingHolesStepContent } from '@/features/mounting-holes';
import { ExportStepContent }       from '@/features/export';

// ─── Step Icon Map ─────────────────────────────────────────────────────────────────

const STEP_ICONS: Record<SoftJawsWorkflowStep, React.FC<{ className?: string }>> = {
  'import':         Upload,
  'vise-config':    Settings,
  'jaw-blank':      Box,
  'jaw-profile':    Wrench,
  'grip-features':  Grip,
  'mounting-holes': CircleDot,
  'export':         Download,
};

// ─── Step Component Map ────────────────────────────────────────────────────────

const STEP_COMPONENTS: Record<SoftJawsWorkflowStep, React.FC> = {
  'import':         ImportStepContent,
  'vise-config':    ViseConfigStepContent,
  'jaw-blank':      JawBlankStepContent,
  'jaw-profile':    JawProfileStepContent,
  'grip-features':  GripFeaturesStepContent,
  'mounting-holes': MountingHolesStepContent,
  'export':         ExportStepContent,
};

// ─── Step definitions for WorkflowNavigation ──────────────────────────────────

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

// ─── ContextOptionsPanel ────────────────────────────────────────────────────────

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

  const StepIcon       = STEP_ICONS[currentStep];
  const StepContent    = STEP_COMPONENTS[currentStep];
  const completedCount = completedSteps.length;
  const skippedCount   = skippedSteps.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Step Header ──────────────────────────────────────────── */}
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

        <StepProgress
          currentStep={currentStepIndex + 1}
          totalSteps={totalSteps}
          completedCount={completedCount}
          skippedCount={skippedCount}
          barHeight={6}
        />

        {currentStepMeta.skippable && (
          <div className="mt-3">
            <SkipStep onSkip={skipAndAdvance} />
          </div>
        )}
      </div>

      {/* ── Step Content (scrollable) ───────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        <CollapsiblePanel title="Help" defaultOpen={false}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {currentStepMeta.helpText}
          </p>
        </CollapsiblePanel>

        <StepContent />
      </div>

      {/* ── Workflow Navigation (bottom-pinned) ────────────────────── */}
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
