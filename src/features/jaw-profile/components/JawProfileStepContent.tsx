import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Ruler } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useJawProfile } from '../hooks/useJawProfile';
import { getStepGate } from '@/workflow';
import { AXIS_TEXT_CLASS } from '@/utils/axisColors';
import { computeWorldSpanX, leftBracketInnerX, rightBracketInnerX } from '@/utils/partGeometry';
import { useViseStore } from '@/stores/viseStore';
import { bracketInnerX } from '@/features/vise-config/data/presets';
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
  const viseConfig        = useViseStore((s) => s.viseConfig);
  const setHovered        = useDimensionHoverStore((s) => s.setHovered);
  const clearHover        = useDimensionHoverStore((s) => s.clear);
  const updateJawProfile  = useSoftJawsStore((s) => s.updateJawProfile);
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

  // Compute overlaps dynamically
  const { leftOverlap, rightOverlap } = useMemo(() => {
    if (!activePart || partSpanX === null) return { leftOverlap: 0, rightOverlap: 0 };
    const leftInnerXActual = leftBracketInnerX(viseConfig, jawBlank, activePart, { ...jawProfile, generated: false }, jawBlank.clearance);
    const rightInnerXActual = rightBracketInnerX(viseConfig, jawBlank, activePart, { ...jawProfile, generated: false }, jawBlank.clearance);
    
    const leftFaceXActual = -leftInnerXActual + jawBlank.left.thickness;
    const rightFaceXActual = rightInnerXActual - jawBlank.right.thickness;
    
    const partCenterWorldX = activePart.transform.position.x;
    
    const partLeftEdgeX = partCenterWorldX - partSpanX / 2;
    const partRightEdgeX = partCenterWorldX + partSpanX / 2;

    const maxLeftDepth = Math.max(0.0, jawBlank.left.thickness - BACK_WALL_MIN);
    const maxRightDepth = Math.max(0.0, jawBlank.right.thickness - BACK_WALL_MIN);
    
    return {
      leftOverlap: Math.min(maxLeftDepth, Math.max(0.0, leftFaceXActual - partLeftEdgeX)),
      rightOverlap: Math.min(maxRightDepth, Math.max(0.0, partRightEdgeX - rightFaceXActual))
    };
  }, [activePart, partSpanX, viseConfig, jawBlank, jawProfile]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Verify layout overlaps, then generate the jaw profile via CSG subtraction.
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

      {/* ── Visual Overlap Display ─────────────────────────────────── */}
      {activePart && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 p-4 tech-glass">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Visual Overlaps (Pocket Depths)
          </p>
          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-tech uppercase tracking-widest text-muted-foreground/60">Left Overlap (X)</span>
              <span className={`text-sm font-semibold font-tech ${AXIS_TEXT_CLASS.x}`}>
                {leftOverlap.toFixed(2)} mm
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-tech uppercase tracking-widest text-muted-foreground/60">Right Overlap (X)</span>
              <span className={`text-sm font-semibold font-tech ${AXIS_TEXT_CLASS.x}`}>
                {rightOverlap.toFixed(2)} mm
              </span>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed pl-0.5 border-t border-border/20 pt-2">
            ℹ Pocket depths are derived directly from the workpiece's visual overlap on the jaw blanks. 
            Adjust jaw thickness (Step 3) or vise stroke (Step 1) to alter the overlaps.
          </p>
        </div>
      )}

      {/* ── Pocket Tolerance ───────────────────────────────────────── */}
      {activePart && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 p-4 tech-glass">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Pocket Tolerance
          </p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">Fit Tolerance</span>
              <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed">
                Free space added around the workpiece profile on the pocket cut.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={jawProfile.tolerance}
                onChange={(e) => updateJawProfile({ tolerance: parseFloat(e.target.value) || 0 })}
                className="w-28 rounded border border-input/60 bg-background/50 px-2 py-1 text-right text-xs font-tech outline-none focus:ring-1 focus:ring-primary/40"
              />
              <span className="text-[10px] text-muted-foreground/60 font-tech w-4">mm</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Viewport Controls ──────────────────────────────────── */}
      {activePart && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 p-4 tech-glass">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            3D Viewport Controls
          </p>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-muted-foreground font-tech">Hide Model</span>
              <input
                type="checkbox"
                checked={jawProfile.hideModel ?? false}
                onChange={(e) => updateJawProfile({ hideModel: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-input/60 bg-background/50 text-primary focus:ring-1 focus:ring-primary/40 focus:ring-offset-0 cursor-pointer"
              />
            </label>
          </div>
          {profileGenerated && (
            <p className="text-[9.5px] text-primary/80 font-tech leading-relaxed pl-1 border-l-2 border-primary/40 mt-1">
              💡 Toggle <strong>Hide Model</strong> to inspect the pocket cavities cut into the jaws.
            </p>
          )}
        </div>
      )}

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
                {faceCount.toLocaleString()} triangles across both jaws · {jawProfile.tolerance} mm tolerance
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
