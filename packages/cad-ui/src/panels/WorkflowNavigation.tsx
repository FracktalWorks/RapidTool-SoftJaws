/**
 * WorkflowNavigation — Generic step-based workflow navigation panel
 *
 * Provides a complete workflow navigation UI with:
 * - Step progress bar (StepProgress)
 * - Skip button for optional steps (SkipStep)
 * - Step breadcrumb mini-map with status indicators
 * - Back / Next navigation buttons
 *
 * The consuming app provides step definitions (icons, labels),
 * current state, and navigation callbacks.
 *
 * @module @rapidtool/cad-ui/panels
 *
 * @example
 * import { WorkflowNavigation, StepDefinition } from '@rapidtool/cad-ui';
 * import { Upload, Settings, Download } from 'lucide-react';
 *
 * const steps: StepDefinition[] = [
 *   { id: 'import', label: 'Import', icon: Upload },
 *   { id: 'design', label: 'Design', icon: Settings },
 *   { id: 'export', label: 'Export', icon: Download },
 * ];
 *
 * <WorkflowNavigation
 *   steps={steps}
 *   currentStep="design"
 *   completedSteps={['import']}
 *   onNext={handleNext}
 *   onPrev={handlePrev}
 *   onGoToStep={handleGoTo}
 * />
 */

import React from 'react';
import { StepProgress } from '../primitives/StepProgress';
import { SkipStep } from '../primitives/SkipStep';

// ─── Inline SVG Icons ────────────────────────────────────────────────────────

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const MinusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StepDefinition {
  /** Unique step identifier */
  id: string;
  /** Display label */
  label: string;
  /** Step icon component */
  icon: React.FC<{ className?: string }>;
  /** Whether this step can be skipped */
  skippable?: boolean;
  /** Whether this step is disabled */
  disabled?: boolean;
  /** Description or help text */
  description?: string;
}

export type StepStatus = 'current' | 'completed' | 'skipped' | 'pending';

export interface WorkflowNavigationProps {
  /** Step definitions (id, label, icon, skippable) */
  steps: StepDefinition[];
  /** Current active step id */
  currentStep: string;
  /** Array of completed step ids */
  completedSteps: string[];
  /** Array of skipped step ids */
  skippedSteps?: string[];
  /** Whether current step is the first */
  isFirstStep?: boolean;
  /** Whether current step is the last */
  isLastStep?: boolean;
  /** Whether current step is skippable */
  isCurrentStepSkippable?: boolean;
  /** Navigate to next step */
  onNext: () => void;
  /** Navigate to previous step */
  onPrev: () => void;
  /** Skip current step and advance */
  onSkip?: () => void;
  /** Navigate to a specific step */
  onGoToStep: (stepId: string) => void;
  /** Label for the last step button (default: "Export") */
  lastStepLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  steps,
  currentStep,
  completedSteps,
  skippedSteps = [],
  isFirstStep = false,
  isLastStep = false,
  isCurrentStepSkippable = false,
  onNext,
  onPrev,
  onSkip,
  onGoToStep,
  lastStepLabel = 'Export',
  className = '',
}) => {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const getStepStatus = (stepId: string): StepStatus => {
    if (stepId === currentStep) return 'current';
    if (completedSteps.includes(stepId)) return 'completed';
    if (skippedSteps.includes(stepId)) return 'skipped';
    return 'pending';
  };

  return (
    <div className={`border-t border-border/50 ${className}`}>
      {/* Progress bar */}
      <div className="px-3 pt-3">
        <StepProgress
          currentStep={currentStepIndex + 1}
          totalSteps={steps.length}
          completedCount={completedSteps.length}
          skippedCount={skippedSteps.length}
          barHeight={6}
        />
      </div>

      {/* Skip button for optional steps */}
      {isCurrentStepSkippable && onSkip && (
        <div className="px-3 pt-3">
          <SkipStep onSkip={onSkip} />
        </div>
      )}

      {/* Step breadcrumb mini-map */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-1">
          {steps.map((step) => {
            const status = getStepStatus(step.id);
            const IconComponent = step.icon;

            return (
              <button
                key={step.id}
                onClick={() => onGoToStep(step.id)}
                disabled={step.disabled}
                className={`
                  relative flex items-center justify-center w-8 h-8 rounded-md transition-all
                  ${
                    status === 'current'
                      ? 'bg-primary text-primary-foreground'
                      : status === 'completed'
                        ? 'bg-primary/20 text-primary hover:bg-primary/30'
                        : status === 'skipped'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
                title={`${step.label}${status === 'skipped' ? ' (Skipped)' : ''}${step.skippable ? ' (Optional)' : ''}`}
              >
                {status === 'completed' ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : status === 'skipped' ? (
                  <MinusCircleIcon className="w-4 h-4" />
                ) : (
                  <IconComponent className="w-4 h-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="px-3 pb-3 flex gap-2 items-center">
        <button
          onClick={onPrev}
          disabled={isFirstStep}
          className="h-9 px-4 inline-flex items-center justify-center rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent tech-transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        <div className="flex-1" />

        <button
          onClick={onNext}
          disabled={isLastStep}
          className="h-9 px-4 inline-flex items-center justify-center rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 tech-transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLastStep ? lastStepLabel : 'Next →'}
        </button>
      </div>
    </div>
  );
};
