import { useEffect, useState } from 'react';
import { useProcessingStore } from '../stores/processingStore';

export function ProcessingOverlay() {
  const isProcessing = useProcessingStore((s) => s.isProcessing);
  const isMeshProcessing = useProcessingStore((s) => s.isMeshProcessing);
  const stage = useProcessingStore((s) => s.processingStage);
  const progress = useProcessingStore((s) => s.progress);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isProcessing || isMeshProcessing) {
      setVisible(true);
    } else {
      // Small delay so the bar completes visually before hiding
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [isProcessing, isMeshProcessing]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-end pb-8">
      {/* Progress bar at very bottom */}
      <div className="w-full max-w-md rounded-full bg-muted/60 backdrop-blur">
        <div
          className="h-1.5 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Floating status pill */}
      <div className="mt-3 flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 shadow-lg backdrop-blur ring-1 ring-border">
        {/* Spinner */}
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-foreground">
          {stage || 'Processing…'}
        </span>
      </div>
    </div>
  );
}
