# RapidTool-SoftJaws

> Browser-based 3D CAD application for designing CNC workholding soft jaws.  
> Part of the **RapidTool** product family — shares `@rapidtool/cad-core` and `@rapidtool/cad-ui` with RapidTool-Fixture.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Workflow](#workflow)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Shared Packages](#shared-packages)
- [Getting Started](#getting-started)
- [Development Plan](#development-plan)

---

## Overview

RapidTool-SoftJaws enables engineers and machinists to design custom CNC workholding soft jaws directly in the browser. Users import a 3D model of their workpiece, configure a vise or chuck, and the application generates custom jaw geometry — complete with cavity profiles, grip features, and mounting holes — ready to export for CNC machining.

### Key Differentiators

- **Browser-based**: No installation, runs in any modern browser
- **Step-by-step workflow**: Guided process from part import to jaw export
- **Shared CAD engine**: Uses the same proven `@rapidtool/cad-core` as RapidTool-Fixture
- **Shared UI library**: Consistent look and feel across all RapidTool applications via `@rapidtool/cad-ui`
- **Real-time 3D preview**: Immediate visual feedback using Three.js via React Three Fiber
- **Background processing**: Heavy CSG and mesh operations run in web workers

---

## Architecture

### Three-Layer Rule

Every piece of code belongs to exactly one of three layers. Dependencies flow **downward only**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                              │
│                      (softjaws-app / src/)                          │
│                                                                     │
│  src/features/     — Soft jaw domain modules (7 workflow steps)    │
│  src/stores/       — App-specific Zustand stores                   │
│  src/hooks/        — App-specific hook wrappers                    │
│  src/workflow/     — Workflow step definitions & orchestration      │
│  src/components/   — 3DScene + app-specific UI                     │
│  src/layout/       — AppShell orchestration                        │
│  src/services/     — API clients                                   │
│  src/core/         — App-specific transform presets, events        │
│  src/utils/        — Logging, performance, memory monitoring       │
├─────────────────────────────────────────────────────────────────────┤
│                       UI COMPONENT LAYER                            │
│                      (@rapidtool/cad-ui)  [SHARED PACKAGE]         │
│                                                                     │
│  Layout:     DashboardLayout, useDashboardLayout                   │
│  Sidebar:    SidebarIcon, SidebarIconGroup, SidebarDivider         │
│  Toolbar:    VerticalToolbar                                       │
│  Panels:     CollapsiblePanel                                      │
│  Viewport:   ViewCube, ScalableGrid, NavigationHelp, SnapIndicator │
│  Controls:   TransformControlsUI                                   │
│  Primitives: NumberInput, PositionControl, RotationControl,        │
│              PartThumbnail, StepProgress, SkipStep                 │
│  Loading:    LoadingIndicator, LoadingOverlay                      │
│  Stores:     useSelectionStore, useWorkflowStore, useUIStore,      │
│              useHistoryStore, useTransformStore                     │
├─────────────────────────────────────────────────────────────────────┤
│                       CORE CAD LOGIC LAYER                          │
│                      (@rapidtool/cad-core) [SHARED PACKAGE]        │
│                                                                     │
│  Transform:  TransformController, presets, constraints             │
│  CSG:        Boolean operations (Manifold 3D / WASM)               │
│  Mesh:       Analysis, simplify, decimate, repair, smooth          │
│  Offset:     Heightmap-based cavity/pocket generation              │
│  Snapping:   Grid, vertex, edge, face snapping                     │
│  Parsers:    STL parser with validation                            │
│  Export:     STL, 3MF with configurable quality                    │
│  Workers:    Background CSG and mesh processing                    │
│  Utils:      Coordinate transforms (CAD Z-up ↔ Three.js Y-up)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dependency Direction

```
src/ ──imports──▶ @rapidtool/cad-ui ──imports──▶ @rapidtool/cad-core
src/ ──imports──▶ @rapidtool/cad-core  (direct access to CAD logic)
```

**Never reverse this.** `cad-core` must not import from `cad-ui` or `src/`. `cad-ui` must not import from `src/`.

### Layer Rules

| Layer | Can Import | Cannot Import | Contains |
|-------|-----------|---------------|----------|
| `@rapidtool/cad-core` | Three.js (types only) | React, cad-ui, src/ | Pure algorithms, geometry, workers |
| `@rapidtool/cad-ui` | cad-core, React | src/, domain types | Generic React components, Zustand stores |
| `src/` (App) | cad-core, cad-ui, React | — | Soft jaw domain logic, workflow, UI |

---

## Workflow

The soft jaw design process follows a sequential, step-by-step workflow:

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. Import   │────▶│  2. Vise/Chuck │────▶│  3. Jaw      │────▶│  4. Jaw     │
│     Part     │     │     Config     │     │     Blank    │     │     Profile  │
└──────────────┘     └────────────────┘     └──────────────┘     └─────────────┘
                                                                        │
┌──────────────┐     ┌────────────────┐     ┌──────────────┐           │
│  7. Export   │◀────│  6. Mounting   │◀────│  5. Grip     │◀──────────┘
│              │     │     Holes      │     │     Features │
└──────────────┘     └────────────────┘     └──────────────┘
```

| Step | ID | Feature Module | Description |
|------|----|---------------|-------------|
| 1 | `import` | `features/import/` | Load and validate 3D workpiece model (STL/OBJ/GLTF) |
| 2 | `vise-config` | `features/vise-config/` | Select vise/chuck type, jaw count, dimensions |
| 3 | `jaw-blank` | `features/jaw-blank/` | Configure jaw blank dimensions and material |
| 4 | `jaw-profile` | `features/jaw-profile/` | Generate cavity profile via CSG subtraction |
| 5 | `grip-features` | `features/grip-features/` | Add serrations, knurling, or custom grip patterns |
| 6 | `mounting-holes` | `features/mounting-holes/` | Configure bolt holes for vise/chuck mounting |
| 7 | `export` | `features/export/` | Export jaw geometry for CNC machining |

### Comparison with RapidTool-Fixture

| Fixture Workflow | Soft Jaws Workflow | Shared Code |
|-----------------|-------------------|-------------|
| Import Part | Import Part | STL parser, mesh analysis (cad-core) |
| Configure Baseplate | Configure Vise/Chuck | DashboardLayout, NumberInput (cad-ui) |
| Add Supports | Jaw Blank Setup | Transform controls (cad-ui) |
| Place Clamps | Jaw Profile (CSG cavity) | CSG engine, offset generation (cad-core) |
| Add Labels | Grip Features | — |
| Drill Holes | Mounting Holes | Hole CSG (cad-core), NumberInput (cad-ui) |
| Create Cavity | — (integrated in jaw profile) | Cavity generation (cad-core) |
| Export | Export | STL/3MF export (cad-core) |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| UI Framework | React 18 + TypeScript | Component architecture |
| 3D Rendering | Three.js + React Three Fiber | Real-time 3D visualization |
| State Management | Zustand + Immer | Immutable state updates |
| Styling | Tailwind CSS + shadcn/ui | Consistent design system |
| CSG Operations | Manifold 3D (WASM) | Boolean geometry operations |
| Build Tool | Vite | Fast dev server + production builds |
| Monorepo | npm workspaces | Package management |
| Testing | Vitest | Unit + integration tests |

---

## Project Structure

```
RapidTool-SoftJaws/
├── packages/                     # Shared packages (git submodule or npm workspace)
│   ├── cad-core/                 # @rapidtool/cad-core — Pure CAD logic
│   │   └── src/
│   │       ├── transform/        # TransformController, presets, constraints
│   │       ├── csg/              # CSG engine (Manifold 3D wrapper)
│   │       ├── mesh/             # Mesh analysis, simplify, repair
│   │       ├── offset/           # Cavity/heightmap generation
│   │       ├── snapping/         # Grid, vertex, edge, face snapping
│   │       ├── parsers/          # STL parser
│   │       ├── export/           # STL, 3MF export
│   │       ├── workers/          # Web worker management
│   │       ├── cad/              # CAD operations
│   │       ├── utils/            # Transform utilities, coordinate conversion
│   │       └── index.ts
│   └── cad-ui/                   # @rapidtool/cad-ui — Reusable React components
│       └── src/
│           ├── layout/           # DashboardLayout
│           ├── sidebar/          # SidebarIcon, SidebarIconGroup
│           ├── toolbar/          # VerticalToolbar
│           ├── panels/           # CollapsiblePanel
│           ├── viewport/         # ViewCube, ScalableGrid, NavigationHelp
│           ├── controls/         # TransformControlsUI
│           ├── primitives/       # NumberInput, PositionControl, StepProgress
│           ├── loading/          # LoadingIndicator, LoadingOverlay
│           ├── transform/        # SelectableTransformControls
│           ├── stores/           # Generic Zustand stores
│           └── index.ts
│
├── src/                          # Application code (soft jaws domain)
│   ├── features/                 # Feature modules (one per workflow step)
│   │   ├── import/               # Step 1: Part import
│   │   ├── vise-config/          # Step 2: Vise/chuck configuration
│   │   ├── jaw-blank/            # Step 3: Jaw blank setup
│   │   ├── jaw-profile/          # Step 4: Jaw profile/cavity generation
│   │   ├── grip-features/        # Step 5: Grip patterns
│   │   ├── mounting-holes/       # Step 6: Mounting holes
│   │   └── export/               # Step 7: Export
│   ├── stores/                   # App-specific Zustand stores
│   ├── hooks/                    # App-level hooks
│   ├── workflow/                 # Workflow step definitions
│   ├── components/               # App-specific components
│   │   ├── 3DScene/              # Main 3D scene
│   │   └── ContextOptionsPanel/  # Workflow panel
│   ├── layout/                   # AppShell orchestration
│   ├── core/                     # Events, transform presets
│   ├── services/                 # API clients
│   ├── utils/                    # Logging, performance
│   ├── App.tsx
│   └── main.tsx
│
├── public/                       # Static assets
│   ├── vises/                    # Vise/chuck 3D models
│   └── textures/                 # Grip pattern textures
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # Detailed architecture guide
│   ├── WORKFLOW.md               # Workflow step details
│   └── COORDINATE_SYSTEM.md     # Coordinate system reference
│
├── .github/
│   ├── copilot-instructions.md   # Project-wide AI instructions
│   ├── agents/
│   │   └── softjaws-architect.agent.md  # Architect agent
│   └── instructions/
│       ├── architecture.instructions.md
│       ├── cad-ui-integration.instructions.md
│       └── workflow-implementation.instructions.md
│
├── package.json                  # Root package with workspaces
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── README.md                     # This file
```

---

## Shared Packages

### @rapidtool/cad-core

Pure CAD logic — no React, no DOM. Only Three.js types as geometry interfaces.

| Module | Key Exports |
|--------|------------|
| Transform | `TransformController`, `PART_TRANSFORM_CONFIG` |
| CSG | `performCSGSubtractionInWorker`, `performBatchCSGUnionInWorker`, `performHoleCSGInWorker` |
| Mesh | `analyzeMesh`, `simplifyGeometry`, `decimateMesh`, `repairMesh` |
| Offset | `processOffsetMesh`, `CavitySettings`, `DEFAULT_CAVITY_SETTINGS` |
| Snapping | `SnappingSystem` |
| Parsers | `parseSTL`, `validateSTLBuffer` |
| Export | `exportSTL`, `export3MF`, `mergeMeshesForExport` |
| Utils | `toCadPosition`, `toThreePosition`, `cadToThreeAxis` |

### @rapidtool/cad-ui

Reusable React components — no domain knowledge.

| Module | Key Exports |
|--------|------------|
| Layout | `DashboardLayout`, `useDashboardLayout` |
| Sidebar | `SidebarIcon`, `SidebarIconGroup`, `SidebarDivider` |
| Toolbar | `VerticalToolbar` |
| Panels | `CollapsiblePanel` |
| Viewport | `ViewCube`, `ScalableGrid`, `NavigationHelp` |
| Controls | `TransformControlsUI` |
| Primitives | `NumberInput`, `PositionControl`, `RotationControl`, `StepProgress`, `SkipStep` |
| Stores | `useSelectionStore`, `useWorkflowStore`, `useUIStore`, `useHistoryStore` |

---

## Getting Started

```bash
# Clone
git clone <repo-url>
cd RapidTool-SoftJaws

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Development Plan

### Phase 1: Foundation
- [ ] Initialize npm workspace with cad-core and cad-ui packages
- [ ] Set up Vite, TypeScript, Tailwind, React Three Fiber
- [ ] Implement AppShell using DashboardLayout from cad-ui
- [ ] Set up workflow store with soft jaws steps
- [ ] Create basic 3D scene with grid, view cube, navigation

### Phase 2: Import & Configuration
- [ ] Implement Part Import step (reuse patterns from Fixture's FileImport)
- [ ] Implement Vise/Chuck Configuration step
- [ ] Implement Jaw Blank Setup step

### Phase 3: Core Jaw Design
- [ ] Implement Jaw Profile Generation (CSG cavity from part shape)
- [ ] Implement Grip Features (serrations, knurl patterns)
- [ ] Implement Mounting Holes (auto-placement from vise config)

### Phase 4: Export & Polish
- [ ] Implement Export step (STL, 3MF)
- [ ] Add undo/redo via useHistoryStore
- [ ] Polish UI, add help text, keyboard shortcuts
- [ ] Testing: unit tests for jaw geometry, integration tests for workflow

---

## License

Proprietary — Internal use only.