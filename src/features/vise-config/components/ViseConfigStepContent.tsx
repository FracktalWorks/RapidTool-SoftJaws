/**
 * ViseConfigStepContent — Vise / chuck selection and dimension configuration.
 *
 * Selecting a preset auto-populates viseConfig AND resets jaw blank defaults
 * so downstream steps (jaw-blank, jaw-profile) always start from sensible values.
 */

import { Info, ChevronDown, AlertTriangle } from 'lucide-react';
import { useViseStore } from '@/stores/viseStore';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import type { ViseType } from '@/stores/types';
import { VISE_PRESETS, PRESET_LIST } from '../data/visePresets';
import { AXIS_TEXT_CLASS, type Axis } from '@/utils/axisColors';
import { useDimensionHoverStore } from '@/stores/dimensionHover';

type DimField = 'jawWidth' | 'jawHeight' | 'jawStroke';

interface FieldSpec {
  label: string;
  axis:  Axis;     // Trinckle convention — drives colour + 3D arrow direction
  trinckleLabel: string;
  hint: string;
  min:   number;
  max:   number;
  step:  number;
}

const FIELD_SPECS: Record<DimField, FieldSpec> = {
  jawStroke: {
    label: 'Max stroke (X)',
    axis: 'x',
    trinckleLabel: 'Maximum clamp opening',
    hint: 'The absolute maximum gap between the vise L-bracket inner faces when fully open.',
    min: 100,
    max: 300,
    step: 10,
  },
  jawWidth: {
    label: 'Vise width (Y)',
    axis: 'y',
    trinckleLabel: 'L-bracket face width',
    hint: 'Width of the vise L-bracket pillar along the contact face. Caps the maximum width of the jaw blank.',
    min: 50,
    max: 200,
    step: 5,
  },
  jawHeight: {
    label: 'Vise height (Z)',
    axis: 'z',
    trinckleLabel: 'Base-to-rail height',
    hint: 'The vertical height of the L-bracket pillar. Soft jaw blanks should be tall enough to clear this height.',
    min: 50,
    max: 200,
    step: 5,
  },
};

// Render order: X → Y → Z (Trinckle / CAD convention).
const FIELDS: DimField[] = ['jawStroke', 'jawWidth', 'jawHeight'];

const CHUCK_TYPES = new Set<ViseType>(['three-jaw-chuck', 'four-jaw-chuck', 'six-jaw-chuck']);

export function ViseConfigStepContent() {
  const { viseConfig, updateViseConfig } = useViseStore();
  const updateMountingHoles = useSoftJawsStore((s) => s.updateMountingHoles);
  const setHovered = useDimensionHoverStore((s) => s.setHovered);
  const clearHover = useDimensionHoverStore((s) => s.clear);

  const currentPreset = VISE_PRESETS[viseConfig.type];
  const isChuck = CHUCK_TYPES.has(viseConfig.type);

  /**
   * Apply a preset — snaps vise dims AND seeds the mounting-hole spacing from
   * the preset's tSlotSpacing so the bolt pattern matches the physical vise.
   * Jaw blank dimensions stay independent (separate stock).
   */
  const handlePresetSelect = (type: ViseType) => {
    const preset = VISE_PRESETS[type];
    updateViseConfig({ type, ...preset.config });
    if (preset.config.tSlotSpacing != null) {
      updateMountingHoles({ spacing: preset.config.tSlotSpacing });
    }
  };

  /** Manual dim tweak — clamps to the field's min/max so the vise stays valid. */
  const handleDimChange = (field: DimField, value: number) => {
    const { min, max } = FIELD_SPECS[field];
    const clamped = Math.max(min, Math.min(max, value));
    updateViseConfig({ [field]: clamped });
  };

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto pb-20">

      {/* Header */}
      <div>
        <p className="text-sm font-semibold text-foreground">Machine Vise Hardware</p>
        <p className="mt-1 text-[11px] text-muted-foreground font-tech tracking-wide leading-relaxed border-l-2 border-primary/40 pl-2">
          <strong>WARNING:</strong> These dimensions define your fixed, physical cast-iron CNC machine bed. 
          They establish the absolute maximum stroke and rail height. 
          <span className="block mt-1 text-primary/80">Do not alter these to resize your soft jaws.</span>
        </p>
      </div>

      {/* Preset Selector */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/50 p-4 shadow-soft tech-glass">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Workholding Type</p>
        <div className="relative">
          <select
            aria-label="Workholding type"
            value={viseConfig.type}
            onChange={(e) => handlePresetSelect(e.target.value as ViseType)}
            className="w-full appearance-none rounded-md border border-input bg-background/80 px-3 py-2 pr-8 text-sm font-tech focus:ring-2 focus:ring-primary/20 outline-none tech-transition hover:bg-background cursor-pointer"
          >
            {PRESET_LIST.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Chuck Warning — 3D model is always a milling vise */}
      {isChuck && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-[11px] font-semibold text-amber-400">3D Preview: Milling Vise Approximation</p>
            <p className="text-[10px] leading-relaxed text-muted-foreground mt-0.5 font-tech">
              Chuck geometry ({currentPreset?.label}) is not yet rendered in 3D.
              The scene shows a 2-jaw milling vise scaled to the chuck dimensions.
            </p>
          </div>
        </div>
      )}

      {/* Dimension Overrides */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 p-4 shadow-soft tech-glass">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Fixed Hardware Dimensions
        </p>
        
        <div className="grid gap-3">
          {FIELDS.map((field) => {
            const { label, axis, trinckleLabel, hint, min, max, step } = FIELD_SPECS[field];
            const handleEnter = () => setHovered({ scope: 'vise', field });
            return (
              <label
                key={field}
                className="flex flex-col gap-1.5 group"
                onMouseEnter={handleEnter}
                onMouseLeave={clearHover}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-xs font-medium ${AXIS_TEXT_CLASS[axis]}`}>{label}</span>
                    <span className="ml-2 text-[9px] text-muted-foreground/60 font-tech">{trinckleLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={viseConfig[field] ?? ''}
                      onChange={(e) => handleDimChange(field, parseFloat(e.target.value) || 0)}
                      onFocus={handleEnter}
                      onBlur={clearHover}
                      className="w-28 rounded border border-input/60 bg-background/50 px-2 py-1 text-right text-xs font-tech outline-none tech-transition hover:bg-background focus:ring-1 focus:ring-primary/40"
                    />
                    <span className="text-[10px] text-muted-foreground/60 font-tech w-4">mm</span>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/50 font-tech leading-relaxed pl-0.5">
                  {hint}
                </p>
              </label>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 tech-glow tech-transition mt-1">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground font-tech">
          These limits establish the absolute bounding volume. 
          <strong className="block mt-1 font-medium text-foreground">You will configure the consumable soft-jaw aluminum blocks independently in the next step.</strong>
        </p>
      </div>
    </div>
  );
}
