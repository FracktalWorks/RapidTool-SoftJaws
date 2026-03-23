---
description: "Use when working with @rapidtool/cad-ui components — DashboardLayout, sidebar, toolbar, panels, viewport, stores, transform controls, primitives, shadcn components, UI primitives. Use when: layout setup, sidebar configuration, workflow store, selection store, UI store, ViewCube, grid, number input, cad-ui import, Button, DropdownMenu, Accordion, Badge, cn utility, adding generic UI."
applyTo: "src/**,packages/cad-ui/**"
---

# @rapidtool/cad-ui Integration Guide

## What cad-ui OWNS (Canonical Location for Shared UI)

cad-ui is the single source of truth for ALL generic, reusable UI in the RapidTool product family. This includes:

### UI Primitives (shadcn/Radix-based)
These MUST live in `packages/cad-ui/src/components/ui/`:
- `Button` — shadcn Button with CVA variants
- `DropdownMenu` — Radix DropdownMenu wrapper
- `Accordion` — Radix Accordion wrapper
- `Badge` — CVA Badge variants
- `cn()` utility — Tailwind class merging (clsx + tailwind-merge)

**NEVER create shadcn/Radix primitives in `src/components/ui/`.** Import from cad-ui.

### Branding Components
- `RapidToolLogo` — uses Lucide `<Zap>`, accepts `subscript` prop
- `ThemeToggle` — dropdown-based theme switcher, accepts theme/setTheme via props (framework-agnostic)

### Dependencies cad-ui Requires
```json
{
  "lucide-react": "^0.468.0",
  "@radix-ui/react-accordion": "^1.2.3",
  "@radix-ui/react-dropdown-menu": "^2.1.4",
  "@radix-ui/react-slot": "^1.1.1",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```

## Available Components from cad-ui

### Layout
```typescript
import { DashboardLayout, useDashboardLayout } from '@rapidtool/cad-ui';
// Also available: DEFAULT_HEADER_CONFIG, DEFAULT_SIDEBAR_CONFIG, etc.
```
`DashboardLayout` provides a full-page shell. However, the `AppShell.tsx` in this app manually constructs the same layout using div structure (matching the Fixture app pattern) for maximum control.

### Sidebar
```typescript
import { SidebarIcon, SidebarIconGroup, SidebarDivider, SidebarSection } from '@rapidtool/cad-ui';
// SidebarIcon: sizes 'xs' | 'sm' | 'md' | 'lg' | 'xl'
// SidebarIconGroup: direction='vertical'|'horizontal', gap, className
```

### Toolbar
```typescript
import VerticalToolbar from '@rapidtool/cad-ui'; // default export
import type { ToolItem } from '@rapidtool/cad-ui';
// ToolItem<T>: { id: T, icon, label, tooltip?, disabled?, separator? }
```

### Panels
```typescript
import { CollapsiblePanel } from '@rapidtool/cad-ui';
// Props: title, defaultExpanded, onToggle, children, className
```

### Viewport (3D)
```typescript
import { ViewCube } from '@rapidtool/cad-ui';
// Props: onViewChange, size, className
```

### Controls
```typescript
import { TransformControlsUI } from '@rapidtool/cad-ui';
```

### Primitives
```typescript
import { NumberInput, PositionControl, RotationControl, PartThumbnail, StepProgress, SkipStep } from '@rapidtool/cad-ui';
```

### Loading
```typescript
import { LoadingIndicator, LoadingOverlay } from '@rapidtool/cad-ui';
```

### Stores (Zustand)
```typescript
import { useSelectionStore, useWorkflowStore, useUIStore, useHistoryStore, useTransformStore } from '@rapidtool/cad-ui';
```

#### Selection Store API
```typescript
const { selected, multiSelected, transformTarget, isMultiSelectMode } = useSelectionStore(); // state
const { select, addToSelection, removeFromSelection, toggleSelection, clear } = useSelectionStore(); // actions
// select(category: string, id: string | null) — NOT an object argument
```

#### UI Store API
```typescript
const { theme, panels, viewport, debug } = useUIStore(); // state
const { setTheme, togglePanel, setPanel, toggleViewportOption, setViewportOption, toggleDebugOption, reset } = useUIStore(); // actions
// togglePanel('leftSidebar' | 'rightSidebar' | 'bottomPanel')
// toggleViewportOption('showGrid' | 'showAxes' | 'showLabels' | 'showWireframe' | 'showBoundingBoxes')
// toggleDebugOption('showStats' | 'showDebugInfo' | 'logEvents')
```

## Workflow Store Configuration

The workflow store is generic. Configure it with soft-jaw steps at app initialization:

```typescript
import { useWorkflowStore } from '@rapidtool/cad-ui';
import { SOFTJAWS_WORKFLOW_STEPS } from '@/workflow';

// In App.tsx useEffect
useWorkflowStore.getState().configure({
  steps: [...SOFTJAWS_WORKFLOW_STEPS],
  initialStep: 'import'
});
```

## AppShell Layout Pattern (Matching Fixture)

The AppShell manually constructs the layout to match the Fixture app's visual structure:

```
┌─────────────────────────────────────────────────────────────┐
│ Header: h-14, tech-glass, border-b border-border/50        │
│  Left: RapidToolLogo | Separator | Reset | Undo/Redo       │
│  Right: version / view controls / theme toggle              │
├──────┬───────────┬────────────────────────┬─────────────────┤
│ TB   │ Context   │ Main Viewport          │ Properties      │
│ w-14 │ 320/48px  │ flex-1                 │ 280/48px        │
│      │ tech-glass│ (Scene3D + ViewCube)   │ tech-glass      │
├──────┴───────────┴────────────────────────┴─────────────────┤
│ Footer: h-10, tech-glass, border-t border-border/50        │
└─────────────────────────────────────────────────────────────┘
```

- Toolbar: `SidebarIcon` + `SidebarIconGroup` from cad-ui with Lucide icons
- Panel collapse: managed with `useState` + chevron buttons inside panel headers
- All styling: CSS variables (`var(--border)`, `var(--background)`, etc.) + Tailwind classes
- Glass effect: `tech-glass` class (backdrop-blur 12px)
- Transitions: `tech-transition` class (all 0.15s ease)

## CSS Variable Theming

All components use HSL CSS variables defined in `src/index.css`:
```css
--background, --foreground, --border, --primary, --muted-foreground, --accent, --card
```

**NEVER use hardcoded hex colors** in components. Always use:
- `text-foreground`, `text-muted-foreground`, `text-primary`
- `bg-background`, `bg-accent`, `bg-primary`
- `border-border`, `border-border/50`

## Key Rules

1. **NEVER modify cad-ui components for soft-jaw-specific behavior.** Instead:
   - Pass props to configure behavior
   - Wrap generic components with app-specific wrappers in `src/`
   - Use composition over modification

2. **NEVER create generic UI primitives in `src/`.** If it's a Button, Accordion, DropdownMenu, Badge, or any shadcn component — it goes in cad-ui.

3. **NEVER import framework-specific libraries (next-themes, remix, etc.) into cad-ui.** Keep cad-ui framework-agnostic. App-layer provides framework-specific values via props.

4. **When adding a new generic component**, check if it exists in cad-ui first. If not, add it to cad-ui (not src/).

5. **The "Would Fixture Need This?" Test**: If you're building a UI component and the answer is "yes, Fixture would also use this" — it belongs in cad-ui, not src/.