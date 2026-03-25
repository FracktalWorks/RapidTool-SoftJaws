import React from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';

export function ExportStepContent() {
  const { exportConfig, updateExportConfig } = useSoftJawsStore();

  const handleDownload = () => {
    // TODO: wire to cad-core export pipeline
    console.log('Export:', exportConfig);
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Choose export format and quality, then download the soft jaw file.
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Format</p>
          <div className="flex gap-2">
            {(['stl', '3mf'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => updateExportConfig({ format: fmt })}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs uppercase transition-colors ${
                  exportConfig.format === fmt
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background hover:bg-accent'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs text-muted-foreground">Quality</p>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => updateExportConfig({ quality: q })}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
                  exportConfig.quality === q
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background hover:bg-accent'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="mt-2 rounded-md bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Download .{exportConfig.format.toUpperCase()}
      </button>
    </div>
  );
}
