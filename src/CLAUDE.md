# `src/` — Application layer

Soft-jaw domain code. Knows about jaws, vise, parts, workflow steps. Imports `cad-ui` and `cad-core`, never the reverse.

## Layer-placement decision

Before adding any new file, answer this in order:

```
Pure logic, no React, no DOM?
   ├─ Generic (would PCB/Fixture also use it?) → packages/cad-core/
   └─ Soft-jaw specific                        → src/features/<step>/utils/

React component or hook?
   ├─ Zero domain knowledge (Button, NumberInput, ViewCube, cn, generic stores)
   │                                            → packages/cad-ui/
   └─ Mentions jaws / vise / grip / part        → src/

   Inside src/:
   ├─ Workflow step UI       → src/features/<step>/components/
   ├─ Workflow step logic    → src/features/<step>/hooks/
   ├─ Workflow step worker   → src/features/<step>/worker/
   ├─ Domain Zustand store   → src/stores/
   ├─ 3D scene component     → src/components/3DScene/
   ├─ Cross-feature utility  → src/utils/
   └─ Layout wiring          → src/layout/
```

## Dependency direction — never reverse

```
src/  →  @rapidtool/cad-ui  →  @rapidtool/cad-core
```

**Forbidden imports** (verifier scans for these):
- `@rapidtool/cad-core` importing anything React, shadcn, Radix, lucide-react
- `@rapidtool/cad-ui` importing `next-themes` or any framework binding (must stay framework-agnostic)
- `@rapidtool/cad-*` importing `@/...` or `src/...`
- `src/features/A` importing from `src/features/B` (cross-feature coupling)

## Feature module shape

Every `src/features/<step>/` follows:
```
src/features/<step>/
├── components/   React UI for the step
├── hooks/        Step-local hooks (e.g. useJawProfile)
├── worker/       Web-worker entry (optional, e.g. profileWorker.ts)
├── utils/        Pure helpers private to the step
├── data/         Static catalogs / presets (optional)
└── types.ts      Step-local types (optional)
```

Step UI is registered in `src/components/ContextOptionsPanel/` via the `STEP_COMPONENTS` map.

## Hot path — what runs when

```
STL upload
  → parseSTL (main thread, Z-up → Y-up rotation baked in)
  → geometryCache.set(partId, geo) + softJawsStore.addPart(meta)
  → PartMeshes renders the cached Float32Array
  → User clicks "Generate Profile"
    → useJawProfile builds positioned blanks, fires 2 workers in parallel
    → JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT} written
    → softJawsStore.jawProfile.generated = true
    → JawProfileMesh replaces JawBlankMesh in Scene3D
  → User clicks "Drill Mounting Holes"
    → useMountingHoles drills through JAW_PROFILE → JAW_HOLED cache
  → User clicks "Export"
    → useExport reads JAW_HOLED ?? JAW_PROFILE ?? raw blank, downloads two STLs
```

## Performance non-negotiables

- **Slice the store.** `useSoftJawsStore(s => s.jawBlank.thickness)`. Never `useSoftJawsStore()` without a selector — it re-renders on every field change.
- **Never `new Worker(...)` ad-hoc.** Workers live under `src/features/<step>/worker/` and are loaded via `new Worker(new URL(...), { type: 'module' })`. Cross-cutting workers go through `cad-core`'s `workerManager`.
- **`useMemo` every geometry derivation, `useCallback` every handler passed to children.** Geometry derivations allocate `THREE.BufferGeometry` — leaks per render otherwise.
- **CSG cost is quadratic in mesh density.** Crop the tool mesh to the local cut band before sending it to a worker; don't sweep the whole part through.

## Store rules

- One concern per store file. Domain stores: `softJawsStore`, `viseStore`, `dimensionHover`. Generic stores (workflow, selection, UI, history, transform) live in `cad-ui`.
- All stores use Zustand + Immer + devtools middleware.
- The single non-serialisable cache `geometryCache` (module-level `Map<string, CachedGeometry>`) holds Float32Arrays. **Every `addPart` MUST pair with `geometryCache.set`; every `removePart` MUST pair with `geometryCache.delete`.** Invariant 2 in the root `CLAUDE.md`.
- Cross-store invalidation (e.g. `viseStore` change → `softJawsStore.jawProfile.generated = false`) lives in `AppShell.tsx` via `useViseStore.subscribe`.

## "Would another RapidTool product need this?" test

If yes → `cad-ui` (if React) or `cad-core` (if pure logic). If no → `src/`.
