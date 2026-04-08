import { useProcessingStore } from '../stores/processingStore';

export function useIsProcessing() {
  return useProcessingStore((s) => s.isProcessing || s.isMeshProcessing);
}

export function useProcessingStage() {
  return useProcessingStore((s) => s.processingStage);
}

export function useProcessingProgress() {
  return useProcessingStore((s) => s.progress);
}

export function useFileError() {
  return useProcessingStore((s) => s.fileError);
}

export function useSetProcessing() {
  return useProcessingStore((s) => s.setProcessing);
}

export function useSetProgress() {
  return useProcessingStore((s) => s.setProgress);
}

export function useSetFileError() {
  return useProcessingStore((s) => s.setFileError);
}

export function useSetMeshProcessing() {
  return useProcessingStore((s) => s.setMeshProcessing);
}

export function useResetProcessing() {
  return useProcessingStore((s) => s.resetProcessing);
}
