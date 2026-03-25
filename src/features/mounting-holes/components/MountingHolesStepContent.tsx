import React from 'react';
import { useSoftJawsStore } from '@/stores/softJawsStore';

const BOLT_SIZES = [4, 5, 6, 8, 10, 12, 16];

export function MountingHolesStepContent() {
  const { mountingHoles, updateMountingHoles } = useSoftJawsStore();

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Configure the T-slot mounting bolt pattern.
      </p>

      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Bolt size</span>
          <select
            value={mountingHoles.boltSize}
            onChange={(e) => updateMountingHoles({ boltSize: Number(e.target.value) })}
            className="rounded border border-input bg-background px-2 py-1 text-xs"
          >
            {BOLT_SIZES.map((s) => (
              <option key={s} value={s}>M{s}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Spacing</span>
          <div className="flex items-center gap-1">
            <input
              type="number" min={20} max={200} step={5}
              value={mountingHoles.spacing}
              onChange={(e) => updateMountingHoles({ spacing: parseFloat(e.target.value) || 0 })}
              className="w-20 rounded border border-input bg-background px-2 py-1 text-right text-xs"
            />
            <span className="text-muted-foreground">mm</span>
          </div>
        </label>

        <label className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Count</span>
          <input
            type="number" min={1} max={8} step={1}
            value={mountingHoles.count}
            onChange={(e) => updateMountingHoles({ count: parseInt(e.target.value) || 1 })}
            className="w-20 rounded border border-input bg-background px-2 py-1 text-right text-xs"
          />
        </label>

        <div className="flex gap-2">
          {(['standard', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => updateMountingHoles({ pattern: p })}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs capitalize transition-colors ${
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
    </div>
  );
}
