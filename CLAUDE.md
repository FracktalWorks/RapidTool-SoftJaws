# RapidTool-SoftJaws — Claude Project Brief

Browser-based CAD app for designing CNC soft-jaw inserts. Imports an STL workpiece → generates two soft jaws with cavities matching the part → exports as STL for machining.

This file is a **supplement** to the authoritative project docs listed below — auto-loaded into every Claude Code conversation (including subagents). Read it for the recent invariants and the things that have already shipped to prod twice when broken. For project structure, three-layer rules, and step-by-step workflow scaffolding, defer to the `.github/instructions/` files.

---

## Authoritative reading order — every task

1. **This file** (CLAUDE.md) — recent invariants, magic-number rules, perf non-negotiables
2. **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — three-layer rule, pre-implementation checklist
3. **[.github/instructions/architecture.instructions.md](.github/instructions/architecture.instructions.md)** — layer-placement decision tree, allowed/forbidden imports
4. **[.github/instructions/layer-placement.instructions.md](.github/instructions/layer-placement.instructions.md)** — quick decision reference per file type
5. **[.github/instructions/cad-ui-integration.instructions.md](.github/instructions/cad-ui-integration.instructions.md)** — cad-ui component APIs, store APIs
6. **[.github/instructions/workflow-implementation.instructions.md](.github/instructions/workflow-implementation.instructions.md)** — 7-step workflow scaffolding pattern
7. **[.github/agents/softjaws-architect.agent.md](.github/agents/softjaws-architect.agent.md)** — the deeper architect spec (Copilot format; same intent as `.claude/agents/`)
8. **[PROGRESS.md](PROGRESS.md)** — status table, P0–P3 priority order, tech-debt list (NB: field-name section is stale, see "Stale doc warnings" below)
9. **[memories/repo/architecture-state.md](memories/repo/architecture-state.md)** — known issues + 7-point refactoring plan

If a rule below conflicts with one of those files, the **other file wins** — they are authoritative for project structure. This file is authoritative only for the recent SoftJaws-specific invariants below.

---

## Axis convention — get this wrong and every visual silently breaks

The rendered scene is Three.js Y-up. (CAD-coordinate import goes through cad-core's `toThreePosition` / `cadToThreeAxis` — that's a separate concern.)

| Axis | Meaning                                                  |
|:----:|----------------------------------------------------------|
| X    | Clamping direction — jaws move along X                   |
| Y    | Vertical — gravity, jaw height, rail surface             |
| Z    | Along the jaw face — jaw width                           |

`JawBlankConfig` fields are axis-named to enforce this:
- `thickness` → X
- `height`    → Y
- `face`      → Z

If you ever write `position={[face, height, thickness]}` you have already shipped the bug.

---

## Single source of truth: vise geometry

All vise dimensions derive from `viseConfig.{jawWidth, jawHeight, jawStroke}`. Helpers live in [src/features/vise-config/data/presets.ts](src/features/vise-config/data/presets.ts):

```ts
viseBodyLen(viseConfig)       // total body length along X
bracketFootLen(viseConfig)    // L-bracket horizontal foot length
bracketInnerX(viseConfig)     // pillar inner face X — soft jaw outer face abuts here
pillarFaceWidth(viseConfig)   // pillar Z width — caps practical jaw face
jawBaseH(jawHeight)           // Y of rail surface (where blanks/parts sit)
```

**Rule: never inline `0.92`, `0.11`, `0.045`, `0.68`, `0.55`, `0.42`, `0.96`, `0.30` etc. anywhere outside `presets.ts` and `ViseModel.tsx`.** If you need a vise dimension elsewhere, route through a helper. If a helper doesn't exist, add one — do not duplicate the formula.

---

## Two invariants — break either and the system silently corrupts output

### Invariant 1 — xOffset coupling

The soft-jaw render position MUST equal the CSG bake position MUST equal the camera-fit position. All three derive from the same formula:

```ts
const xOffset = bracketInnerX(viseConfig) - jawBlank.thickness / 2;
```

| File                                                                                 | Role                       |
|--------------------------------------------------------------------------------------|----------------------------|
| [src/components/3DScene/JawBlankMesh.tsx](src/components/3DScene/JawBlankMesh.tsx)   | render position            |
| [src/features/jaw-profile/hooks/useJawProfile.ts](src/features/jaw-profile/hooks/useJawProfile.ts) | CSG bake (matrixWorld)     |
| [src/components/3DScene/CameraController.tsx](src/components/3DScene/CameraController.tsx) | scene bbox for camera fit  |

If you change one, change all three in the same commit. Always.

### Invariant 2 — geometry-cache lifecycle

Three.js Float32Arrays cannot live in Zustand (non-serializable). They live in `geometryCache: Map<string, CachedGeometry>` (module-level, [src/stores/geometryCache.ts](src/stores/geometryCache.ts)). The store holds metadata only.

- Every `addPart` MUST be paired with `geometryCache.set(part.id, geo)` — see [useImport.ts](src/features/import/hooks/useImport.ts).
- Every `removePart` MUST be paired with `geometryCache.delete(id)`.
- Full session reset clears both — see [AppShell.tsx::handleResetSession](src/layout/AppShell.tsx).

Orphan a Float32Array in the cache and you leak ~MB per part. Forget to cache one and renders go blank.

---

## Hot paths

```
STL file
  ↓ parseSTL  (sync, main thread today — see Perf below)
CachedGeometry + ProcessedPart
  ↓
softJawsStore.parts
  ├─→ render path: PartMeshes / JawBlankMesh / ViseModel  (store-driven)
  └─→ CSG path:    useJawProfile.generate()
                     ↓ build positioned blank box (left & right)
                     ↓ bake matrixWorld into geometry
                     ↓ 2× Worker(profileWorker.ts) in parallel
                     ↓ CSGEngine.createNegativeSpace (sweep blank − part)
                     ↓ cache JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT}
                     ↓ store.jawProfile.generated = true
                     ↓ Scene3D swaps JawBlankMesh → JawProfileMesh
  ↓
meshToSTL → downloadFile
```

---

## Performance non-negotiables

- **Always slice the store.** `useSoftJawsStore(s => s.viseConfig.jawWidth)`. Never `useSoftJawsStore()` without a selector — it re-renders on any field change.
- **Never `new Worker(...)` ad-hoc** — use cad-core's `workerManager` ([packages/cad-core/src/workers/workerManager.ts](packages/cad-core/src/workers/workerManager.ts)).
- **`useMemo` every geometry derivation.** `useCallback` every handler passed to children.
- **STL parse > 50 MB → must run in a worker.** Today's 200 MB limit blocks the UI thread for seconds.
- **CSG depth × segments is quadratic.** Crop the tool mesh to the local clamp band before CSG; don't sweep through the whole part.

---

## Workflow step status — current truth (defer to PROGRESS.md for narrative)

| Step           | Status | Notes                                                              |
|----------------|--------|--------------------------------------------------------------------|
| vise-config    | real   | Drives ALL geometry — touch carefully                              |
| import         | real   | parseSTL → store + cache                                           |
| jaw-blank      | real   | Drives JawBlankMesh dimensions and material                        |
| jaw-profile    | real   | CSG worker → JawProfileMesh                                        |
| grip-features  | STUB   | UI writes to store; geometry pipeline ignores it                   |
| mounting-holes | being built (this branch) | Real CSG drilled per blank as a 3rd pass        |
| export         | real   | STL only; 3MF returns "not implemented"                            |

---

## Not yet wired — do NOT claim these work

- Undo / redo buttons (UI present, `useHistoryStore` exists in cad-ui but not connected)
- 3MF export
- Multi-part jaw generation (only `activePart ?? parts[0]` is used in CSG)
- Grip features → geometry

If you implement any of these, also delete the matching line above.

---

## Stale doc warnings (don't trust these specific sections)

- **PROGRESS.md lines 152-156** — references `jawBlank.depth` / `jawBlank.width`. The actual code uses `jawBlank.thickness` / `jawBlank.face` (renames happened more recently in [src/stores/types.ts](src/stores/types.ts#L52-L60)).
- **workflow-implementation.instructions.md** — `ViseConfig` schema lists `jawDepth`, `maxStroke`, `'two-jaw-vise'` etc. Actual code: `jawStroke`, `'custom'` only — see [src/stores/types.ts:37-46](src/stores/types.ts#L37-L46).

When in doubt, **read the code**, not the docs.

---

## Commands

```bash
npx tsc --noEmit          # typecheck — only gate today (no test suite yet)
npm run lint              # eslint
npm run dev               # vite dev server
npm run build             # tsc -b && vite build
```

---

## House style

- Comments only when the WHY is non-obvious. Never explain WHAT (well-named identifiers do that).
- No backwards-compat shims, no `// removed because…` comments, no half-implementations.
- Match scope to the request — bug fix means one fix, not surrounding cleanup.
- File-reference style in chat: markdown links `[file.tsx:42](src/file.tsx#L42)`, never bare paths or backticks.
