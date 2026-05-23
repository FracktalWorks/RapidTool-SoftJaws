# RapidTool-SoftJaws — Claude Project Brief

Browser-based CAD app for designing CNC soft-jaw inserts. Imports an STL workpiece → generates two soft jaws with cavities matching the part → exports as STL for machining.

Three-layer monorepo:

```
src/                      ← soft-jaw domain (jaws, vise, parts, workflow)
packages/cad-ui/          ← generic React UI (layout, primitives, branding)
packages/cad-core/        ← pure algorithms (CSG, STL, geometry math)
```

This file is loaded into **every** session, including subagents. Keep it lean — directory-specific rules live in the per-folder `CLAUDE.md` files below, which Claude additively loads when you work inside them.

---

## Where to find what

| File | When it loads | What it covers |
|---|---|---|
| `CLAUDE.md` (this file) | Every session | Axis convention, the two invariants, commands, house style, stale-doc warnings |
| `src/CLAUDE.md` | Working anywhere in `src/` | Layer-placement decision, dependency direction, feature shape, hot path, perf rules, store rules |
| `src/features/CLAUDE.md` | Working in a workflow step | The seven steps, mandatory feature shape, step-content + CSG-hook patterns, registration |
| `packages/cad-ui/CLAUDE.md` | Editing the cad-ui package | What belongs / doesn't belong in cad-ui, generic-stores API, forbidden imports |
| `packages/cad-core/CLAUDE.md` | Editing the cad-core package | "No React, no DOM, no domain" rules, worker pattern, result contract |
| `PROGRESS.md` | Look up before claiming a step is done | Authoritative status of all seven workflow steps, current priority list, known issues |
| `.github/instructions/*.md` | Copilot only | Same rules in GitHub Copilot's frontmatter format. Don't edit these; edit the matching `CLAUDE.md` and let them drift if Copilot users don't care. |

---

## Axis convention — get this wrong and every visual silently breaks

Rendered scene is Three.js Y-up. CAD-coordinate import is handled by `parseSTL` (Z-up → Y-up rotation baked in at parse time).

| Axis | Meaning |
|:---:|---|
| X | Clamping direction — jaws move along X |
| Y | Vertical — gravity, jaw height, rail surface |
| Z | Along the jaw face — jaw width |

`JawBlankConfig` fields are axis-named to enforce this:
- `thickness` → X
- `height`    → Y
- `face`      → Z

If you ever write `position={[face, height, thickness]}` you have already shipped the bug.

---

## Two invariants — break either and the system silently corrupts output

### Invariant 1 — xOffset coupling

The right soft-jaw render position MUST equal the right L-bracket carriage position MUST equal the CSG bake position. All three derive from one helper:

```ts
rightJawCenterX(viseConfig, jawBlank, activePart, clampGap)   // src/utils/partGeometry.ts
rightBracketInnerX(viseConfig, jawBlank, activePart, clampGap) // same file
```

Consumers (all must read from the same helper, never from a local copy):

| File | Role |
|---|---|
| [src/components/3DScene/JawBlankMesh.tsx](src/components/3DScene/JawBlankMesh.tsx) | Render position of the right jaw blank |
| [src/components/3DScene/ViseModel.tsx](src/components/3DScene/ViseModel.tsx) | Render position of the right L-bracket carriage |
| [src/components/3DScene/PillarBoltDecals.tsx](src/components/3DScene/PillarBoltDecals.tsx) | Bolt-exit decals on the moved bracket back face |
| [src/features/jaw-profile/hooks/useJawProfile.ts](src/features/jaw-profile/hooks/useJawProfile.ts) | CSG bake (matrixWorld) for the right blank |
| [src/components/3DScene/CameraController.tsx](src/components/3DScene/CameraController.tsx) | Scene bbox for camera fit |

### Invariant 2 — geometry-cache lifecycle

Three.js `Float32Array`s cannot live in Zustand (non-serialisable). They live in `geometryCache: Map<string, CachedGeometry>` (module-level, [src/stores/geometryCache.ts](src/stores/geometryCache.ts)). The store holds metadata only.

- Every `addPart` MUST pair with `geometryCache.set(part.id, geo)` — see [useImport.ts](src/features/import/hooks/useImport.ts).
- Every `removePart` MUST pair with `geometryCache.delete(id)` — see [softJawsStore.ts](src/stores/softJawsStore.ts).
- Full session reset clears both — see [AppShell.tsx::handleResetSession](src/layout/AppShell.tsx).

Orphan a Float32Array and you leak ~MB per part. Forget to cache one and renders go blank.

---

## Commands

```bash
npx tsc --noEmit          # typecheck — only correctness gate today (no test suite yet)
npm run lint              # eslint
npm run dev               # vite dev server
npm run build             # tsc -b && vite build
```

The `softjaws-verifier` agent (in `.claude/agents/`) runs `tsc --noEmit` plus an invariant + anti-pattern grep. Invoke after non-trivial changes.

---

## House style

- Comments only when the WHY is non-obvious. Never explain WHAT (well-named identifiers do that).
- No backwards-compat shims, no `// removed because…` comments, no half-implementations.
- Match scope to the request — a bug fix is one fix, not surrounding cleanup.
- File references in chat: markdown links `[file.tsx:42](src/file.tsx#L42)`, never bare paths or backticks.
- After meaningful changes, update `PROGRESS.md` proactively. Don't ask first.

---

## Stale-doc warnings (read these before trusting older docs)

- **PROGRESS.md is the truth** for current status. The `.github/instructions/*.md` files predate several refactors — if they disagree with the matching `CLAUDE.md` in this repo, the `CLAUDE.md` wins.
- **`.github/instructions/workflow-implementation.instructions.md`** lists `ViseConfig` fields like `jawDepth`, `maxStroke`, `'two-jaw-vise'`, none of which exist in the current `src/stores/types.ts`. The vise is a single fully-customisable preset; fields are `jawWidth`, `jawHeight`, `jawStroke`, `tSlotWidth`, `tSlotSpacing`.

When in doubt, **read the code**, not the docs.
