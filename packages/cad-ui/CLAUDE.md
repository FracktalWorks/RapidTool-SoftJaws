# `packages/cad-ui/` — Generic UI primitives + workflow scaffolding

This package is the **single source of truth for ALL generic, reusable UI** in the RapidTool product family (PCB, Fixture, SoftJaws, future apps).

## Hard rule — what belongs here

A component / hook / store belongs in `cad-ui` if and only if **another RapidTool product would use it unchanged**. The litmus test: would PCB or Fixture import it as-is, without modifying it for their domain?

- **YES** → here.
- **NO** → caller's `src/`.

If you find yourself writing `jawBlank` or `viseConfig` or `softJaws` in a file under `packages/cad-ui/`, **stop**. It belongs in the consumer's `src/`, not here.

## What lives in this package

**UI primitives** (shadcn/Radix-based, in `src/components/ui/`):
- `Button` (CVA variants), `DropdownMenu`, `Accordion`, `Badge`
- `cn()` — Tailwind class merging (`clsx` + `tailwind-merge`)

**Branding**:
- `RapidToolLogo` — Lucide `<Zap>` + `subscript` prop
- `ThemeToggle` — framework-agnostic dropdown; receives `theme` + `setTheme` as props so consumers can wire `next-themes`, MUI theme, etc. without polluting this package

**Layout**:
- `DashboardLayout` + config types — header / toolbar / context panel / properties panel / footer shell
- `useDashboardLayout`

**Sidebar / toolbar primitives**:
- `SidebarIcon`, `SidebarIconGroup`, `SidebarDivider`, `SidebarSection`
- `VerticalToolbar` (default export) + `ToolItem<T>` type

**Panel & viewport**:
- `CollapsiblePanel` (title + defaultExpanded + onToggle)
- `ViewOrientationControls` — dispatches `set-view-orientation` window events
- `ViewCube`

**Transform / selection**:
- `SelectableTransformControls` — wraps Three.js TransformControls with selection lifecycle
- `TransformControlsUI`

**Inputs**:
- `NumberInput`, `PositionControl`, `RotationControl`
- `PartThumbnail`, `StepProgress`, `SkipStep`

**Loading**:
- `LoadingIndicator`, `LoadingOverlay`

**Generic stores** (Zustand):
- `useWorkflowStore` — consumed by every product; the consumer configures step list at startup
- `useSelectionStore` — `select(category, id)` (positional args, not object)
- `useUIStore` — `togglePanel(...)`, `toggleViewportOption(...)`, `toggleDebugOption(...)`
- `useHistoryStore`, `useTransformStore`

## Forbidden imports

| Don't import here | Why |
|---|---|
| `next-themes` or any framework-specific theme adapter | Breaks framework portability. Consumer passes theme values as props. |
| `lucide-react` icons specific to one product (e.g. a jaw icon) | Generic icons only. Product-specific icons belong in the consumer's `src/`. |
| Anything from `@/` or `src/...` of a consuming app | Reverse dependency. Never do this. |
| Direct hex colours in components | Use CSS variables (`bg-background`, `text-foreground`, `border-border`). |

## Required dependencies

```jsonc
{
  "lucide-react":                "^0.468.0",
  "@radix-ui/react-accordion":   "^1.2.3",
  "@radix-ui/react-dropdown-menu": "^2.1.4",
  "@radix-ui/react-slot":        "^1.1.1",
  "class-variance-authority":    "^0.7.1",
  "clsx":                        "^2.x",
  "tailwind-merge":              "^2.x"
}
```

## CSS variable theming

All colours go through HSL CSS variables defined in the consumer app's `index.css`:
```
--background, --foreground, --border, --primary, --muted-foreground, --accent, --card
```

Components use Tailwind tokens that reference these vars (`bg-background`, `text-foreground`, `border-border/50`, etc.). Never hardcode.

## Composition over modification

If a consumer needs a variation of a `cad-ui` component, the consumer wraps it in `src/`. They do **not** edit `cad-ui` to add a domain-specific prop or branch. The package stays generic.

Example: SoftJaws needs a vise-specific `<NumberInput>` with axis colouring. `NumberInput` stays generic; SoftJaws wraps it in `src/components/AxisInput.tsx` adding the colour logic.
