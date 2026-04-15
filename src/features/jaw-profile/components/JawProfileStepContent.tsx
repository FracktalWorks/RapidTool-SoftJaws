import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useJawProfile } from '../hooks/useJawProfile';

export function JawProfileStepContent() {
  const { jawProfile, parts, updateJawProfile } = useSoftJawsStore();
  const { status, error, generate } = useJawProfile();

  const canGenerate = parts.length > 0 && status !== 'running';
  const isRunning   = status === 'running';

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Configure cavity parameters, then generate the jaw profile via CSG subtraction.
      </p>

      {/* ── Parameters ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Clearance</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={jawProfile.clearance}
              disabled={isRunning}
              onChange={(e) => updateJawProfile({ clearance: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>

        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pocket depth</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={jawProfile.depth}
              disabled={isRunning}
              onChange={(e) => updateJawProfile({ depth: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>
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
          <span>Profile generated — visible in the 3D viewport.</span>
        </div>
      )}

      {/* ── Generate button ───────────────────────────────────────── */}
      <button
        type="button"
        disabled={!canGenerate}
        onClick={generate}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : jawProfile.generated ? (
          'Regenerate Profile'
        ) : (
          'Generate Profile'
        )}
      </button>

      {!parts.length && (
        <p className="text-xs text-muted-foreground">Import a part in the previous step first.</p>
      )}
    </div>
  );
}
