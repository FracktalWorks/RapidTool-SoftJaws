import { useJawProfile } from '../hooks/useJawProfile';
import { useSoftJawsStore } from '../../../stores/softJawsStore';

export function JawProfileStepContent() {
  const jawProfile = useSoftJawsStore((s) => s.jawProfile);
  const updateJawProfile = useSoftJawsStore((s) => s.updateJawProfile);
  const { isGenerating, error, hasResult, generateProfile, clearResult } =
    useJawProfile();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-sm font-semibold text-foreground">Jaw Profile</h3>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Clearance (mm)
          </label>
          <input
            type="number"
            className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            value={jawProfile.clearance}
            step={0.01}
            min={0}
            max={5}
            onChange={(e) =>
              updateJawProfile({ clearance: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">
            Cavity Depth (mm)
          </label>
          <input
            type="number"
            className="rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
            value={jawProfile.depth}
            step={0.5}
            min={1}
            max={50}
            onChange={(e) =>
              updateJawProfile({ depth: parseFloat(e.target.value) || 5 })
            }
          />
        </div>
      </div>

      {error && (
        <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {hasResult && (
        <div className="rounded bg-green-500/10 p-2 text-xs text-green-600 dark:text-green-400">
          Profile generated. Proceed to grip features.
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={generateProfile}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating…' : hasResult ? 'Regenerate' : 'Generate Profile'}
        </button>
        {hasResult && (
          <button
            className="rounded border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={clearResult}
            disabled={isGenerating}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
