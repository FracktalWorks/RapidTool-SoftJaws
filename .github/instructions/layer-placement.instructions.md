---
description: "MANDATORY — fires on ALL code files. Quick-reference layer placement decision for every new file, function, component, or import. Prevents architecture violations before they happen."
applyTo: "**/*.{ts,tsx}"
---

# Layer Placement — Quick Decision

**Before writing code, determine its layer:**

```
Pure logic, no React?
  ├─ Generic (reusable) → @rapidtool/cad-core
  └─ Domain-specific    → src/features/*/utils/

React component or hook?
  ├─ Generic (no jaw/vise/grip/chuck knowledge) → @rapidtool/cad-ui
  │   Examples: Button, Accordion, NumberInput, ViewCube, cn(), stores
  └─ Domain-specific → src/features/*/components/ or src/hooks/

shadcn/Radix primitive? → ALWAYS @rapidtool/cad-ui/components/ui/
Branding (logo, theme)? → ALWAYS @rapidtool/cad-ui
Zustand store?
  ├─ Generic (selection, workflow, UI) → @rapidtool/cad-ui/stores/
  └─ Domain (parts, jaw config, vise)  → src/stores/
```

**Dependency direction: `src/` → `cad-ui` → `cad-core`. NEVER reverse.**
