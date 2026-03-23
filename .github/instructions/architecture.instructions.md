---
description: "MANDATORY — automatically loaded for ALL file changes in src/ and packages/. Enforces three-layer architecture, dependency direction, and layer-placement decisions for every new file, import, component, hook, store, algorithm, or UI primitive. Use when: new file, new import, new module, layer check, dependency direction, separation of concerns, where to put code, layer placement decision."
applyTo: "src/**,packages/**"
---

# Architecture Enforcement Rules — MANDATORY

## The Layer Placement Decision (ASK THIS FIRST)

Before writing ANY code, answer this question:

> **"Which layer does this belong in?"**

Use this decision tree:

```
Is it a pure algorithm with NO React, NO DOM?
  ├─ YES → Is it generic (usable by Fixture, PCB, etc.)?
  │          ├─ YES → @rapidtool/cad-core
  │          └─ NO  → src/features/<step>/utils/
  └─ NO (it's React/UI) →
       Is it a generic UI component with ZERO domain knowledge?
         ├─ YES → @rapidtool/cad-ui
         │          (DashboardLayout, Button, DropdownMenu, NumberInput,
         │           CollapsiblePanel, ViewCube, stores, etc.)
         └─ NO (it knows about "jaws", "vise", "grip", etc.) →
              src/ (application layer)
              ├─ Workflow step UI → src/features/<step>/components/
              ├─ Domain store     → src/stores/
              ├─ Domain hook      → src/hooks/ or src/features/<step>/hooks/
              ├─ Layout wiring    → src/layout/
              └─ 3D renderers     → src/components/3DScene/renderers/
```

### Quick Classification Examples

| What you're building | Layer | Why |
|----------------------|-------|-----|
| CSG boolean subtraction | cad-core | Pure geometry, no React |
| STL file parser | cad-core | Pure logic, generic |
| Mesh decimation algorithm | cad-core | Pure compute |
| Coordinate transform (CAD↔Three.js) | cad-core | Generic math |
| `<Button variant="outline">` | cad-ui | Generic UI primitive |
| `<DropdownMenu>` | cad-ui | Generic UI primitive |
| `<Accordion>` | cad-ui | Generic UI primitive |
| `<CollapsiblePanel>` | cad-ui | Generic panel, no domain knowledge |
| `<NumberInput axis="x">` | cad-ui | Generic input, no domain knowledge |
| `useWorkflowStore` | cad-ui | Generic state, any workflow |
| `useSelectionStore` | cad-ui | Generic selection, any categories |
| `<RapidToolLogo>` | cad-ui | Brand identity, shared across apps |
| `<ThemeToggle>` | cad-ui | Theme switching, shared across apps |
| `<ViewCube>` | cad-ui | 3D navigation, generic |
| `cn()` utility | cad-ui | Tailwind class merging, generic |
| `<JawProfileStepContent>` | src/features/jaw-profile/ | Domain-specific step UI |
| `useJawBlank()` hook | src/features/jaw-blank/ | Domain-specific logic |
| `softJawsStore` | src/stores/ | App-specific state |
| `<ViseRenderer>` | src/components/3DScene/ | Domain-specific 3D |
| Jaw clearance calculation | src/features/jaw-profile/utils/ | Domain-specific algorithm |

## Layer Violation Checks

Before writing any import statement, verify the dependency direction:

### ALLOWED imports:
- `src/**` → `@rapidtool/cad-ui` (app imports UI components)
- `src/**` → `@rapidtool/cad-core` (app imports CAD logic)
- `@rapidtool/cad-ui` → `@rapidtool/cad-core` (UI imports core logic)
- `src/features/*` → `src/stores/*` (features access stores)
- `src/features/*` → `src/core/*` (features use core utilities)
- `src/hooks/*` → `@rapidtool/cad-ui` stores (hooks wrap generic stores)

### FORBIDDEN imports:
- `@rapidtool/cad-core` → `@rapidtool/cad-ui` (core must not know about UI)
- `@rapidtool/cad-core` → `src/**` (core must not know about app)
- `@rapidtool/cad-ui` → `src/**` (UI must not know about app)
- `src/features/X` → `src/features/Y` (no cross-feature imports)

### RED FLAG — You're Probably in the Wrong Layer If:
- You're adding `import { Zap } from 'lucide-react'` in cad-core → **WRONG** (no React in core)
- You're writing `jawBlank.width` in cad-ui → **WRONG** (domain knowledge in shared UI)
- You're copy-pasting a shadcn component into `src/components/ui/` → **WRONG** (generic primitives go in cad-ui)
- You're creating `<Button>` in `src/` that has no domain logic → **WRONG** (move to cad-ui)
- You're putting a Zustand store for workflow in `src/stores/` → **WRONG** (generic workflows go in cad-ui stores)
- You're importing `next-themes` in cad-ui → **WRONG** (framework-specific, keep in app layer as thin wrapper)

## Feature Module Structure

Every feature module MUST follow this structure:
```
src/features/<name>/
├── components/       # React components for this feature
├── hooks/            # Custom hooks for this feature
├── types/            # TypeScript types and interfaces
├── utils/            # Pure utility functions (optional)
├── data/             # Static data/catalogs (optional)
└── index.ts          # Public API (barrel export)
```

## Store Rules

- One store file = one concern
- All stores use Zustand with Immer middleware
- Store types are defined in `src/stores/types.ts`
- Components access stores through hooks in `src/hooks/`, not directly
- Generic stores (workflow, selection, UI, history, transform) → cad-ui
- Domain stores (parts, jaw config, vise) → src/stores/

## The "Would Another App Need This?" Test

Before putting code in `src/`, ask: **"If I were building RapidTool-PCB or RapidTool-Fixture from scratch, would I need this exact same code?"**

- **YES** → It belongs in `cad-ui` (if React) or `cad-core` (if pure logic)
- **NO** → It belongs in `src/` (application layer)