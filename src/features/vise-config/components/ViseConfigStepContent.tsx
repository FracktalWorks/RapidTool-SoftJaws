import { Info } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';

type DimField = 'jawWidth' | 'jawHeight' | 'jawStroke' | 'tSlotWidth' | 'tSlotSpacing';

const FIELD_LABELS: Record<DimField, string> = {
  jawWidth:     'Jaw width',
  jawHeight:    'Jaw height',
  jawStroke:    'Max stroke',
  tSlotWidth:   'T-slot width',
  tSlotSpacing: 'T-slot spacing',
};

const FIELDS: DimField[] = ['jawWidth', 'jawHeight', 'jawStroke', 'tSlotWidth', 'tSlotSpacing'];

export function ViseConfigStepContent() {
  const { viseConfig, updateViseConfig, updateJawBlank } = useSoftJawsStore();

  const handleDimChange = (field: DimField, value: number) => {
    updateViseConfig({ [field]: value });

    // Keep blank Z/Y snapped to the vise face by default; user can still
    // override thickness independently in the next step.
    if (field === 'jawWidth')  updateJawBlank({ face:   value });
    if (field === 'jawHeight') updateJawBlank({ height: value });
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <div>
        <p className="text-xs font-medium">Vise dimensions</p>
        <p className="mt-1 text-[10px] text-muted-foreground font-tech tracking-wide">
          Customize the machine vise your soft jaws will mount to.
          Jaw blank face &amp; height auto-track these values.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
        {FIELDS.map((field) => (
          <label key={field} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{FIELD_LABELS[field]}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0} max={600} step={0.5}
                value={viseConfig[field] ?? ''}
                onChange={(e) => handleDimChange(field, parseFloat(e.target.value) || 0)}
                className="w-20 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-muted-foreground">mm</span>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-[10px] leading-relaxed text-muted-foreground font-tech">
          Vise dimensions are set <span className="font-semibold text-foreground">here only</span>.
          Steps that follow (Jaw Blank, Profile, Holes) configure the soft jaws on top of this vise — they don't change the vise itself.
        </p>
      </div>
    </div>
  );
}
