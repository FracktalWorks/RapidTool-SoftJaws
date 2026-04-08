import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileBox, X, AlertCircle } from 'lucide-react';
import { useImport } from '../hooks/useImport';
import type { ProcessedPart } from '@/stores/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDims(bb: ProcessedPart['boundingBox']): string {
  const dx = (bb.max[0] - bb.min[0]).toFixed(1);
  const dy = (bb.max[1] - bb.min[1]).toFixed(1);
  const dz = (bb.max[2] - bb.min[2]).toFixed(1);
  return `${dx} × ${dy} × ${dz} mm`;
}

// ─── PartCard ─────────────────────────────────────────────────────────────────

function PartCard({ part, onRemove }: { part: ProcessedPart; onRemove: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <FileBox className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-xs font-medium">{part.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {part.faceCount.toLocaleString()} faces · {formatBytes(part.fileSize)}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatDims(part.boundingBox)}</p>
      </div>
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Remove part"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith('.stl')
      );
      if (files.length) onFiles(files);
    },
    [onFiles, disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = '';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop STL files or click to browse"
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragging
          ? 'border-primary bg-primary/5'
          : disabled
          ? 'cursor-not-allowed border-border opacity-50'
          : 'cursor-pointer border-border hover:border-primary hover:bg-primary/5'
      }`}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div>
        <p className="text-xs font-medium">Drop STL files here</p>
        <p className="text-[10px] text-muted-foreground">or click to browse &mdash; max 200 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".stl"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
}

// ─── ImportStepContent ────────────────────────────────────────────────────────

export function ImportStepContent() {
  const { parts, importFile, removePart, isLoading, error, clearError } = useImport();

  const handleFiles = (files: File[]) => {
    files.forEach((f) => void importFile(f));
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <DropZone onFiles={handleFiles} disabled={isLoading} />

      {isLoading && (
        <p className="text-center text-xs text-muted-foreground">Parsing…</p>
      )}

      {parts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {parts.length} part{parts.length !== 1 ? 's' : ''} loaded
          </p>
          {parts.map((part) => (
            <PartCard key={part.id} part={part} onRemove={() => removePart(part.id)} />
          ))}
        </div>
      )}

      {!isLoading && parts.length === 0 && !error && (
        <p className="text-center text-[10px] text-muted-foreground">
          No parts loaded yet. Import an STL to begin.
        </p>
      )}
    </div>
  );
}
