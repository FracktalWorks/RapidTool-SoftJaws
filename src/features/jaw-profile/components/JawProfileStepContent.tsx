import React from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';

export function JawProfileStepContent() {
  const { jawProfile, parts, updateJawProfile } = useSoftJawsStore();

  const canGenerate = parts.length > 0;

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Configure the jaw profile cavity parameters.
      </p>

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
              onChange={(e) => updateJawProfile({ clearance: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs"
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
              onChange={(e) => updateJawProfile({ depth: parseFloat(e.target.value) || 0 })}
              className="w-24 rounded border border-input bg-background px-2 py-1 text-right text-xs"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>
      </div>

      <button
        disabled={!canGenerate}
        onClick={() => updateJawProfile({ generated: true })}
        className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {jawProfile.generated ? 'Regenerate Profile' : 'Generate Profile'}
      </button>

      {!canGenerate && (
        <p className="text-xs text-muted-foreground">Import a part in the previous step first.</p>
      )}
    </div>
  );
}
