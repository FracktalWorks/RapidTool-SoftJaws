import { useSoftJawsStore } from '@/stores/softJawsStore';
import type { GripPattern } from '../types';

const PATTERNS: { value: GripPattern; label: string; description: string }[] = [
  { value: 'none',     label: 'Smooth',   description: 'No grip features' },
  { value: 'serrated', label: 'Serrated', description: 'Linear serrations along grip face' },
  { value: 'diamond',  label: 'Diamond',  description: 'Diamond knurl pattern' },
  { value: 'custom',   label: 'Custom',   description: 'User-defined pattern' },
];

export function GripFeaturesStepContent() {
  const { gripFeatures, updateGripFeatures } = useSoftJawsStore();

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Choose a grip pattern for the jaw contact surface.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {PATTERNS.map(({ value, label, description }) => (
          <button
            key={value}
            onClick={() => updateGripFeatures({ pattern: value })}
            className={`flex flex-col items-start rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              gripFeatures.pattern === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background hover:bg-accent'
            }`}
          >
            <span className="font-medium">{label}</span>
            <span className="text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      {gripFeatures.pattern !== 'none' && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Feature depth</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0.1} max={3} step={0.1}
                value={gripFeatures.depth}
                onChange={(e) => updateGripFeatures({ depth: parseFloat(e.target.value) || 0 })}
                className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          </label>
          <label className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Spacing</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0.5} max={10} step={0.5}
                value={gripFeatures.spacing}
                onChange={(e) => updateGripFeatures({ spacing: parseFloat(e.target.value) || 0 })}
                className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
