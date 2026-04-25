/**
 * PropertiesPanel — Right-side properties inspector
 *
 * Reads live data from useSoftJawsStore and renders accordion sections
 * for each domain entity (Parts, Vise, Jaw Blank, Jaw Profile, Grip, Holes).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { PositionControl, RotationControl } from '@rapidtool/cad-ui';
import type { Position3D, Rotation3D } from '@rapidtool/cad-ui';
import { Box, CircleDot, Cog, FileBox, Grip, Settings, Trash2, Wrench } from 'lucide-react';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import type { ProcessedPart } from '@/stores/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground font-tech">{label}</span>
      <span className="text-[10px] text-foreground font-tech">{value}</span>
    </div>
  );
}

const STEP_TO_SECTION: Record<string, string> = {
  'import':         'parts',
  'vise-config':    'vise',
  'jaw-blank':      'jaw-blank',
  'jaw-profile':    'jaw-profile',
  'grip-features':  'grip',
  'mounting-holes': 'holes',
};

function useAccordionSection() {
  const [openSection, setOpenSection] = useState<string>('parts');
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const section = detail?.accordion ?? STEP_TO_SECTION[detail?.step];
      if (section) setOpenSection(section);
    };
    window.addEventListener('workflow-step-changed', handler);
    return () => window.removeEventListener('workflow-step-changed', handler);
  }, []);
  return { openSection, setOpenSection };
}

// ─── Empty State ─────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <Cog className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-xs text-muted-foreground text-center font-tech leading-relaxed">
        Import a model or select an object
        <br />
        in the viewport to see its properties.
      </p>
    </div>
  );
}

// ─── PartItem ───────────────────────────────────────────────────────────────────

function PartItem({
  part,
  isSelected,
  onSelect,
  onRemove,
}: {
  part: ProcessedPart;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const updatePartTransform = useSoftJawsStore((s) => s.updatePartTransform);

  // Mirror store values into local controlled state so PositionControl /
  // RotationControl stay in sync if the store is reset externally.
  const [position, setPosition] = useState<Position3D>(part.transform.position);
  const [rotation, setRotation] = useState<Rotation3D>(part.transform.rotation);

  // Keep local state in sync when the store resets (e.g. full session reset)
  useEffect(() => {
    setPosition(part.transform.position);
    setRotation(part.transform.rotation);
  }, [part.transform]);

  const handlePositionChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => {
      const next = { ...position, [axis]: value };
      setPosition(next);
      updatePartTransform(part.id, { position: next });
    },
    [position, part.id, updatePartTransform],
  );

  const handleRotationChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => {
      const next = { ...rotation, [axis]: value };
      setRotation(next);
      updatePartTransform(part.id, { rotation: next });
    },
    [rotation, part.id, updatePartTransform],
  );

  const handleResetPosition = useCallback(() => {
    const zero = { x: 0, y: 0, z: 0 };
    setPosition(zero);
    updatePartTransform(part.id, { position: zero });
  }, [part.id, updatePartTransform]);

  const handleResetRotation = useCallback(() => {
    const zero = { x: 0, y: 0, z: 0 };
    setRotation(zero);
    updatePartTransform(part.id, { rotation: zero });
  }, [part.id, updatePartTransform]);

  const dx = (part.boundingBox.max[0] - part.boundingBox.min[0]).toFixed(1);
  const dy = (part.boundingBox.max[1] - part.boundingBox.min[1]).toFixed(1);
  const dz = (part.boundingBox.max[2] - part.boundingBox.min[2]).toFixed(1);

  return (
    <div
      className={`rounded-md border transition-colors ${
        isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-border/60'
      }`}
    >
      {/* Header row — two sibling buttons, NOT nested */}
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => onSelect(part.id)}
          className="flex flex-1 items-center gap-2 min-w-0 text-left"
        >
          <FileBox className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{part.name}</p>
            <p className="text-[10px] text-muted-foreground font-tech">
              {part.faceCount.toLocaleString()} tris
            </p>
          </div>
        </button>
        <button
          type="button"
          title="Remove part"
          onClick={() => onRemove(part.id)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 tech-transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {isSelected && (
        <div className="px-2 pb-2 space-y-3 border-t border-border/30">
          <p className="pt-2 text-[10px] text-muted-foreground font-tech">
            {dx} × {dy} × {dz} mm
          </p>
          <PositionControl
            position={position}
            onChange={handlePositionChange}
            onReset={handleResetPosition}
            step={0.1}
            label="Position (mm)"
          />
          <RotationControl
            rotation={rotation}
            onChange={handleRotationChange}
            onReset={handleResetRotation}
            step={1}
            label="Rotation (°)"
          />
        </div>
      )}
    </div>
  );
}

// ─── PropertiesPanel ───────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const {
    parts,
    activePart,
    setActivePart,
    removePart,
    viseConfig,
    jawBlank,
    jawProfile,
    gripFeatures,
    mountingHoles,
  } = useSoftJawsStore();

  const { openSection, setOpenSection } = useAccordionSection();

  if (parts.length === 0) return <EmptyState />;

  return (
    <Accordion
      type="single"
      collapsible
      value={openSection}
      onValueChange={(val) => setOpenSection(val ?? '')}
      className="w-full"
    >
      {/* Parts */}
      <AccordionItem value="parts" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <FileBox className="w-3.5 h-3.5 text-primary" />
            Parts
            <Badge variant="secondary" className="ml-auto font-tech text-[8px] h-4">
              {parts.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-1">
            {parts.map((part) => (
              <PartItem
                key={part.id}
                part={part}
                isSelected={activePart === part.id}
                onSelect={setActivePart}
                onRemove={removePart}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Vise */}
      <AccordionItem value="vise" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Settings className="w-3.5 h-3.5 text-primary" />
            Vise / Chuck
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Type"       value={viseConfig.type} />
            <PropRow label="Jaw Width"  value={`${viseConfig.jawWidth} mm`} />
            <PropRow label="Jaw Height" value={`${viseConfig.jawHeight} mm`} />
            <PropRow label="Stroke"     value={`${viseConfig.jawStroke} mm`} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Jaw Blank */}
      <AccordionItem value="jaw-blank" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Box className="w-3.5 h-3.5 text-primary" />
            Jaw Blank
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Material"  value={jawBlank.material} />
            <PropRow label="Face (Z)"  value={`${jawBlank.face} mm`} />
            <PropRow label="Height (Y)" value={`${jawBlank.height} mm`} />
            <PropRow label="Thickness (X)" value={`${jawBlank.thickness} mm`} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Jaw Profile */}
      <AccordionItem value="jaw-profile" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Wrench className="w-3.5 h-3.5 text-primary" />
            Jaw Profile
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Clearance" value={`${jawProfile.clearance} mm`} />
            <PropRow label="Depth"     value={`${jawProfile.depth} mm`} />
            <PropRow label="Status"    value={jawProfile.generated ? 'Generated' : 'Pending'} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Grip Features */}
      <AccordionItem value="grip" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Grip className="w-3.5 h-3.5 text-primary" />
            Grip Features
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Pattern" value={gripFeatures.pattern} />
            {gripFeatures.pattern !== 'none' && (
              <>
                <PropRow label="Depth"   value={`${gripFeatures.depth} mm`} />
                <PropRow label="Spacing" value={`${gripFeatures.spacing} mm`} />
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Mounting Holes */}
      <AccordionItem value="holes" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <CircleDot className="w-3.5 h-3.5 text-primary" />
            Mounting Holes
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Pattern"   value={mountingHoles.pattern} />
            <PropRow label="Bolt size" value={`M${mountingHoles.boltSize}`} />
            <PropRow label="Count"     value={String(mountingHoles.count)} />
            <PropRow label="Spacing"   value={`${mountingHoles.spacing} mm`} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
