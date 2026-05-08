/**
 * ViseConfigStepContent — Vise / chuck selection and dimension configuration.
 *
 * Selecting a preset auto-populates viseConfig AND resets jaw blank defaults
 * so downstream steps (jaw-blank, jaw-profile) always start from sensible values.
 */

import { Info, ChevronDown, AlertTriangle } from 'lucide-react';
import { useViseStore } from '@/stores/viseStore';
import type { ViseType } from '@/stores/types';
import { VISE_PRESETS, PRESET_LIST } from '../data/visePresets';

type DimField = 'jawWidth' | 'jawHeight' | 'jawStroke';

const FIELD_LABELS: Record<DimField, string> = {
  jawWidth: 'Jaw width',
  jawHeight: 'Jaw height',
  jawStroke: 'Max stroke',
};

const FIELDS: DimField[] = ['jawWidth', 'jawHeight', 'jawStroke'];

const CHUCK_TYPES = new Set<ViseType>(['three-jaw-chuck', 'four-jaw-chuck', 'six-jaw-chuck']);

export function ViseConfigStepContent() {
  const { viseConfig, updateViseConfig } = useViseStore();

  const currentPreset = VISE_PRESETS[viseConfig.type];
  const isChuck = CHUCK_TYPES.has(viseConfig.type);

  /** Apply a preset — snaps all vise dims only. Jaw blank is independent. */
  const handlePresetSelect = (type: ViseType) => {
    const preset = VISE_PRESETS[type];
    updateViseConfig({ type, ...preset.config });
  };

  /** Manual dim tweak — vise config only, jaw blank is independent. */
  const handleDimChange = (field: DimField, value: number) => {
    updateViseConfig({ [field]: value });
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
        
        {/* Helper Explanations Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-border/40">
           <div className="text-[9px] text-muted-foreground/80 font-tech leading-relaxed">
             <span className="text-primary/70 font-semibold block mb-0.5">Width / Stroke:</span>
             L-bracket width and max opening capacity of the cast-iron bed.
           </div>
           <div className="text-[9px] text-muted-foreground/80 font-tech leading-relaxed">
             <span className="text-primary/70 font-semibold block mb-0.5">Height:</span>
             Base-to-rail height. Dictates where the workpiece bed sits relative to the table.
           </div>
        </div>

        <div className="grid gap-2.5">
          {FIELDS.map((field) => {
            const label = FIELD_LABELS[field];
            return (
              <label key={field} className="flex items-center justify-between group">
                <span className="text-xs text-muted-foreground group-hover:text-foreground tech-transition">{label}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={viseConfig[field] ?? ''}
                    onChange={(e) => handleDimChange(field, parseFloat(e.target.value) || 0)}
                    className="w-20 rounded border border-input/60 bg-background/50 px-2 py-1 text-right text-xs font-tech focus:ring-1 focus:ring-primary/40 outline-none tech-transition hover:bg-background"
                  />
                  <span className="text-[10px] text-muted-foreground/60 font-tech w-4">
                    mm
                  </span>
                </div>
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
