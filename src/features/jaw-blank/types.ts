export type { JawBlankConfig } from '@/stores/types';

export const MATERIALS = [
  { value: 'aluminum-6061', label: 'Aluminum 6061' },
  { value: 'aluminum-7075', label: 'Aluminum 7075' },
  { value: 'steel-mild', label: 'Mild Steel' },
  { value: 'steel-4140', label: '4140 Steel' },
  { value: 'nylon', label: 'Nylon (PA6)' },
  { value: 'delrin', label: 'Delrin (POM)' },
] as const;
