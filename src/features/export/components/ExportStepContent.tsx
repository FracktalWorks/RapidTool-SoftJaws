import { AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useExport } from '../hooks/useExport';

export function ExportStepContent() {
  const { exportConfig, updateExportConfig } = useSoftJawsStore();
  const { status, error, exportJaw } = useExport();

  const isRunning = status === 'running';

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Choose export format and quality, then download the soft jaw file.
      </p>

      {/* ── Format ────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Format</p>
        <div className="flex gap-2">
          {(['stl', '3mf'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={isRunning}
              onClick={() => updateExportConfig({ format: fmt })}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs uppercase transition-colors disabled:opacity-50 ${
                exportConfig.format === fmt
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-accent'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
        {exportConfig.format === '3mf' && (
          <p className="mt-1.5 text-[10px] text-muted-foreground italic">
            3MF export is not yet available — STL is recommended.
          </p>
        )}
      </div>

      {/* ── Quality ───────────────────────────────────────────────── */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Quality</p>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map((q) => (
            <button
              key={q}
              type="button"
              disabled={isRunning}
              onClick={() => updateExportConfig({ quality: q })}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors disabled:opacity-50 ${
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

      {/* ── Status feedback ───────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>File downloaded successfully.</span>
        </div>
      )}

      {/* ── Download button ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={exportJaw}
        disabled={isRunning}
        className="mt-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            Download .{exportConfig.format.toUpperCase()}
          </>
        )}
      </button>
    </div>
  );
}
