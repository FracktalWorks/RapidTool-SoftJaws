import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface ProcessingState {
  isProcessing: boolean;
  processingStage: string;
  progress: number; // 0–100
  fileError: string | null;
  isMeshProcessing: boolean;
}

interface ProcessingActions {
  setProcessing: (isProcessing: boolean, stage?: string) => void;
  setProgress: (progress: number) => void;
  setFileError: (error: string | null) => void;
  setMeshProcessing: (isMeshProcessing: boolean) => void;
  resetProcessing: () => void;
}

const initialState: ProcessingState = {
  isProcessing: false,
  processingStage: '',
  progress: 0,
  fileError: null,
  isMeshProcessing: false,
};

export const useProcessingStore = create<ProcessingState & ProcessingActions>()(
  immer((set) => ({
    ...initialState,

    setProcessing: (isProcessing, stage = '') =>
      set((s) => {
        s.isProcessing = isProcessing;
        s.processingStage = stage;
        if (!isProcessing) s.progress = 0;
      }),

    setProgress: (progress) =>
      set((s) => {
        s.progress = progress;
      }),

    setFileError: (error) =>
      set((s) => {
        s.fileError = error;
      }),

    setMeshProcessing: (isMeshProcessing) =>
      set((s) => {
        s.isMeshProcessing = isMeshProcessing;
      }),

    resetProcessing: () => set(() => ({ ...initialState })),
  })),
);
