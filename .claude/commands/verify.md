---
description: Run the softjaws-verifier subagent on the current working tree
---

Invoke the `softjaws-verifier` subagent to audit the current state of the codebase.

The subagent will:
1. Run `npx tsc --noEmit` and report errors (if any).
2. Grep the diff for the specific anti-patterns documented in the per-directory `CLAUDE.md` files:
   - Whole-store `useSoftJawsStore()` subscriptions without selectors
   - Magic geometry numbers outside `src/features/vise-config/data/presets.ts`
   - `addPart` / `removePart` without paired `geometryCache.set` / `.delete`
   - Inline `new Worker(...)` outside `cad-core`
   - Cross-layer imports (cad-core → cad-ui, cad-ui → src, etc.)
   - Declarative `position` / `rotation` props on a mesh inside `<SelectableTransformControls>`
3. Verify the two invariants from the root `CLAUDE.md`:
   - xOffset coupling — `rightJawCenterX` consumed by all jaw-position consumers
   - Geometry-cache lifecycle — paired set/delete
4. Return a punch list sorted by severity (BLOCKER / CRITICAL / HIGH / NIT) with file:line refs.

Use this command after non-trivial changes — refactors, new features, fixes that touch multiple files. The subagent never modifies code; it only reports.

Brief the agent with: the commit / files changed in this session (run `git status` first if unsure), and any specific invariant the change is most at risk of breaking.
