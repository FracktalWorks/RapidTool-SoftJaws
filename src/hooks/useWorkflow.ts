/**
 * useWorkflow — App-level workflow hook wrapping cad-ui's useWorkflowStore
 */

import { useCallback } from 'react';
import { useWorkflowStore } from '@rapidtool/cad-ui';
import { SOFTJAWS_WORKFLOW_STEPS, STEP_CONFIG } from '@/workflow';
import type { SoftJawsWorkflowStep } from '@/workflow';

export function useWorkflow() {
  const store = useWorkflowStore();

  const currentStep = store.activeStep as SoftJawsWorkflowStep;

  const currentStepMeta = currentStep ? STEP_CONFIG[currentStep] : null;

  const goToStep = useCallback(
    (step: SoftJawsWorkflowStep) => {
      store.goToStep(step);
    },
    [store]
  );

  const nextStep = useCallback(() => {
    if (currentStep) store.completeStep(currentStep);
    store.nextStep();
  }, [store, currentStep]);
  const prevStep = useCallback(() => store.prevStep(), [store]);

  const completeAndAdvance = useCallback(() => {
    store.completeStep(currentStep);
    store.nextStep();
  }, [store, currentStep]);

  const skipAndAdvance = useCallback(() => {
    if (currentStepMeta?.skippable) {
      store.skipStep(currentStep);
      store.nextStep();
    }
  }, [store, currentStep, currentStepMeta]);

  const currentStepIndex = store.getStepIndex(currentStep);

  return {
    currentStep,
    currentStepMeta,
    currentStepIndex,
    totalSteps: SOFTJAWS_WORKFLOW_STEPS.length,
    steps: SOFTJAWS_WORKFLOW_STEPS,
    completedSteps: store.completedSteps,
    skippedSteps: store.skippedSteps,
    goToStep,
    nextStep,
    prevStep,
    completeAndAdvance,
    skipAndAdvance,
    canAccessStep: store.canAccessStep,
    getStepIndex: store.getStepIndex,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === SOFTJAWS_WORKFLOW_STEPS.length - 1,
  };
}
