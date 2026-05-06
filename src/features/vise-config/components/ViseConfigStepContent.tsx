import { Info } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import type { ViseType } from '@/stores/types';

type DimField = 'jawCount' | 'jawWidth' | 'jawHeight' | 'jawStroke' | 'tSlotWidth' | 'tSlotSpacing';

const FIELD_LABELS: Record<DimField, string> = {
  jawCount:     'Jaw count',
  jawWidth:     'Jaw width',
  jawHeight:    'Jaw height',
  jawStroke:    'Max stroke',
  tSlotWidth:   'T-slot width',
  tSlotSpacing: 'T-slot spacing',
};

const FIELDS: DimField[] = ['jawCount', 'jawWidth', 'jawHeight', 'jawStroke', 'tSlotWidth', 'tSlotSpacing'];

const VISE_TYPES: { value: ViseType; label: string }[] = [
  { value: 'custom', label: 'Custom Machine Vise' },
  { value: 'kurt-d688', label: 'Kurt D688' },
  { value: 'schunk-ksr', label: 'Schunk KSR 160' },
  { value: 'three-jaw-chuck', label: '3-Jaw Chuck' },
  { value: 'four-jaw-chuck', label: '4-Jaw Chuck' },
  { value: 'six-jaw-chuck', label: '6-Jaw Chuck' },
];

export function ViseConfigStepContent() {
  const { updateJawBlank } = useSoftJawsStore();
  const { viseConfig, updateViseConfig } = useViseStore();

  const handleDimChange = (field: DimField, value: number) => {
    updateViseConfig({ [field]: value });

    // Keep blank Z/Y snapped to the vise face by default; user can still
    // override thickness independently in the next step.
    if (field === 'jawWidth')  updateJawBlank({ face:   value });
    if (field === 'jawHeight') updateJawBlank({ height: value });
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Configuration Header */}
      <div>
        <p className="text-sm font-semibold text-foreground">Machine Vise / Chuck</p>
        <p className="mt-1 text-[11px] text-muted-foreground font-tech tracking-wide leading-relaxed">
          Select standard workholding or customize dimensions. Soft jaw blanks automatically conform to these bases.
        </p>
      </div>

      {/* Preset Selection (Tech Glass) */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 tech-glass p-4 shadow-soft">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Workholding Type</span>
          <select
            value={viseConfig.type}
            onChange={(e) => updateViseConfig({ type: e.target.value as ViseType })}
            className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm font-tech focus:ring-2 focus:ring-primary/20 outline-none tech-transition hover:bg-background"
          >
            {VISE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Custom Dimensions (Tech Glass) */}
      {viseConfig.type === 'custom' && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/50 tech-glass p-4 shadow-soft">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Custom Dimensions</p>
          <div className="grid gap-2">
            {FIELDS.map((field) => (
              <label key={field} className="flex items-center justify-between group">
                <span className="text-xs text-muted-foreground group-hover:text-foreground tech-transition">{FIELD_LABELS[field]}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={field === 'jawCount' ? 2 : 0} 
                    max={600} 
                    step={field === 'jawCount' ? 1 : 0.5}
                    value={viseConfig[field] || ''}
                    onChange={(e) => handleDimChange(field, parseFloat(e.target.value) || 0)}
                    className="w-20 rounded border border-input/60 bg-background/50 px-2 py-1 text-right text-xs font-tech focus:ring-1 focus:ring-primary/40 outline-none tech-transition hover:bg-background"
                  />
                  <span className="text-[10px] text-muted-foreground/60 font-tech w-4">{field === 'jawCount' ? '' : 'mm'}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 tech-glow tech-transition mt-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground font-tech">
          Vise and chuck parameters dictate the bounding limits.
          <strong className="block mt-1 font-medium text-foreground">Soft jaws are generated automatically based on these values.</strong>
        </p>
      </div>
    </div>
  );
}
