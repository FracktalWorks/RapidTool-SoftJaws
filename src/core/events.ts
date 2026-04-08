export const EVENTS = {
  PART_IMPORTED: 'softjaws:part-imported',
  PART_REMOVED: 'softjaws:part-removed',
  VISE_CONFIG_CHANGED: 'softjaws:vise-config-changed',
  JAW_BLANK_CHANGED: 'softjaws:jaw-blank-changed',
  JAW_PROFILE_CHANGED: 'softjaws:jaw-profile-changed',
  GRIP_FEATURES_CHANGED: 'softjaws:grip-features-changed',
  MOUNTING_HOLES_CHANGED: 'softjaws:mounting-holes-changed',
  CSG_STARTED: 'softjaws:csg-started',
  CSG_PROGRESS: 'softjaws:csg-progress',
  CSG_COMPLETED: 'softjaws:csg-completed',
  CSG_FAILED: 'softjaws:csg-failed',
  EXPORT_STARTED: 'softjaws:export-started',
  EXPORT_COMPLETED: 'softjaws:export-completed',
  EXPORT_FAILED: 'softjaws:export-failed',
  STEP_CHANGED: 'softjaws:step-changed',
  PART_SELECTED: 'softjaws:part-selected',
  VIEWPORT_RESET: 'softjaws:viewport-reset',
} as const;

export type AppEventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface AppEventPayloadMap {
  [EVENTS.PART_IMPORTED]: { partId: string; fileName: string };
  [EVENTS.PART_REMOVED]: { partId: string };
  [EVENTS.VISE_CONFIG_CHANGED]: { type: string };
  [EVENTS.JAW_BLANK_CHANGED]: Record<string, never>;
  [EVENTS.JAW_PROFILE_CHANGED]: Record<string, never>;
  [EVENTS.GRIP_FEATURES_CHANGED]: Record<string, never>;
  [EVENTS.MOUNTING_HOLES_CHANGED]: Record<string, never>;
  [EVENTS.CSG_STARTED]: Record<string, never>;
  [EVENTS.CSG_PROGRESS]: { progress: number; stage: string };
  [EVENTS.CSG_COMPLETED]: { durationMs: number };
  [EVENTS.CSG_FAILED]: { error: string };
  [EVENTS.EXPORT_STARTED]: { format: string };
  [EVENTS.EXPORT_COMPLETED]: { format: string; sizeBytes: number };
  [EVENTS.EXPORT_FAILED]: { error: string };
  [EVENTS.STEP_CHANGED]: { step: string };
  [EVENTS.PART_SELECTED]: { partId: string | null };
  [EVENTS.VIEWPORT_RESET]: Record<string, never>;
}

export function dispatchAppEvent<E extends AppEventName>(
  name: E,
  payload: AppEventPayloadMap[E],
): void {
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

export function addAppEventListener<E extends AppEventName>(
  name: E,
  handler: (payload: AppEventPayloadMap[E]) => void,
): () => void {
  const listener = (e: Event) =>
    handler((e as CustomEvent<AppEventPayloadMap[E]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
