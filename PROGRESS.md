# RapidTool — SoftJaws Progress Tracker

> Last updated: 2026-05-12 (bolt-Y formula corrected — fixed offset, not fraction)
> Branch: `main` — head `5b10f06` (+ uncommitted bolt-Y fix)

---

## Architecture (3 layers)

```
src/                    ← app layer (domain: jaws, vise, parts, hover, axis colours)
packages/cad-ui/        ← generic React UI (layout, workflow store, primitives)
packages/cad-core/      ← pure algorithms (CSG, geometry math, exporters)
```

---

## Workflow Steps — current truth

| # | Step ID | Label | UI | Logic | 3D | Status |
|---|---------|-------|----|-------|----|--------|
| 1 | `vise-config` | Vise Configuration | ✅ Bounded, axis-coloured, design preview | ✅ Decoupled parametric, bracket-pattern coupling | ✅ Fixed bed / bracket dims, literal pillar Y/Z | **Real** |
| 2 | `import` | Import Part | ✅ Drag-drop + gizmo | ✅ STL parser with Z-up → Y-up rotation | ✅ World-AABB cached | **Real** |
| 3 | `jaw-blank` | Jaw Blank Setup | ✅ Trinckle labels, design preview | ✅ Independent of vise | ✅ Right jaw + carriage move together | **Real** |
| 4 | `jaw-profile` | Jaw Profile (CSG) | ✅ Axis-coloured, derived part-X panel, hover preview | ✅ Parallel L/R workers, rotation-aware bake, auto-invalidate on input change | ✅ Two pocketed blanks | **Real** |
| 5 | `grip-features` | Grip Features | ✅ Pattern picker, depth/spacing | ❌ No geometry pipeline | ❌ Not rendered | **STUB** (only remaining unfinished feature) |
| 6 | `mounting-holes` | Mounting Holes | ✅ Bolt size / spacing / count + "Match vise" hint | ✅ Real CSG into JAW_PROFILE → JAW_HOLED | ✅ Holes + pillar exit decals | **Real** |
| 7 | `export` | Export STL/3MF | ✅ Format + quality picker | ✅ Two-STL download, HOLED→PROFILE→blank fallback | n/a | **Real** (STL only — 3MF returns "not implemented") |

---

## What's Done (post-session-2026-05) — by workflow step

### Step 1 — Vise Configuration
- [x] **Three-axis decoupling** — `jawStroke` → X only, `jawWidth` → Z only, `jawHeight` → only the pillar Y. No cross-axis coupling.
- [x] **Literal precision** — pillar Y = `jawHeight`, pillar/body Z = `jawWidth`, `2 × bracketInnerX = jawStroke` exactly. UI numbers match rendered viewport dimensions.
- [x] **Bed / bracket decoupled into fixed hardware constants** — `RAIL_HEIGHT (40 mm)`, `BR_FOOT_LEN (30 mm)`, `BR_FOOT_H (5 mm)`, `BR_PILLAR_LEN (30 mm)`. Changing stroke no longer resizes the pillar; changing vise height no longer raises the bed.
- [x] **Bounded inputs with clamp-on-paste** — width 50–200, height 50–200, stroke 100–300.
- [x] **Trinckle-aligned UI** — labels in Trinckle order (Max stroke X → Vise width Y → Vise height Z), axis-coloured.
- [x] **Preset selection seeds `mountingHoles.spacing` from `viseConfig.tSlotSpacing`** so soft-jaw bolts match the customer's actual vise.

### Step 2 — Import (STL)
- [x] **Z-up CAD → Y-up R3F rotation baked into `parseSTL`** — SolidWorks / Fusion / Onshape STLs now land standing correctly. One transform applied at parse time to vertices, normals, and bbox.
- [x] Drag-and-drop STL upload, binary + ASCII parsers.
- [x] PivotControls gizmo move/rotate, committed to store on drag end.
- [x] `geometryCache` (module-level Map) for non-serializable Float32Arrays.
- [x] `removePart` pairs with `geometryCache.delete(id)` — CLAUDE.md Invariant 2 honoured.

### Step 3 — Jaw Blank Setup
- [x] **Trinckle parameter labels** — Length (X), Width (Y), Height (Z) — axis-coloured to match the design-preview arrows.
- [x] **Independent of vise** — explicit copy in UI; preset changes do not resize jaw stock.
- [x] **Material dropdown removed** — was clutter; the store still carries `material` but it's a fixed `aluminum-6061` default and unsurfaced.
- [x] **Mesh decluttered** — `SideBolt` counterbore decals (z-fight source) and the `DragHandle` resize arrows are gone. The blank renders as a clean stock box.
- [x] **Design-block preview wired** — hovering Length / Width / Height shows the corresponding R3F axis arrow on a forged-aluminium box.
- [x] **Right jaw + right L-bracket carriage move together** — both derive their X from `bracketInnerX − thickness/2` via shared rotation-aware `computeWorldSpanX()`.

### Step 4 — Jaw Profile (CSG)
- [x] **Pocket depth clamped** to `jawBlank.thickness − 5 mm` back-wall in the input handler.
- [x] **Cache invalidation on every CSG input change** — same-store actions (`addPart`, `removePart`, `setActivePart`, `updatePartTransform`, `updateJawBlank`, depth/clearance) reset `jawProfile.generated`.
- [x] **Cross-store invalidation in `AppShell`** — `viseConfig` changes also clear the flag via `useViseStore.subscribe`.
- [x] **Rotation-aware blank position** via shared `computeWorldSpanX()` utility — consistent across `PartMeshes`, `ViseModel`, `JawBlankMesh`, `useJawProfile`.
- [x] **Derived "Part span (X)" panel** in the step UI — same value the CSG consumes, displayed read-only.
- [x] **Hover preview** — `scope: 'profile'` renders the jaw blank with a partial arrow showing the pocket depth on X.

### Step 5 — Grip Features
- [ ] **STUB** — UI exists (pattern picker, depth, spacing inputs) but no geometry pipeline. Nothing renders. Last unfinished feature in the workflow.

### Step 6 — Mounting Holes
- [x] **Bolt Y is a fixed hardware offset** — `bracketBoltY = RAIL_HEIGHT + BR_FOOT_H + BR_BOLT_Y_OFFSET = 75 mm`. Replaces the older `× BR_BOLT_Y_FRAC` formula which scaled with `jawHeight` and pushed bolts outside the jaw blank on tall pillars (the CSG cylinder then sat in mid-air, producing a "dummy hole" — pillar decal but no jaw drill).
- [x] **Spacing auto-derives from `viseConfig.tSlotSpacing`** on preset change; default raised from 50 → 125 mm.
- [x] **Step 6 UI hint** — green ✓ when spacing matches the vise's bolt pattern, amber + one-click "Match vise" when not.
- [x] **Real CSG** drills counterbore + through-hole into each profiled blank; result cached under `JAW_HOLED_CACHE_KEY_{LEFT,RIGHT}`.
- [x] **`PillarBoltDecals`** renders exit-hole decals on the pillar back face — consumes the same positions as the CSG drill, so jaw + pillar alignment is by construction.

### Step 7 — Export
- [x] Two STL files: `SoftJaw-Left.stl`, `SoftJaw-Right.stl`.
- [x] Cache fallback chain `JAW_HOLED_* ?? JAW_PROFILE_* ?? raw blank`.
- [x] Mesh at origin (geometry already world-baked) — no double transform.
- [ ] 3MF export — UI option exists, currently returns "not implemented".

---

## Cross-cutting changes (not tied to a single step)

### Trinckle-grade UX layer
- [x] **Axis-coloured labels** (X red, Y green, Z blue) sourced from `src/utils/axisColors.ts` — single module shared by panel text and 3D arrows so colours can never drift.
- [x] **DesignBlockPreview** — floating card with isolated R3F canvas, axis-arrow, world-axis triad, scope-aware material (steel for vise, forged for jaw, partial arrow for pocket depth).
- [x] **`useDimensionHoverStore`** — single zustand slot, scopes `vise | jaw | profile`, set on hover/focus and cleared on leave/blur.
- [x] **Iso-framed orthographic camera** for the preview, with explicit `lookAt(0, 0, 0)` in a `useLayoutEffect` (R3F's `<OrthographicCamera>` does not auto-aim).

### Reset & housekeeping
- [x] **Reset button** clears `geometryCache`, resets `softJawsStore` AND `viseStore`, re-fits camera via `set-view-orientation: 'iso'`.
- [x] Number-input spinner CSS no longer absolute-positioned over the digits (was clipping values); input widths bumped from `w-20` to `w-28` for 6-char fit.
- [x] L-bracket pillar Y dimension now equals `jawHeight` literally (no `0.88 ×` scaling) — viewport matches the spec.

### New shared utilities (added this session)
- [x] `src/utils/axisColors.ts` — CAD axis colours + matching Tailwind classes.
- [x] `src/utils/partGeometry.ts` — `computeWorldSpanX(part)` rotation-aware AABB X span.
- [x] `src/stores/dimensionHover.ts` — hover slot for the design-block preview.
- [x] `src/components/DesignBlockPreview.tsx` — Trinckle-style floating R3F card.

---

## What's Next (Priority Order)

### P0 — Visual / functional verification in the browser
- [ ] Boot dev server, import a real Fusion/SolidWorks STL, walk all 7 steps
- [ ] Verify Z-up rotation correctness for the dominant CAD STLs
- [ ] Verify CSG → cache → export end-to-end with both jaws

### P1 — **Jaw blank vs L-bracket pillar Y alignment** ⚠
**Mark for later — needs action**

The jaw blank bottom sits on the rail (Y=40) while the pillar bottom sits on its foot (Y=45). Both are 65 mm tall when the parameter says 65, but the pillar top reads 5 mm above the jaw top because of the `BR_FOOT_H = 5` offset.

Three options analysed earlier:
- **Option 1 (recommended)**: shift jaw `baseY` up by `BR_FOOT_H` in `JawBlankMesh.tsx` AND `useJawProfile.ts` so jaw and pillar align. Workpiece stays on the rail, parallels (real CNC practice) lift it 5 mm into the jaw zone.
- Option 2: set `BR_FOOT_H = 0`, removing the foot entirely.
- Option 3: keep as-is, document the offset.

Decision deferred — revisit after the P0 browser pass.

### P2 — Mounting-hole counterbore clearance (residual edge case)
- [x] Dominant cause fixed (bolt-Y no longer scales with `jawHeight`, so tall pillars no longer push the bolt out of the jaw)
- [ ] **Residual**: if user picks a very short `jawBlank.height` (≤ ~40 mm), the fixed bolt Y=75 still escapes the jaw top. Same "dummy hole" outcome but now triggered only by an unusually short jaw blank.
- [ ] Fix: clamp bolt Y in `positions.ts` to `Math.min(jawTopY − margin, bracketBoltY())` where `margin = counterboreR + 1 mm`. Math + diagram already prepared.

### P3 — Grip Features geometry
- [ ] Generate serration/diamond geometry on each blank's pocket face
- [ ] Last unfinished feature in the workflow

### P4 — Polish & wired-but-not-finished
- [ ] **"Lay flat on rail" gizmo action** (Option C from STL orientation discussion) — auto-orient by bounding box, complementary to the Z-up swap for Y-up STLs
- [ ] **3MF export** (currently returns "not implemented")
- [ ] **Undo/redo** — UI buttons exist, `useHistoryStore` exists in cad-ui, never wired
- [ ] **Multi-part jaw generation** — CSG only consumes `activePart ?? parts[0]`
- [ ] **STL parse worker** — files > 50 MB currently block the main thread

### P5 — Architecture refactor (long-term)
- [ ] Move `src/components/ui/*` shadcn primitives → `packages/cad-ui/src/components/ui/`
- [ ] Dedup `cn()` (exists in both src/ and cad-ui)
- [ ] Add `lucide-react` + radix to cad-ui deps
- [ ] App-layer `RapidToolLogo` / `ThemeToggle` become thin wrappers over cad-ui versions

---

## Geometry helpers (`src/features/vise-config/data/presets.ts`)

```ts
// All fixed hardware (no longer scales with stroke or vise height):
VISE_GEOMETRY.RAIL_HEIGHT     = 40 mm   // bed/rail Y — jawBaseH() returns this
VISE_GEOMETRY.BR_FOOT_LEN     = 30 mm   // L-bracket foot X length
VISE_GEOMETRY.BR_FOOT_H       =  5 mm   // L-bracket foot Y height
VISE_GEOMETRY.BR_PILLAR_LEN   = 30 mm   // L-bracket pillar X thickness

// Literal precision (1.0 → parameter equals visible dimension):
VISE_GEOMETRY.TIER1_W_FRAC    = 1.00
VISE_GEOMETRY.TIER2_W_FRAC    = 1.00
VISE_GEOMETRY.TIER3_W_FRAC    = 1.00
VISE_GEOMETRY.BR_FOOT_W_FRAC  = 1.00    // pillar Z = jawWidth literally
VISE_GEOMETRY.BR_PILLAR_H_FRAC = 1.00   // pillar Y = jawHeight literally

// Bolt centreline — fixed hardware offset, does NOT scale with jawHeight:
VISE_GEOMETRY.BR_BOLT_Y_OFFSET = 30 mm  // mm above the bracket foot top
```

```ts
// Derived helpers (single source of truth, consumed by every R3F mesh + CSG):
jawBaseH()                  = RAIL_HEIGHT                                    // fixed
viseBodyLen(jawStroke)      = jawStroke + 2 × BR_FOOT_LEN
bracketInnerX(jawStroke)    = jawStroke / 2                                  // literal
pillarFaceWidth(jawWidth)   = jawWidth × TIER2_W_FRAC × BR_FOOT_W_FRAC       // = jawWidth
bracketBoltY()              = RAIL_HEIGHT + BR_FOOT_H + BR_BOLT_Y_OFFSET   // = 75 mm, fixed
computeWorldSpanX(part)     = rotation-aware AABB X span                     // src/utils/partGeometry.ts
```

---

## Key Invariants (CLAUDE.md — current truth)

1. **xOffset coupling** — `JawBlankMesh`, `ViseModel`, `useJawProfile`, `CameraController` all derive their right-jaw X from the same formula and the same `worldWidth`. ✅
2. **Geometry-cache lifecycle** — `addPart` pairs with `geometryCache.set`; `removePart` pairs with `geometryCache.delete`. ✅
3. **Three-axis decoupling** — `jawWidth → Z only`, `jawStroke → X only`, `jawHeight → only pillar Y`. ✅
4. **Magic numbers in `presets.ts` only** — `BACK_WALL_MIN = 5` in `JawProfileStepContent.tsx` is the only feature-local constant; all vise geometry lives in `VISE_GEOMETRY`. ✅
5. **CSG result invalidation** — any change to vise / blank / part / profile inputs marks `jawProfile.generated = false`. ✅
6. **Single source of truth for mounting holes** — `computeMountingHolePositions` is the only function that decides Y and Z; jaw CSG and pillar decals both consume it. ✅

---

## Known Issues / Tech Debt

| Issue | File | Priority |
|-------|------|----------|
| **Jaw blank ↔ pillar Y alignment** — same `height` numbers render 5 mm misaligned because of `BR_FOOT_H` | `JawBlankMesh.tsx`, `useJawProfile.ts` | **P1 (parked)** |
| Counterbore can break through jaw top when jaw shorter than pillar | `positions.ts` | P2 |
| Grip Features step has no geometry pipeline | `grip-features/` | P3 |
| `cn()` duplicated in `src/lib/utils.ts` and `cad-ui` | `src/lib/utils.ts` | Low |
| shadcn primitives in `src/components/ui/` should be in cad-ui | `src/components/ui/` | Low |
| 1.2 MB main JS bundle | vite config | Low |
| `MATERIAL_COLORS` map in `JawBlankMesh.tsx` is dead code (material dropdown removed) | `JawBlankMesh.tsx` | Cleanup |
| `ViseModel` keeps `jawOpening` prop for API compat, unused | `ViseModel.tsx` | Cleanup |

---

## Key File Map

```
src/
├── stores/
│   ├── softJawsStore.ts       — main domain store (parts, jaw, profile, holes, export)
│   ├── viseStore.ts           — vise hardware config (separate store)
│   ├── geometryCache.ts       — module-level Float32Array Map
│   ├── dimensionHover.ts      — hover slot for design-block preview ⭐
│   └── types.ts
├── utils/
│   ├── axisColors.ts          — AXIS_COLORS + AXIS_TEXT_CLASS, single source ⭐
│   └── partGeometry.ts        — computeWorldSpanX (rotation-aware AABB) ⭐
├── workflow/
│   ├── steps.ts
│   └── stepConfig.ts
├── hooks/
│   └── useWorkflow.ts
├── features/
│   ├── vise-config/
│   │   ├── components/ViseConfigStepContent.tsx
│   │   └── data/presets.ts                        — VISE_GEOMETRY + helpers
│   ├── import/
│   │   ├── components/ImportStepContent.tsx
│   │   ├── hooks/useImport.ts
│   │   └── utils/parseSTL.ts                      — with Z-up → Y-up rotation ⭐
│   ├── jaw-blank/components/JawBlankStepContent.tsx
│   ├── jaw-profile/
│   │   ├── components/JawProfileStepContent.tsx   — bounds, derived display, hover wiring
│   │   ├── hooks/useJawProfile.ts                 — parallel CSG workers
│   │   └── worker/profileWorker.ts
│   ├── mounting-holes/
│   │   ├── components/MountingHolesStepContent.tsx — "Match vise" hint
│   │   ├── data/positions.ts                       — single source for hole positions
│   │   ├── hooks/useMountingHoles.ts
│   │   └── utils/buildHoleTool.ts                  — counterbore + through-hole CSG tool
│   ├── grip-features/components/GripFeaturesStepContent.tsx   (stub)
│   └── export/
│       ├── components/ExportStepContent.tsx
│       └── hooks/useExport.ts                      — two-STL download w/ cache fallback
├── components/
│   ├── 3DScene.tsx                — main viewport composer
│   ├── DesignBlockPreview.tsx     — Trinckle-style hover card (isolated R3F canvas) ⭐
│   └── 3DScene/
│       ├── ViseModel.tsx          — body + L-brackets (rotation-aware right-bracket tracking)
│       ├── JawBlankMesh.tsx       — two blanks, decluttered
│       ├── JawProfileMesh.tsx     — CSG result meshes
│       ├── PartMeshes.tsx         — imported parts + gizmo
│       ├── PillarBoltDecals.tsx   — bolt exit visuals
│       └── CameraController.tsx
└── layout/
    └── AppShell.tsx               — DashboardLayout wiring + reset + cross-store subscription

packages/
├── cad-ui/                    — DashboardLayout, SelectableTransformControls, primitives
└── cad-core/                  — CSGEngine, exporters
```

⭐ = added or significantly reworked in the 2026-05 session

---

## Build / Verify Commands

```bash
npx tsc --noEmit       # typecheck — only gate today
npm run lint           # eslint
npm run dev            # vite dev server
npm run build          # tsc -b && vite build
```

The softjaws-verifier agent runs `tsc --noEmit` plus an invariant + anti-pattern grep — invoke after non-trivial changes.
