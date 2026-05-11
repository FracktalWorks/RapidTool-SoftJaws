# RapidTool-SoftJaws — Repo Knowledge

## Architecture State (as of annealing session)

### Three Layers
- `packages/cad-core/` — Pure logic, no React. CSG, mesh, transforms, STL, export, workers.
- `packages/cad-ui/` — Generic React components + stores. SHOULD own all shadcn primitives and branding.
- `src/` — Soft jaws domain: features, stores, hooks, layout, 3D scene, workflow.

### Known Issues (from architecture audit)
- [ ] shadcn primitives (Button, DropdownMenu, Accordion, Badge) currently in `src/components/ui/` — should be in `packages/cad-ui/src/components/ui/`
- [ ] `cn()` utility duplicated in both layers
- [ ] cad-ui's RapidToolLogo uses old inline SVG ZapIcon — app version uses Lucide Zap (correct)
- [ ] cad-ui's ThemeToggle uses inline SVGs + plain button — app version uses Lucide + shadcn Button + DropdownMenu (correct)
- [ ] cad-ui missing deps: lucide-react, @radix-ui/react-accordion, @radix-ui/react-dropdown-menu, @radix-ui/react-slot, class-variance-authority
- [ ] App-layer ThemeToggle imports `next-themes` directly — should be a thin wrapper over cad-ui's ThemeToggle

### 7-Point Refactoring Plan (approved, not implemented)
1. Add lucide-react, radix packages, CVA to cad-ui deps
2. Move shadcn primitives from `src/components/ui/` to `packages/cad-ui/src/components/ui/`
3. Update cad-ui RapidToolLogo to use Lucide Zap
4. Rewrite cad-ui ThemeToggle as dropdown (props-based, framework-agnostic)
5. Delete `src/components/ThemeToggle.tsx`, create thin wrapper that passes next-themes values
6. Delete `src/components/RapidToolLogo.tsx`, import from cad-ui
7. Update all app-layer imports

### Build Info
- Vite build: ~2436 modules, ~25s
- Zero TypeScript errors (as of last build)
- `vite.config.ts` has `optimizeDeps.include` for radix packages (fixes 504 errors)

### Instruction Files
- `.github/copilot-instructions.md` — Root guidelines, three-layer diagram, pre-implementation checklist
- `.github/instructions/architecture.instructions.md` — Layer violation checks, decision tree, applyTo: "src/**,packages/**"
- `.github/instructions/layer-placement.instructions.md` — Quick decision reference, applyTo: "**/*.{ts,tsx}"
- `.github/instructions/cad-ui-integration.instructions.md` — Component APIs, cad-ui ownership rules
- `.github/instructions/workflow-implementation.instructions.md` — 7 workflow steps guide
- `.github/agents/softjaws-architect.agent.md` — Full architect agent with Step 0 mandatory checklist
    

