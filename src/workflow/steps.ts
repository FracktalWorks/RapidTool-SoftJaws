export const SOFTJAWS_WORKFLOW_STEPS = [
  'vise-config',
  'import',
  'jaw-blank',
  'jaw-profile',
  'grip-features',
  'mounting-holes',
  'export',
] as const;

export type SoftJawsWorkflowStep = (typeof SOFTJAWS_WORKFLOW_STEPS)[number];
