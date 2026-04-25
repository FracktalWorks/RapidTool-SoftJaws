import { useSoftJawsStore } from '@/stores/softJawsStore';
import { MATERIALS } from '../types';

type DimField = 'face' | 'height' | 'thickness';

const DIMS: { field: DimField; label: string; hint: string }[] = [
  { field: 'face',      label: 'Face (Z)',      hint: 'along jaw face'        },
  { field: 'height',    label: 'Height (Y)',    hint: 'vertical'              },
  { field: 'thickness', label: 'Thickness (X)', hint: 'stick-out from carriage' },
];

export function JawBlankStepContent() {
  const { jawBlank, updateJawBlank } = useSoftJawsStore();

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="text-xs text-muted-foreground font-tech tracking-wide">
        Define raw stock dimensions for the soft jaw blank.
      </p>

      <div className="flex flex-col gap-2">
        {DIMS.map(({ field, label, hint }) => (
          <label key={field} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {label}
              <span className="ml-1 text-[10px] opacity-60">{hint}</span>
            </span>
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
