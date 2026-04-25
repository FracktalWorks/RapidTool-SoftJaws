# RapidTool — SoftJaws Progress Tracker

> Last updated: 2026-04-21
> Branch: `main`

---

## Architecture (3 layers)

```
src/                    ← app layer (domain: jaws, vise, parts)
packages/cad-ui/        ← generic React UI (layout, workflow store, primitives)
packages/cad-core/      ← pure algorithms (STL parser, CSG, geometry math)
```

---

## Workflow Steps

| # | Step ID | Label | UI | Logic | 3D Preview | Status |
|---|---------|-------|----|-------|------------|--------|
| 1 | `vise-config` | Vise Configuration | Done | Done | Done | **Complete** |
| 2 | `import` | Import Part | Done | Done | Done | **Complete** |
| 3 | `jaw-blank` | Jaw Blank Setup | Done | Done | Done (2 blanks) | **Complete** |
| 4 | `jaw-profile` | Jaw Profile (CSG) | Done | Done | Done (2 results) | **Complete (visual verify pending)** |
| 5 | `grip-features` | Grip Features | Done (stub) | None | None | Stub |
| 6 | `mounting-holes` | Mounting Holes | Done (stub) | None | None | Stub |
| 7 | `export` | Export STL/3MF | Done (stub) | None | N/A | Stub |

---

## What's Done

### Infrastructure
- [x] Vite + React + TypeScript + Tailwind project setup
- [x] Three-layer architecture (`src/`, `cad-ui`, `cad-core`)
- [x] Zustand + Immer store (`softJawsStore`) with full state shape
- [x] `useWorkflow` hook — step navigation, `completeStep()`, `nextStep()`
- [x] `DashboardLayout` (cad-ui) — left panel, 3D viewport, right panel
- [x] Properties panel default collapsed, left-panel scroll fixed

### Step 1 — Vise Config (`src/features/vise-config/`)
- [x] 15 real vise presets: Spreitzer (5), Roemheld (3), Kurt (2), Schunk (2), Glacern (1), Custom (1)
- [x] Grouped UI with manufacturer section headers
- [x] `selectPreset` seeds `viseConfig` + `jawBlank` dimensions
- [x] `ViseType` union in `stores/types.ts` matches all presets
- [x] Default vise: `spreitzer-mzc-125` (125×60mm, 140mm stroke)
- [x] Presets + helpers extracted to `data/presets.ts` (importable from any module without React)
- [x] `suggestVise(dimX, dimY, dimZ)` — returns smallest preset that fits the part
- [x] Auto-suggest fires from `useImport` when current vise can't accommodate the imported part

### Step 2 — Import (`src/features/import/`)
- [x] Drag-and-drop STL file import
- [x] `geometryCache` — module-level Map for non-serializable Float32Arrays
- [x] `ParseResult.meta` typed as `Omit<ProcessedPart, 'transform'>`
- [x] Part bounding box stored in `ProcessedPart`
- [x] PivotControls gizmo (move/rotate) on tap — committed to store on drag end

### Step 4 — Jaw Profile (`src/features/jaw-profile/`)
- [x] UI: clearance + pocket depth + Generate button
- [x] `useJawProfile` runs **two** CSG workers in parallel (left & right blank)
- [x] Removal directions: left = `[-1, 0, 0]`, right = `[+1, 0, 0]` (cuts into inner X-face)
- [x] Both blanks baked to world space before CSG → results in world coords
- [x] Results cached under `JAW_PROFILE_CACHE_KEY_LEFT` / `..._RIGHT`
- [x] CSG indices preserved end-to-end (was the "garbled mesh" bug)

### 3D Viewport (`src/components/3DScene/`)
- [x] `ViseModel.tsx` — base slab + slide rail + bolt holes + lead screw + handwheel
  - Hard-jaw carriages **removed** — soft-jaw blanks now occupy ±jawXOffset and ARE the deliverable
- [x] `JawBlankMesh.tsx` — renders **two** translucent blanks at `±(jawOpening/2 + depth/2)`
  - Axis mapping: `depth`=X-thickness, `height`=Y, `width`=Z face
- [x] `JawProfileMesh.tsx` — renders **two** profiled result meshes from cache (replaces blanks when generated)
- [x] `PartMeshes.tsx` — real renderer reading `geometryCache`; gizmo selection wired
  - Fixed "model flies into the air" bug: declarative R3F `position` props were fighting `SelectableTransformControls`. Solution: no declarative props; `useLayoutEffect` syncs from store only when `gizmoActive === false`.
- [x] `CameraController.tsx` — orthographic camera fit
  - Initial iso fit: camera repositioned to `center + normalize(1,1,1) * 2.5 * maxDim`
  - `set-view-orientation` event → `snapToOrientation()` (front/back/left/right/top/iso)
  - `computeSceneBox` accounts for two blanks at ±xOffset
  - Re-fit on new part import

### Geometry helpers (`src/features/vise-config/data/presets.ts`)
- [x] `jawBaseH(jawHeight)` = `jawHeight * 0.55` — blank/part rest height
- [x] `jawThick(jawWidth)` = `max(jawWidth * 0.14, 12)` — vise hard-jaw thickness
- [x] `GRIP_CLEARANCE` = 2 mm per side
- [x] `computeJawOpening(jawStroke, activePartWidth)` — distance between blank inner faces
- [x] `computeJawXOffset(viseConfig, activePartWidth)` — signed X centerline of each jaw

---

## What's Next (Priority Order)

### P0 — Visual verification of two-blank CSG
- [ ] Boot dev server, import a sample STL, run jaw-profile generate
- [ ] Confirm pocket cuts on each blank's inner X-face (not top, not outer face)
- [ ] Confirm both blanks visible at ±xOffset, sitting on the rail at Y = baseH

### P1 — Mounting Holes Geometry
- [ ] `MountingHolesRenderer.tsx` — bolt-hole cylinders drilled into each blank
- [ ] Hole positions driven by `mountingHoles` store state (bolt size, spacing, count)
- [ ] Align to vise T-slot spacing from `viseConfig.tSlotSpacing`
- [ ] Run as a 3rd CSG pass per blank, after the profile pocket

### P2 — Export
- [ ] Serialize each profiled blank (with mounting holes) to STL binary
- [ ] Two files: `softjaw-left.stl`, `softjaw-right.stl`
- [ ] Trigger browser file downloads (`URL.createObjectURL`)
- [ ] 3MF export (stretch goal)

### P3 — Grip Features Geometry
- [ ] Generate serration/diamond geometry on each blank's pocket face
- [ ] Low priority — finish P1–P2 first

---

## Architecture: End Product (resolved)

**The export is TWO aluminium jaw blank plates.** ✅ implemented in viewport.

Each plate has a pocket cut into its inner (X-facing) face matching the workpiece profile.
The operator bolts them onto the vise jaw carriages, then the workpiece snaps in with precision.

### Layout (now matches end product)

| Element | Implementation |
|---------|---------------|
| Jaw blanks | 2 blocks at `±(jawOpening/2 + depth/2)` ✅ |
| CSG removal dir | `[-1,0,0]` (left) / `[+1,0,0]` (right) ✅ |
| Hard-jaw carriages | Hidden — blanks replace them in the viewport ✅ |
| Export | 2 STL files (TODO — Sprint 3) |

### Blank position formulas (live in `data/presets.ts`)
```
opening   = computeJawOpening(jawStroke, activePartWidth)
xOffset   = opening / 2 + jawBlank.depth / 2

Left blank center  = (-xOffset, baseH + height/2, 0)
Right blank center = (+xOffset, baseH + height/2, 0)
baseH              = jawHeight * 0.55
```

Axis mapping for `jawBlank`:
- `depth`  → X thickness (stick-out from carriage)
- `height` → Y vertical
- `width`  → Z face width (matches `jawWidth`)

---

## Known Issues / Tech Debt

| Issue | File | Priority |
|-------|------|----------|
| `cn()` duplicated in `src/components/ui/` and `cad-ui` | `src/lib/utils.ts` | Low |
| shadcn primitives in `src/components/ui/` (should be in cad-ui) | `src/components/ui/` | Low |
| 1.2MB main JS bundle | vite config | Low |
| `ViseModel` keeps `jawOpening` prop for API compat but no longer uses it | `ViseModel.tsx` | Cleanup |
| Default `jawBlank.depth = 60% of jawWidth` is too thick for a soft jaw stick-out (~30mm typical). Consider rescaling default. | `softJawsStore.ts`, `useImport.ts`, `ViseConfigStepContent.tsx` | Polish |

---

## Key File Map

```
src/
├── stores/
│   ├── softJawsStore.ts       — main domain store (Zustand+Immer)
│   ├── geometryCache.ts       — non-serializable geometry Map (LEFT/RIGHT keys)
│   └── types.ts               — ViseConfig, JawBlankConfig, ProcessedPart, etc.
├── workflow/
│   ├── steps.ts               — SOFTJAWS_WORKFLOW_STEPS array + step type
│   └── stepConfig.ts          — STEP_CONFIG (labels, help text, skippable)
├── hooks/
│   └── useWorkflow.ts         — nextStep / prevStep / completeStep wrappers
├── features/
│   ├── vise-config/
│   │   ├── components/ViseConfigStepContent.tsx
│   │   └── data/presets.ts                        — VISE_PRESETS + suggestVise + geometry helpers
│   ├── import/
│   │   ├── components/ImportStepContent.tsx
│   │   └── hooks/useImport.ts                     — STL parse + auto-suggest vise
│   ├── jaw-blank/components/JawBlankStepContent.tsx
│   ├── jaw-profile/
│   │   ├── components/JawProfileStepContent.tsx
│   │   ├── hooks/useJawProfile.ts                 — runs 2 parallel CSG workers
│   │   └── worker/profileWorker.ts                — three-bvh-csg per side
│   ├── grip-features/components/GripFeaturesStepContent.tsx   (stub)
│   ├── mounting-holes/components/MountingHolesStepContent.tsx (stub)
│   └── export/components/ExportStepContent.tsx                (stub)
├── components/3DScene/
│   ├── ViseModel.tsx          — base + rail + screw (no hard-jaw carriages)
│   ├── JawBlankMesh.tsx       — two translucent blanks at ±xOffset
│   ├── JawProfileMesh.tsx     — two profiled CSG results
│   ├── PartMeshes.tsx         — imported parts + gizmo
│   └── CameraController.tsx   — ortho camera fit + orientation snapping
└── layout/
    └── AppShell.tsx           — wires DashboardLayout to step panel components

packages/
├── cad-ui/                    — DashboardLayout, SelectableTransformControls, etc.
└── cad-core/                  — STL parser, CSGEngine (createNegativeSpace)
```
