import React from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { MATERIALS } from '../types';

const DIMS: { field: 'width' | 'height' | 'depth'; label: string }[] = [
  { field: 'width',  label: 'Width (X)' },
  { field: 'height', label: 'Height (Z)' },
  { field: 'depth',  label: 'Depth (Y)' },
];

export function JawBlankStepContent() {
  const { jawBlank, updateJawBlank } = useSoftJawsStore();

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Define raw stock dimensions for the soft jaw blank.
      </p>

      <div className="flex flex-col gap-2">
        {DIMS.map(({ field, label }) => (
          <label key={field} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={5}
                max={500}
                step={0.5}
                value={jawBlank[field]}
                onChange={(e) => updateJawBlank({ [field]: parseFloat(e.target.value) || 0 })}
                className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Material</span>
        <select
          value={jawBlank.material}
          onChange={(e) => updateJawBlank({ material: e.target.value })}
          className="rounded border border-input bg-background px-2 py-1 text-xs"
        >
          {MATERIALS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
