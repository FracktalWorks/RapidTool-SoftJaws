import React from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import type { VisePreset } from '../types';

const VISE_PRESETS: VisePreset[] = [
  // Vises
  { type: 'kurt-d60',        label: 'Kurt D60',         manufacturer: 'Kurt',    jawCount: 2, jawWidth: 152.4, jawHeight: 38.1, jawStroke: 152.4 },
  { type: 'kurt-d688',       label: 'Kurt D688',        manufacturer: 'Kurt',    jawCount: 2, jawWidth: 170.0, jawHeight: 44.5, jawStroke: 190.5 },
  { type: 'schunk-ksr-125',  label: 'Schunk KSR 125',   manufacturer: 'Schunk',  jawCount: 2, jawWidth: 125.0, jawHeight: 40.0, jawStroke: 125.0 },
  { type: 'schunk-ksr-160',  label: 'Schunk KSR 160',   manufacturer: 'Schunk',  jawCount: 2, jawWidth: 160.0, jawHeight: 50.0, jawStroke: 160.0 },
  { type: 'glacern-gmc-606', label: 'Glacern GMC-606',  manufacturer: 'Glacern', jawCount: 2, jawWidth: 152.4, jawHeight: 44.5, jawStroke: 152.4 },
  // Chucks
  { type: 'three-jaw-chuck', label: '3-Jaw Chuck',      manufacturer: 'Generic', jawCount: 3, jawWidth: 40.0,  jawHeight: 50.0, jawStroke: 150.0 },
  { type: 'four-jaw-chuck',  label: '4-Jaw Chuck',      manufacturer: 'Generic', jawCount: 4, jawWidth: 40.0,  jawHeight: 50.0, jawStroke: 150.0 },
  { type: 'six-jaw-chuck',   label: '6-Jaw Chuck',      manufacturer: 'Generic', jawCount: 6, jawWidth: 30.0,  jawHeight: 45.0, jawStroke: 150.0 },
  // Custom
  { type: 'custom',          label: 'Custom Variable',  manufacturer: '',        jawCount: 2, jawWidth: 100.0, jawHeight: 38.0, jawStroke: 100.0 },
];

export function ViseConfigStepContent() {
  const { viseConfig, updateViseConfig } = useSoftJawsStore();

  const selectPreset = (preset: VisePreset) => {
    updateViseConfig({
      type: preset.type,
      jawCount: preset.jawCount,
      jawWidth: preset.jawWidth,
      jawHeight: preset.jawHeight,
      jawStroke: preset.jawStroke,
    });
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Select your vise model. Jaw dimensions will auto-populate from the preset.
      </p>

      <div className="grid grid-cols-1 gap-2">
        {VISE_PRESETS.map((preset) => {
          const active = viseConfig.type === preset.type;
          return (
            <button
              key={preset.type}
              onClick={() => selectPreset(preset)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <div>
                <div className="font-medium">{preset.label}</div>
                {preset.manufacturer && (
                  <div className="text-muted-foreground">{preset.manufacturer}</div>
                )}
              </div>
              <div className="text-right text-muted-foreground">
                <div>{preset.jawWidth}×{preset.jawHeight} mm</div>
                <div>Stroke {preset.jawStroke} mm</div>
              </div>
            </button>
          );
        })}
      </div>

      {viseConfig.type === 'custom' && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium">Custom vise dimensions</p>
          {(['jawCount', 'jawWidth', 'jawHeight', 'jawStroke', 'tSlotWidth', 'tSlotSpacing'] as const).map((field) => (
            <label key={field} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">
                {field.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <input
                type="number"
                min={field === 'jawCount' ? 2 : 0}
                max={600}
                step={field === 'jawCount' ? 1 : 0.5}
                value={viseConfig[field] || ''}
                onChange={(e) => updateViseConfig({ [field]: parseFloat(e.target.value) || 0 })}
                className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
