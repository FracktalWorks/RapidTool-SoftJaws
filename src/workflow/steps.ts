/**
 * Soft Jaws Workflow Steps
 */

export const SOFTJAWS_WORKFLOW_STEPS = [
  'import',
  'vise-config',
  'jaw-blank',
  'jaw-profile',
  'grip-features',
  'mounting-holes',
  'export',
] as const;

export type SoftJawsWorkflowStep = (typeof SOFTJAWS_WORKFLOW_STEPS)[number];
