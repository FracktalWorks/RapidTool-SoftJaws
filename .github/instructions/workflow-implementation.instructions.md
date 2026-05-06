---
description: "Use when implementing or modifying workflow steps, adding new steps, wiring up ContextOptionsPanel, configuring step navigation, or working with the soft jaws design process. Use when: workflow step, step content, import, vise config, jaw blank, jaw profile, grip features, mounting holes, export, step navigation, soft jaw design process."
---

# Soft Jaws Workflow Implementation Guide

## Workflow Steps Overview

```
Import Part → Vise/Chuck Config → Jaw Blank Setup → Jaw Profile → Grip Features → Mounting Holes → Export
```

### Step 1: Import Part (`import`)
- **Purpose**: Load the 3D workpiece (the part to be held)
- **Key Functions**: STL/OBJ/GLTF file parsing, unit conversion, mesh analysis
- **UI**: File drop zone, unit selector, part preview
- **cad-core usage**: `parseSTL`, `validateSTLBuffer`, `analyzeMesh`
- **Output**: `ProcessedFile` stored in `softJawsStore.parts`

### Step 2: Vise/Chuck Configuration (`vise-config`)
- **Purpose**: Select the workholding device type and configuration
- **Options**: 2-jaw vise, 3-jaw chuck, 4-jaw chuck, 6-jaw chuck, custom
- **Key Data**: Jaw count, chuck/vise dimensions, jaw stroke, T-slot specs
- **UI**: Vise/chuck type selector, dimension inputs, preview rendering
- **Output**: `ViseConfig` stored in `viseStore`

### Step 3: Jaw Blank Setup (`jaw-blank`)
- **Purpose**: Define the raw jaw blank dimensions and material
- **Key Data**: Width, height, depth, material type, stock allowance
- **UI**: Dimension inputs, material selector, 3D preview of blank on vise/chuck
- **Output**: `JawBlankConfig` stored in `softJawsStore.jawBlank`

### Step 4: Jaw Profile Generation (`jaw-profile`)
- **Purpose**: Generate the cavity/profile in the jaw that conforms to the workpiece shape
- **Key Functions**: CSG subtraction of part shape from jaw blank, clearance offset
- **Parameters**: Clearance offset, depth of grip, profile resolution
- **cad-core usage**: `performCSGSubtractionInWorker`, offset mesh processing, cavity generation
- **UI**: Clearance controls, depth slider, profile preview, processing indicator
- **Output**: Modified jaw geometry in `softJawsStore.jawProfile`

### Step 5: Grip Features (`grip-features`)
- **Purpose**: Add grip-enhancing features to jaw contact surfaces
- **Options**: Serrations, diamond knurl, smooth, stepped grip, V-groove (for round parts)
- **UI**: Grip pattern selector, depth/spacing controls, preview
- **Output**: `GripFeatureConfig` stored in `softJawsStore.gripFeatures`

### Step 6: Mounting Holes (`mounting-holes`)
- **Purpose**: Add bolt holes for mounting jaws to the vise/chuck
- **Key Data**: Hole positions (auto-detected from vise/chuck), hole diameter, counterbore specs
- **cad-core usage**: `performHoleCSGInWorker` for boolean subtraction
- **UI**: Hole pattern editor, diameter inputs, auto-placement from vise config
- **Output**: `MountingHoleConfig[]` stored in `softJawsStore.mountingHoles`

### Step 7: Export (`export`)
- **Purpose**: Export finished jaw geometry for CNC machining
- **Formats**: STL, 3MF
- **cad-core usage**: `exportSTL`, `export3MF`, `mergeMeshesForExport`
- **UI**: Format selector, quality settings, filename, download button
- **Special**: Multi-jaw export (export all jaws as separate files or combined)

## Step Content Component Pattern

Each step has a content component in `src/features/<step>/components/`:

```tsx
// src/features/jaw-blank/components/JawBlankStepContent.tsx
import { NumberInput, StepProgress } from '@rapidtool/cad-ui';
import { useJawBlank } from '../hooks/useJawBlank';

export function JawBlankStepContent() {
  const { config, updateConfig, isValid } = useJawBlank();
  
  return (
    <div className="space-y-4">
      <StepProgress current={3} total={7} label="Jaw Blank Setup" />
      {/* Step-specific UI */}
    </div>
  );
}
```

## ContextOptionsPanel Wiring

```tsx
// src/components/ContextOptionsPanel/index.tsx
const STEP_COMPONENTS: Record<SoftJawsWorkflowStep, React.ComponentType> = {
  'import': ImportStepContent,
  'vise-config': ViseConfigStepContent,
  'jaw-blank': JawBlankStepContent,
  'jaw-profile': JawProfileStepContent,
  'grip-features': GripFeaturesStepContent,
  'mounting-holes': MountingHolesStepContent,
  'export': ExportStepContent,
};
```

## Vise/Chuck Types Reference

```typescript
type ViseType = 
  | 'two-jaw-vise'      // Standard milling vise (2 jaws)
  | 'three-jaw-chuck'   // 3-jaw self-centering chuck
  | 'four-jaw-chuck'    // 4-jaw independent chuck
  | 'six-jaw-chuck'     // 6-jaw chuck
  | 'custom';           // Custom configuration

interface ViseConfig {
  type: ViseType;
  jawCount: number;
  jawWidth: number;        // mm
  jawHeight: number;       // mm
  jawDepth: number;        // mm
  maxStroke: number;       // mm - max jaw opening
  tSlotWidth?: number;     // mm - for mounting
  tSlotSpacing?: number;   // mm
  boltPattern?: BoltPattern;
}
```

