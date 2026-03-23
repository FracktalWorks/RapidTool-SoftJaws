# RapidTool-SoftJaws — Project Guidelines

## Overview

RapidTool-SoftJaws is a browser-based 3D CAD application for designing CNC workholding soft jaws. It is part of the RapidTool product family and shares the same core CAD packages (`@rapidtool/cad-core`, `@rapidtool/cad-ui`) with RapidTool-Fixture and future RapidTool applications.

## Architecture — Three-Layer Rule (MANDATORY)

Every piece of code MUST belong to exactly one of these three layers. Never mix concerns across layers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                              │
│                      (softjaws-app / src/)                          │
│  src/features/     — Soft jaw domain modules                       │
│  src/stores/       — App-specific Zustand stores                   │
│  src/hooks/        — App-specific hook wrappers                    │
│  src/workflow/     — Workflow step definitions & orchestration      │
│  src/components/   — 3DScene + app-specific UI                     │
│  src/layout/       — AppShell orchestration                        │
│  src/services/     — API clients                                   │
├─────────────────────────────────────────────────────────────────────┤
│                       UI COMPONENT LAYER                            │
│                      (@rapidtool/cad-ui)  [SHARED PACKAGE]         │
│  DashboardLayout, SidebarIcon, VerticalToolbar, CollapsiblePanel   │
│  ViewCube, ScalableGrid, NavigationHelp, TransformControlsUI       │
│  NumberInput, PositionControl, RotationControl, StepProgress       │
│  Button, DropdownMenu, Accordion, Badge, cn() (shadcn primitives)  │
│  RapidToolLogo, ThemeToggle (branding components)                  │
│  useSelectionStore, useWorkflowStore, useUIStore, useHistoryStore  │
├─────────────────────────────────────────────────────────────────────┤
│                       CORE CAD LOGIC LAYER                          │
│                      (@rapidtool/cad-core) [SHARED PACKAGE]        │
│  TransformController, CSG engine, mesh analysis/simplify/repair    │
│  Offset/cavity generation, snapping, STL parser, export (STL/3MF) │
│  Web workers, coordinate transforms (CAD↔Three.js)                │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Rules

1. **`@rapidtool/cad-core`**: Pure logic. NO React, NO DOM. Only Three.js types as geometry interfaces.
2. **`@rapidtool/cad-ui`**: Generic React components. NO soft-jaw domain knowledge. NO fixture domain knowledge.
3. **`src/` (Application)**: Soft-jaw domain logic. Consumes cad-core and cad-ui. Defines workflow steps, feature modules, and domain-specific stores.

### Dependency Direction

```
src/ ──imports──> @rapidtool/cad-ui ──imports──> @rapidtool/cad-core
src/ ──imports──> @rapidtool/cad-core
```

Never reverse this. cad-core MUST NOT import from cad-ui or src/. cad-ui MUST NOT import from src/.

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18 + TypeScript |
| 3D Rendering | Three.js via React Three Fiber |
| State Management | Zustand + Immer |
| Styling | Tailwind CSS + shadcn/ui |
| CSG Operations | Manifold 3D (WASM) |
| Build Tool | Vite |
| Monorepo | npm workspaces |

## Soft Jaws Workflow Steps

```
Import Part → Vise/Chuck Config → Jaw Blank Setup → Jaw Profile → Grip Features → Mounting Holes → Export
```

## Code Style

- TypeScript strict mode, no `any` unless interfacing with Three.js internals
- Functional React components with hooks only
- Zustand stores with Immer middleware for immutable updates
- Feature modules are self-contained: each has its own types, hooks, components, and utils
- Barrel exports via `index.ts` in every module directory
- Path alias `@/` maps to `src/`
- Path alias `@rapidtool/cad-core` maps to `packages/cad-core/src`
- Path alias `@rapidtool/cad-ui` maps to `packages/cad-ui/src`

## Testing

- Unit tests for cad-core functions (pure logic, easy to test)
- Component tests for feature modules
- Integration tests for workflow step transitions
- Use Vitest as the test runner

## File Naming

- Components: PascalCase (`JawBlankSetup.tsx`)
- Hooks: camelCase with `use` prefix (`useJawProfile.ts`)
- Stores: camelCase with `Store` suffix (`jawStore.ts`)
- Types: camelCase (`types.ts`)
- Utils: camelCase (`jawGeometry.ts`)
- Constants: UPPER_SNAKE_CASE in code, camelCase filename (`constants.ts`)

## Pre-Implementation Checklist (MANDATORY)

Before writing ANY new code, answer these questions:

1. **Layer**: Does this code belong in `cad-core`, `cad-ui`, or `src/`? (See architecture.instructions.md for decision tree)
2. **Reusability**: Would another RapidTool app (Fixture, PCB) need this exact same code? If yes → shared package.
3. **Domain Knowledge**: Does this code reference "jaw", "vise", "grip", "chuck", or any soft-jaw concept? If yes → `src/` only.
4. **Dependencies**: Am I importing React in cad-core? (FORBIDDEN) Am I importing from src/ in cad-ui? (FORBIDDEN)
5. **Duplication**: Does similar code already exist in cad-ui or cad-core? Don't duplicate — import it.