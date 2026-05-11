import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { getStepGate } from '@/workflow';
import { useMountingHoles } from '../hooks/useMountingHoles';

const BOLT_SIZES = [4, 5, 6, 8, 10, 12, 16];

export function MountingHolesStepContent() {
  const mountingHoles      = useSoftJawsStore((s) => s.mountingHoles);
  const partCount          = useSoftJawsStore((s) => s.parts.length);
  const profileGenerated   = useSoftJawsStore((s) => s.jawProfile.generated);
  const updateMountingHoles = useSoftJawsStore((s) => s.updateMountingHoles);
  const visePitch          = useViseStore((s) => s.viseConfig.tSlotSpacing);
  const { status, error, generate } = useMountingHoles();

  const gate          = getStepGate('mounting-holes', { partCount, profileGenerated });
  const isRunning     = status === 'running';
  const canGenerate   = gate.allowed && !isRunning;
  const matchesVise   = visePitch != null && Math.abs(mountingHoles.spacing - visePitch) < 0.01;
  const showVisePitch = visePitch != null && !matchesVise;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Configure mounting bolts, then drill through-holes + counterbores into both blanks.
      </p>

      {/* ── Parameters ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Bolt size</span>
          <select
            value={mountingHoles.boltSize}
            disabled={isRunning}
            onChange={(e) => updateMountingHoles({ boltSize: Number(e.target.value) })}
            className="rounded border border-input bg-background px-2 py-1 text-xs disabled:opacity-50"
          >
            {BOLT_SIZES.map((s) => (
              <option key={s} value={s}>M{s}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Spacing</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={20} max={200} step={5}
                value={mountingHoles.spacing}
                disabled={isRunning}
                onChange={(e) => updateMountingHoles({ spacing: parseFloat(e.target.value) || 0 })}
                className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          </label>
          {matchesVise && (
            <span className="text-[10px] text-green-600 dark:text-green-400 font-tech pl-0.5">
              ✓ Matches vise bolt pattern ({visePitch} mm)
            </span>
          )}
          {showVisePitch && (
            <div className="flex items-center justify-between pl-0.5">
              <span className="text-[10px] text-amber-500 font-tech">
                Vise pattern: {visePitch} mm — bolts won't align
              </span>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => updateMountingHoles({ spacing: visePitch! })}
                className="text-[10px] font-tech underline text-primary hover:text-primary/80 disabled:opacity-50"
              >
                Match vise
              </button>
            </div>
          )}
        </div>

        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Count per jaw</span>
          <input
            type="number" min={1} max={8} step={1}
            value={mountingHoles.count}
            disabled={isRunning}
            onChange={(e) => updateMountingHoles({ count: parseInt(e.target.value) || 1 })}
            className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
          />
        </label>

        <div className="flex gap-2">
          {(['standard', 'custom'] as const).map((p) => (
            <button
              key={p}
              type="button"
              disabled={isRunning}
              onClick={() => updateMountingHoles({ pattern: p })}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors disabled:opacity-50 ${
                mountingHoles.pattern === p
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-accent'
              }`}
            >
              {p}
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
          <span>Holes drilled — visible in the 3D viewport.</span>
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
            Drilling…
          </>
        ) : status === 'success' ? (
          'Re-drill Holes'
        ) : (
          'Drill Mounting Holes'
        )}
      </button>

      {!gate.allowed && gate.reason && (
        <p className="text-xs text-muted-foreground">{gate.reason}</p>
      )}
    </div>
  );
}
