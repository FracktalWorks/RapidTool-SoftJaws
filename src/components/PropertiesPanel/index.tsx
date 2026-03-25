/**
 * PropertiesPanel — Right-side properties inspector
 *
 * Reads live data from useSoftJawsStore and renders accordion sections
 * for each domain entity (Parts, Vise, Jaw Blank, Jaw Profile, Grip, Holes).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { PositionControl, RotationControl } from '@rapidtool/cad-ui';
import type { Position3D, Rotation3D } from '@rapidtool/cad-ui';
import { Cog, Box, Wrench, Grip, CircleDot, Eye, EyeOff, Trash2, FileBox, Settings } from 'lucide-react';
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
  const [position, setPosition] = useState<Position3D>({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState<Rotation3D>({ x: 0, y: 0, z: 0 });

  const handlePositionChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => setPosition((p) => ({ ...p, [axis]: value })),
    []
  );
  const handleRotationChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: number) => setRotation((p) => ({ ...p, [axis]: value })),
    []
  );

  const dx = (part.boundingBox.max[0] - part.boundingBox.min[0]).toFixed(1);
  const dy = (part.boundingBox.max[1] - part.boundingBox.min[1]).toFixed(1);
  const dz = (part.boundingBox.max[2] - part.boundingBox.min[2]).toFixed(1);

  return (
    <div
      className={`rounded-md border transition-colors ${
        isSelected ? 'border-primary/50 bg-primary/5' : 'border-border/30 hover:border-border/60'
      }`}
    >
      <button
        onClick={() => onSelect(part.id)}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        <FileBox className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{part.name}</p>
          <p className="text-[10px] text-muted-foreground font-tech">
            {part.faceCount.toLocaleString()} tris
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(part.id); }}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 tech-transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </button>

      {isSelected && (
        <div className="px-2 pb-2 space-y-3 border-t border-border/30">
          <p className="pt-2 text-[10px] text-muted-foreground font-tech">
            {dx} × {dy} × {dz} mm
          </p>
          <PositionControl
            position={position}
            onChange={handlePositionChange}
            onReset={() => setPosition({ x: 0, y: 0, z: 0 })}
            step={0.1}
            label="Position (mm)"
          />
          <RotationControl
            rotation={rotation}
            onChange={handleRotationChange}
            onReset={() => setRotation({ x: 0, y: 0, z: 0 })}
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
            <PropRow label="Material" value={jawBlank.material} />
            <PropRow label="Width"    value={`${jawBlank.width} mm`} />
            <PropRow label="Height"   value={`${jawBlank.height} mm`} />
            <PropRow label="Depth"    value={`${jawBlank.depth} mm`} />
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
