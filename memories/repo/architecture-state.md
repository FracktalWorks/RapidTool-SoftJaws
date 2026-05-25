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
- `CLAUDE.md` (root) — Invariants, axis convention, commands, stale-doc warnings. Auto-loaded every session.
- `src/CLAUDE.md` — Layer decision, dependency direction, feature shape, hot path, perf rules.
- `src/features/CLAUDE.md` — Workflow-step shape, step-content + CSG-hook patterns, registration.
- `packages/cad-ui/CLAUDE.md` — cad-ui ownership rules, generic-store API, forbidden imports.
- `packages/cad-core/CLAUDE.md` — Pure-algorithm rules, worker pattern, result contract.
- `.github/copilot-instructions.md` — GitHub Copilot equivalent; legacy. Defer to the matching `CLAUDE.md` when they disagree.
- `.github/instructions/*.instructions.md` — Copilot frontmatter format; same intent as the per-directory `CLAUDE.md` files.
- `.claude/agents/softjaws-{architect,coder,verifier}.md` — Subagent definitions.
    
