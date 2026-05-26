import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Ruler } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useJawProfile } from '../hooks/useJawProfile';
import { getStepGate } from '@/workflow';
import { AXIS_TEXT_CLASS } from '@/utils/axisColors';
import { computeWorldSpanX } from '@/utils/partGeometry';
import { useDimensionHoverStore } from '@/stores/dimensionHover';

/** Minimum back-wall thickness behind the pocket — keeps the jaw structurally sound. */
const BACK_WALL_MIN = 5;

export function JawProfileStepContent() {
  const jawProfile        = useSoftJawsStore((s) => s.jawProfile);
  const jawBlank          = useSoftJawsStore((s) => s.jawBlank);
  const partCount         = useSoftJawsStore((s) => s.parts.length);
  const profileGenerated  = useSoftJawsStore((s) => s.jawProfile.generated);
  const activePart        = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });
  const updateJawProfile  = useSoftJawsStore((s) => s.updateJawProfile);
  const setHovered        = useDimensionHoverStore((s) => s.setHovered);
  const clearHover        = useDimensionHoverStore((s) => s.clear);
  const { status, error, faceCount, generate } = useJawProfile();

  const gate        = getStepGate('jaw-profile', { partCount, profileGenerated });
  const isRunning   = status === 'running';
  const canGenerate = gate.allowed && !isRunning;

  // Rotation-aware part X span (the clamping-direction extent) — same helper
  // used by useJawProfile so the displayed value matches the CSG-input value.
  const partSpanX = useMemo(
    () => (activePart ? computeWorldSpanX(activePart) : null),
    [activePart],
  );

  const minThickness = Math.min(jawBlank.left.thickness, jawBlank.right.thickness);

  // Pocket depth must leave at least BACK_WALL_MIN of stock behind it,
  // otherwise the CSG cuts through the jaw and the part has no back wall.
  const depthMax = Math.max(1, minThickness - BACK_WALL_MIN);
  const handleDepthChange = (raw: number) => {
    const clamped = Math.max(1, Math.min(depthMax, raw));
    updateJawProfile({ depth: clamped });
  };
  const handleClearanceChange = (raw: number) => {
    const clamped = Math.max(0, Math.min(2, raw));
    updateJawProfile({ clearance: clamped });
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Configure cavity parameters, then generate the jaw profile via CSG subtraction.
      </p>

      {/* ── Derived from imported part — Trinckle-style read-only panel ── */}
      <div className="rounded-lg border border-border/50 bg-background/50 p-3 tech-glass">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Derived from Imported Part
        </p>
        {partSpanX != null ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-tech uppercase tracking-widest text-muted-foreground/60">
              Part span (X)
            </span>
            <span className={`text-sm font-semibold font-tech ${AXIS_TEXT_CLASS.x}`}>
              {partSpanX.toFixed(2)} mm
            </span>
            <span className="text-[9px] text-muted-foreground/60 font-tech">
              rotation-aware clamping-direction extent
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-tech">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            <span>Import a part to see derived dimensions.</span>
          </div>
        )}
      </div>

      {/* ── Parameters ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Clearance
            <span className="ml-1.5 text-[9px] text-muted-foreground/60 font-tech font-normal">
              0–2
            </span>
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={jawProfile.clearance}
              disabled={isRunning}
              onChange={(e) => handleClearanceChange(parseFloat(e.target.value) || 0)}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>
        <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed pl-0.5 -mt-1.5">
          Pocket is offset outward on every face by this amount — tolerance for fit.
        </p>

        <label
          className="flex items-center justify-between text-xs"
          onMouseEnter={() => setHovered({ scope: 'profile', field: 'depth' })}
          onMouseLeave={clearHover}
        >
          <span className={`font-medium ${AXIS_TEXT_CLASS.x}`}>
            Pocket depth (X)
            <span className="ml-1.5 text-[9px] text-muted-foreground/60 font-tech font-normal">
              1–{depthMax.toFixed(1)}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={depthMax}
              step={0.5}
              value={jawProfile.depth}
              disabled={isRunning}
              onChange={(e) => handleDepthChange(parseFloat(e.target.value) || 0)}
              onFocus={() => setHovered({ scope: 'profile', field: 'depth' })}
              onBlur={clearHover}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs disabled:opacity-50"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>
        <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed pl-0.5 -mt-1.5">
          Depth cut into the jaw along the clamping axis. Leaves {(minThickness - jawProfile.depth).toFixed(1)} mm back-wall stock.
        </p>
      </div>

      {/* ── Status feedback ───────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span>Profile generated — visible in the 3D viewport.</span>
            {faceCount != null && (
              <span className="text-[10px] text-green-700/80 dark:text-green-300/70 font-tech">
                {faceCount.toLocaleString()} triangles across both jaws · pocket {jawProfile.depth} mm deep · {jawProfile.clearance} mm clearance
              </span>
            )}
          </div>
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

      {!gate.allowed && gate.reason && (
        <p className="text-xs text-muted-foreground">{gate.reason}</p>
      )}
    </div>
  );
}
