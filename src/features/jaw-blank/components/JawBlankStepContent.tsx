/**
 * JawBlankStepContent — Raw stock dimensions for the soft jaw blanks.
 *
 * This step is completely independent of the vise config — changing the
 * machine's jaw width/height does NOT resize these blanks. These are
 * separate pieces of aluminum stock that the machinist sources.
 *
 * Trinckle-aligned parameter set:
 *   Length (X)  = Thickness — how far the jaw sticks out from the L-bracket
 *   Width (Y)   = Face      — along the jaw face (Z-axis in world space)
 *   Height (Z)  = Height    — vertical extent of the blank
 *
 * Computed (read-only) display values:
 *   Clamping Width — the part width derived from its bounding box
 *   Jaw Gap        — the total opening (clamping width + 2 × clampGap)
 */

import { useMemo } from 'react';
import { Ruler, Info } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { pillarFaceWidth } from '@/features/vise-config/data/presets';

type DimField = 'thickness' | 'face' | 'height';

const DIMS: {
  field: DimField;
  label: string;
  trinckleLabel: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    field: 'thickness',
    label: 'Length (X)',
    trinckleLabel: 'Jaw reach from carriage',
    hint: 'How far the jaw blank sticks out from the L-bracket toward the part.',
    min: 5,
    max: 150,
  },
  {
    field: 'face',
    label: 'Width (Y)',
    trinckleLabel: 'Jaw face width',
    hint: 'Width of the jaw contact face. Capped by the vise L-bracket width.',
    min: 10,
    max: 400,
  },
  {
    field: 'height',
    label: 'Height (Z)',
    trinckleLabel: 'Jaw stock height',
    hint: 'Vertical height of the blank. Must be tall enough to contain the bolt pattern.',
    min: 10,
    max: 300,
  },
];

export function JawBlankStepContent() {
  const { jawBlank, updateJawBlank, clampGap } = useSoftJawsStore();
  const viseConfig = useViseStore((s) => s.viseConfig);

  // Active part bounding box for derived read-only values
  const activePartBbox = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id)?.boundingBox ?? null) : null;
  });

  // Max recommended face width driven by the L-bracket pillar
  const maxFaceWidth = useMemo(() => pillarFaceWidth(viseConfig), [viseConfig]);

  // Derived: clamping width = actual part width
  const clampingWidth = useMemo(() => {
    if (!activePartBbox) return null;
    return activePartBbox.max[0] - activePartBbox.min[0];
  }, [activePartBbox]);

  // Derived: jaw gap = clamping width + 2 × clearance gap on each side
  const jawGap = clampingWidth !== null ? clampingWidth + 2 * clampGap : null;

  const faceOverhang = jawBlank.face > maxFaceWidth;

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto pb-20">

      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-foreground">Jaw Blank Stock</p>
        <p className="mt-1 text-[11px] text-muted-foreground font-tech tracking-wide leading-relaxed border-l-2 border-primary/40 pl-2">
          Define the raw aluminium stock dimensions. These are <strong>independent</strong> of the machine vise — 
          changing the vise hardware specs does not resize these blanks.
        </p>
      </div>

      {/* Computed read-only values (Trinckle-style derived display) */}
      <div className="rounded-lg border border-border/50 bg-background/50 p-4 tech-glass">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Derived from Imported Part
        </p>
        {activePartBbox ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-tech uppercase tracking-widest text-muted-foreground/60">Clamping Width</span>
              <span className="text-sm font-semibold text-primary font-tech">
                {clampingWidth?.toFixed(2)} mm
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-tech">part X width</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-tech uppercase tracking-widest text-muted-foreground/60">Jaw Gap</span>
              <span className="text-sm font-semibold text-foreground font-tech">
                {jawGap?.toFixed(2)} mm
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-tech">part + 2× clearance</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 font-tech">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            <span>Import a part to see derived dimensions.</span>
          </div>
        )}
      </div>

      {/* Jaw Blank Dimensions */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 p-4 tech-glass">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Blank Dimensions
        </p>

        {/* Face overhang warning */}
        {faceOverhang && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <span className="text-[10px] text-amber-400 font-tech leading-relaxed">
              ⚠ Width ({jawBlank.face}mm) exceeds L-bracket width ({maxFaceWidth.toFixed(1)}mm). 
              The jaw blank will be capped in the 3D view.
            </span>
          </div>
        )}

        <div className="grid gap-3">
          {DIMS.map(({ field, label, trinckleLabel, hint, min, max }) => {
            const isMaxed = field === 'face' && faceOverhang;
            return (
              <label key={field} className="flex flex-col gap-1.5 group">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    <span className="ml-2 text-[9px] text-muted-foreground/60 font-tech">{trinckleLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={0.5}
                      value={jawBlank[field]}
                      onChange={(e) => updateJawBlank({ [field]: parseFloat(e.target.value) || 0 })}
                      className={`w-20 rounded border px-2 py-1 text-right text-xs font-tech outline-none tech-transition hover:bg-background focus:ring-1 focus:ring-primary/40 ${isMaxed ? 'border-amber-500/50 bg-amber-500/5' : 'border-input/60 bg-background/50'}`}
                    />
                    <span className="text-[10px] text-muted-foreground/60 font-tech w-4">mm</span>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed pl-0.5">
                  {hint}
                  {field === 'face' && (
                    <span className="ml-1 text-primary/60">Max: {maxFaceWidth.toFixed(1)}mm</span>
                  )}
                </p>
              </label>
            );
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 tech-glow">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground font-tech">
          The jaw profile cavity and grip features are configured in the next steps. 
          <strong className="block mt-1 text-foreground">These dimensions define the raw stock only.</strong>
        </p>
      </div>
    </div>
  );
}
