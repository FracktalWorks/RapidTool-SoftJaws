/**
 * Workflow step gates — when a step is allowed and why.
 *
 * Each gate is a pure function of the small slice of state it needs.
 * Used in two places:
 *   1. AppToolbar — disables nav icons for blocked steps, surfaces the reason as a tooltip.
 *   2. The step content component — shows the same `reason` inline so users
 *      know what to do next.
 *
 * Keep the input shape small (primitives, not the whole store) so callers can
 * pass narrow slice selectors and avoid whole-store subscriptions.
 */

import type { SoftJawsWorkflowStep } from './steps';

export interface StepGateInputs {
  partCount: number;
  profileGenerated: boolean;
}

export interface StepGate {
  allowed: boolean;
  reason?: string;
}

const ALLOWED: StepGate = { allowed: true };

export function getStepGate(
  step: SoftJawsWorkflowStep,
  inputs: StepGateInputs,
): StepGate {
  switch (step) {
    case 'vise-config':
    case 'import':
    case 'jaw-blank':
      return ALLOWED;

    case 'jaw-profile':
      return inputs.partCount > 0
        ? ALLOWED
        : { allowed: false, reason: 'Import a part first.' };

    case 'grip-features':
      return inputs.profileGenerated
        ? ALLOWED
        : { allowed: false, reason: 'Generate the jaw profile first.' };

    case 'export':
      // Export is always allowed — falls back to the raw blank if no profile.
      return ALLOWED;

    default:
      return ALLOWED;
  }
}
