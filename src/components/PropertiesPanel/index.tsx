/**
 * PropertiesPanel — Right-side properties inspector
 *
 * Matches the PartPropertiesAccordion pattern from RapidTool-Fixture:
 * - Radix-based Accordion (type="single", collapsible) for mutual exclusion
 * - Accordion sections for each domain entity with icon + badge
 * - Transform controls (Position, Rotation) using cad-ui primitives
 * - Part metadata display
 * - Empty state when nothing is selected
 * - Auto-opens section based on workflow step changes
 *
 * Soft Jaws domain sections:
 *   Parts → Vise/Chuck → Jaw Blank → Jaw Profile → Grip Features → Mounting Holes
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  PositionControl,
  RotationControl,
} from '@rapidtool/cad-ui';
import type { Position3D, Rotation3D } from '@rapidtool/cad-ui';
import {
  Cog,
  Box,
  Wrench,
  Grip,
  CircleDot,
  Eye,
  EyeOff,
  Trash2,
  FileBox,
  Settings,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PartInfo {
  id: string;
  name: string;
  triangles: number;
  units: string;
  dimensions: { x: number; y: number; z: number };
  color?: string;
  visible?: boolean;
}

// ─── Empty State ─────────────────────────────────────────────────────────────

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

// ─── Color Swatch (lightweight part thumbnail stand-in) ──────────────────────

function ColorSwatch({ color, size = 32 }: { color: string; size?: number }) {
  return (
    <div
      className="rounded border border-border/50 flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        opacity: 0.8,
      }}
    />
  );
}

// ─── Part Item ───────────────────────────────────────────────────────────────

function PartItem({
  part,
  isSelected,
  onSelect,
}: {
  part: PartInfo;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const [position, setPosition] = useState<Position3D>({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState<Rotation3D>({ x: 0, y: 0, z: 0 });
  const [visible, setVisible] = useState(part.visible !== false);

  const handlePositionChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    setPosition(prev => ({ ...prev, [axis]: value }));
  }, []);

  const handleRotationChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    setRotation(prev => ({ ...prev, [axis]: value }));
  }, []);

  return (
    <div
      className={`rounded-md border transition-colors ${
        isSelected
          ? 'border-primary/50 bg-primary/5'
          : 'border-border/30 hover:border-border/60'
      }`}
    >
      {/* Part header row */}
      <button
        onClick={() => onSelect(part.id)}
        className="w-full flex items-center gap-2 p-2 text-left"
      >
        <ColorSwatch color={part.color || '#4ade80'} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{part.name}</p>
          <p className="text-[10px] text-muted-foreground font-tech">
            {part.triangles.toLocaleString()} tris • {part.units}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setVisible(!visible); }}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent tech-transition"
            title={visible ? 'Hide' : 'Show'}
          >
            {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 tech-transition"
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </button>

      {/* Expanded details */}
      {isSelected && (
        <div className="px-2 pb-2 space-y-3 border-t border-border/30">
          {/* Part dimensions */}
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground font-tech mb-1">
              Size: {part.dimensions.x.toFixed(1)} × {part.dimensions.y.toFixed(1)} × {part.dimensions.z.toFixed(1)} {part.units}
            </p>
          </div>

          {/* Position */}
          <PositionControl
            position={position}
            onChange={handlePositionChange}
            onReset={() => setPosition({ x: 0, y: 0, z: 0 })}
            step={0.1}
            label="Position (mm)"
          />

          {/* Rotation */}
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

// ─── Property Row ────────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground font-tech">{label}</span>
      <span className="text-[10px] text-foreground font-tech">{value}</span>
    </div>
  );
}

// ─── Workflow Step → Accordion Section Mapping ──────────────────────────────

const STEP_TO_SECTION: Record<string, string> = {
  'import': 'parts',
  'vise-config': 'vise',
  'jaw-blank': 'jaw-blank',
  'jaw-profile': 'jaw-profile',
  'grip-features': 'grip',
  'mounting-holes': 'holes',
};

// ─── Section auto-open hook ──────────────────────────────────────────────────

function useAccordionSection() {
  const [openSection, setOpenSection] = useState<string>('parts');

  useEffect(() => {
    const handleStepChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.accordion) {
        setOpenSection(detail.accordion);
      } else if (detail?.step) {
        const section = STEP_TO_SECTION[detail.step];
        if (section) setOpenSection(section);
      }
    };

    window.addEventListener('workflow-step-changed', handleStepChange);
    return () => window.removeEventListener('workflow-step-changed', handleStepChange);
  }, []);

  return { openSection, setOpenSection };
}

// ─── PropertiesPanel ─────────────────────────────────────────────────────────

export function PropertiesPanel() {
  // Prototype state — will be connected to stores
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const { openSection, setOpenSection } = useAccordionSection();
  const hasModel = false; // Will come from store

  // Prototype part list — empty until import works
  const parts: PartInfo[] = [];

  if (!hasModel && parts.length === 0) {
    return <EmptyState />;
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={openSection}
      onValueChange={(val) => setOpenSection(val ?? '')}
      className="w-full"
    >
      {/* Parts Section */}
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
          {parts.length > 0 ? (
            <div className="space-y-1">
              {parts.map((part) => (
                <PartItem
                  key={part.id}
                  part={part}
                  isSelected={selectedPartId === part.id}
                  onSelect={setSelectedPartId}
                />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground font-tech py-2">
              No parts imported yet.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Vise / Chuck Section */}
      <AccordionItem value="vise" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Settings className="w-3.5 h-3.5 text-primary" />
            Vise / Chuck
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Type" value="—" />
            <PropRow label="Jaw Count" value="—" />
            <PropRow label="Jaw Width" value="—" />
            <p className="text-[10px] text-muted-foreground font-tech italic pt-1">
              Configure in the Vise/Chuck workflow step.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Jaw Blank Section */}
      <AccordionItem value="jaw-blank" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Box className="w-3.5 h-3.5 text-primary" />
            Jaw Blank
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Material" value="—" />
            <PropRow label="Width" value="—" />
            <PropRow label="Height" value="—" />
            <PropRow label="Depth" value="—" />
            <p className="text-[10px] text-muted-foreground font-tech italic pt-1">
              Configure in the Jaw Blank workflow step.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Jaw Profile Section */}
      <AccordionItem value="jaw-profile" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Wrench className="w-3.5 h-3.5 text-primary" />
            Jaw Profile
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <div className="space-y-2 py-1">
            <PropRow label="Clearance" value="—" />
            <PropRow label="Profile Depth" value="—" />
            <PropRow label="Status" value="—" />
            <p className="text-[10px] text-muted-foreground font-tech italic pt-1">
              Configure in the Jaw Profile workflow step.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Grip Features Section */}
      <AccordionItem value="grip" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <Grip className="w-3.5 h-3.5 text-primary" />
            Grip Features
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <p className="text-[10px] text-muted-foreground font-tech py-2">
            No grip features added yet.
          </p>
        </AccordionContent>
      </AccordionItem>

      {/* Mounting Holes Section */}
      <AccordionItem value="holes" className="border-border/50">
        <AccordionTrigger className="py-2 px-4 text-xs font-tech hover:no-underline">
          <div className="flex items-center gap-2 flex-1">
            <CircleDot className="w-3.5 h-3.5 text-primary" />
            Mounting Holes
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          <p className="text-[10px] text-muted-foreground font-tech py-2">
            No mounting holes placed yet.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
