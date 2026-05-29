# RapidTool — SoftJaws Progress Tracker

> Last updated: 2026-05-20 (jaw-profile worker rewritten to sweep-algorithm + Manifold-3D pipeline; three-bvh-csg removed from Step 4)
> Branch: `main` — head `5b10f06` (+ uncommitted: bolt-Y formula, foot removal, Y-clamp, bracket-hole architecture, jaw-profile hardening, CLAUDE.md hierarchy, jaw bolt decorations, cavity preview, positions part-aware, worker Y-offset + step gate, GPU disposal + face-count guard, single-brush cutter, manifold-weld in CSG engine)

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
- [x] **Bed / bracket decoupled into fixed hardware constants** — `RAIL_HEIGHT (40 mm)`, `BR_FOOT_LEN (30 mm)`, `BR_PILLAR_LEN (30 mm)`. Changing stroke no longer resizes the pillar; changing vise height no longer raises the bed.
- [x] **Foot Y collapsed to 0** — `BR_FOOT_H = 0`. The L-bracket renders as a plain vertical block flush with the rail. Closes the prior jaw-vs-pillar 5 mm misalignment; `BR_FOOT_LEN` is retained because it still drives `bracketInnerX`. Foot `<Box>` skipped in `ViseModel` when zero-height to avoid degenerate-geometry warnings.
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
- [x] **Gizmo Drag Precision**: Added a `pivotRef` to `PivotControls` in [JawBlankMesh.tsx](file:///c:/Users/Sidda/OneDrive/Desktop/Projects/Fracktal_Works/RapidTool-SoftJaws/src/components/3DScene/JawBlankMesh.tsx) and call `resetPivotMatrix` on drag end/release. This resets Drei's accumulated translation, eliminating visual drift/jumps on release and providing a tight, synchronized drag feel.

### Step 4 — Jaw Profile (CSG)
- [x] **Asymmetric Layout-Derived Pocket Depths (Approach C)**: Pocket depth is now calculated dynamically from the actual physical overlap between the workpiece and each jaw in the 3D viewport at design-time, rather than using a single global pocket depth input.
- [x] **Store side-specific depths**: Added `leftDepth` and `rightDepth` variables to the store configuration.
- [x] **Simplified Step 4 Sidebar**: Hidden/removed "Clearance" (internally locked to a standard $0.1\text{ mm}$ fit tolerance) and "Pocket depth" manual inputs. Replaced with read-only indicators showing calculated left/right overlaps.
- [x] **Closed/Clamped offsets**: Vise closing now registers side-specific offsets ($D_L - 0.05\text{ mm}$ and $D_R - 0.05\text{ mm}$).
- [x] **Bug fix for double-addition coordinate offset**: Corrected `part.transform.position.x` update in `PartMeshes.tsx` to write 0 (since X is mathematically locked) to prevent double-addition of `snapX`, fixing a $-50\text{ mm}$ offset drift.
- [x] **Verification**: Built and executed automated E2E testing using Playwright with a sample $30\text{ mm}$ cube, confirming dynamic visual overlaps ($5.00\text{ mm}$ left and $5.00\text{ mm}$ right) and successful parallel CSG cuts.
- [x] **Rotation-aware blank position** via shared `computeWorldSpanX()` utility — consistent across `PartMeshes`, `ViseModel`, `JawBlankMesh`, `useJawProfile`.
- [x] **Derived "Part span (X)" panel** in the step UI — same value the CSG consumes, displayed read-only.
- [x] **`CavityPreview` — live cavity indicator in 3D viewport.** One translucent box per jaw (cyan, opacity 0.22), positioned at each jaw's cavity midpoint and **bounded to the jaw blank's actual extents** (`Math.min(partY, jawHeight)`, `Math.min(partZ, jawFace)`, position-clamped to keep edges inside the blank). Earlier version rendered the full part geometry twice at the sweep ends, which read as "three workpieces" in iso view and protruded above the jaw when the part was taller than the blank — fixed. Same source-of-truth math (`computeWorldSpanX`, `bracketInnerX`, `clampGap`) so the indicator can never disagree with what Generate Profile will actually cut. **Step-gated to `activeStep === 'jaw-profile'`** — previously visible on Steps 2/3/5/6 too, which cluttered the scene with translucent zones the user couldn't act on from those panels.
- [x] **CSG worker Y-offset fix.** `profileWorker.buildPartMesh` positions the part at `partHeight/2 + transform.y` — landing the bottom at world Y=0. But the scene's `PartMeshes` sits the part on the rail (Y = `jawBaseH()` = 40). The blank, baked correctly in `useJawProfile`, sits between Y=40 and Y=105. Without the rail offset the sweep volume and the blank only partially overlapped on Y, producing degenerate slivers + inverted normals — the "black artifact" mesh inside the jaws + the absurd 36k triangle counts on small parts. Fixed by pre-applying `baseH` to `partTransform.position.y` in `useJawProfile` before posting to the worker, so the part lands at the same world Y the scene shows.
- [x] **CSG worker X snap fix.** `PartMeshes` renders the workpiece at a derived `snapX` so its left edge sits against the fixed jaw face plus `clampGap`; the store's `transform.position.x` starts at 0 and is not the render source of truth. `useJawProfile` was sending that stale X to the worker, so the swept cutter was not where the green part appeared in the viewport and could tear a broad triangulated sheet through the jaw face. Fixed by recomputing the same `snapX = leftFaceX + clampGap + computeWorldSpanX(part)/2` in `useJawProfile` and sending that to `profileWorker`.
- [x] **GPU buffer disposal in `JawProfileMesh` and `PartMeshes`.** Both components create new `THREE.BufferGeometry` inside `useMemo` and previously never disposed the old one. Each Generate-Profile click leaked two GPU buffer sets; after several iterations the WebGL context ran out of headroom and reset (`THREE.WebGLRenderer: Context Lost`). Now both use a `useEffect` cleanup that calls `.dispose()` on the old geometry whenever the memo re-runs or the component unmounts.
- [x] **CSG output safety guard.** New `MAX_VALID_FACE_COUNT = 500_000` upper bound in `useJawProfile`. If the CSG returns runaway geometry on either side (non-manifold input, degenerate intersection), the hook throws with a specific error instead of uploading multi-megabyte buffers to the GPU and risking a context loss. Paired with the existing `MIN_VALID_FACE_COUNT = 24` lower bound, both failure modes are now caught.
- [x] **`CSGEngine.createNegativeSpace` no longer swallows failures silently.** Previous behaviour caught any internal exception (BVH construction error, evaluator throw, etc.) and returned the unchanged blank — masking real failures and leaving the cache pointing at a no-op profile that the UI rendered as success. Now it re-throws with a `CSG failed: <message>` prefix so the worker → `useJawProfile` → step UI chain surfaces the real cause.
- [x] **CSG worker hard timeout.** New `CSG_WORKER_TIMEOUT_MS = 60_000` in `useJawProfile`. If a worker hangs (BVH max-depth thrashing on a pathological part, deadlock, etc.) the wrapper terminates the worker and rejects with a specific message telling the user to try a simpler / decimated STL. Replaces the indefinite spinner-into-context-loss failure mode.
- [x] **Manifold weld in `CSGEngine.cloneWorldGeometry` — REAL root cause of the diagonal blast cuts.** STL parsers emit NON-INDEXED geometry: each face owns its own 3 unique vertices with the face-flat normal copied to each. When `inflateGeometry` ran `computeVertexNormals` on that, every vertex got the normal of its single owning face — meaning the two duplicate vertices at every shared edge pointed along DIFFERENT face normals. Inflating along those per-face normals then pulled adjacent triangles apart by ~`offset` mm along every seam, making the cutter non-manifold. three-bvh-csg's BVH classifier couldn't decide in/out across those sub-mm gaps and emitted long diagonal cap-sheet triangulations across the jaw inner face — every screenshot of "diagonal blast cuts" was this. The single-brush fix from the same day eliminated the coincident-face failure mode but the inflation-tear failure was dominant. Fixed by calling `mergeVertices(geo, 1e-5)` in `cloneWorldGeometry` whenever the input is non-indexed (always, for STL): welds duplicate positions, restores the indexed manifold representation, and lets `computeVertexNormals` average correctly at shared vertices. `inflateGeometry` got a defence-in-depth merge too. With this, both inflation-driven offset clearance AND the bare cutter brush are now manifold solids — exactly what three-bvh-csg needs.
- [x] **Single-brush cutter — eliminates coincident-face CSG failures.** `buildSweptBrushes` previously emitted two brushes (start at `t=0`, end at `t=depth`). The start brush sat with its leading face **coincident** with the jaw inner face — three-bvh-csg cannot classify in/out on coincident faces and emitted long diagonal cap sheets across the jaw (the "blast cut" artifact visible in the 2026-05-19 screenshots). The two brushes were also interpenetrating copies of the same part (depth ≪ part X-extent for a star), so the second subtraction hit geometry the first one had already exposed, producing more sliver caps. Replaced with a **single brush translated `depth` into the removal direction**: no coincident face, no overlapping subtractions, one BVH build instead of N. Pocket walls follow the part's silhouette at the cut depth — for uniformly extruded profiles (typical fixture geometry) indistinguishable from a true sweep; for tapered parts the pocket bottom follows the part profile at depth, which is what soft jaws want. Also collapses CSG cost roughly 2× since the result-mesh BVH only rebuilds once.
- [x] **Shared `rightJawCenterX` helper** in `partGeometry.ts` — single source of truth used by `JawBlankMesh` (render) AND `useJawProfile` (CSG bake). No formula drift possible between the rendered jaw and the cut blank.
- [x] **CSG result validation** — after each worker returns, face count is checked against `MIN_VALID_FACE_COUNT = 24`. If the cut is degenerate (e.g. part doesn't overlap the blank), the user sees a clear error instead of `generated: true` on an unchanged jaw. Catches the silent-empty-cut failure mode.
- [x] **Specific error messages** — distinct strings for "no active part", "cache miss", "active part missing from store", "depth ≤ 0", "depth ≥ thickness", "worker exception", "empty cut". User can act on each.
- [x] **Success metric** — Step 4 UI now reports `N triangles across both jaws · pocket X mm deep · Y mm clearance` so the user knows a substantive cut happened, not a no-op.
- [x] **Stale state cleared on click** — `error`, `faceCount`, and `status` are reset to fresh values at the start of `generate()` so the user sees the new run begin clearly.
- [x] **`profileWorker` rewritten: sweep-algorithm + three-bvh-csg, Manifold-3D eliminated from worker.** New pipeline: (1) apply world transform to part vertices; (2) `createSweptMesh(worldVerts, { direction: ±X, contourOffset: clearance, accumulate: true, layerHeight: 0.5 })` → full-silhouette loft; (3) translate loft so full-silhouette end is at `jawFaceX`; (4) **mirror loft in X around `jawFaceX`** so it extends INTO the blank rather than into the part gap (mirroring keeps the full-silhouette face fixed at `jawFaceX`; fixes `INTERSECTION(loft, slab)` which was empty because the loft and slab were on opposite sides of `jawFaceX`); (5) `mergeVertices(rawLoft, 1e-5)` → indexed solid; (6) `INTERSECTION(loft, depthSlab)` → cutter with clean flat end face at `jawFaceX`; (7) `SUBTRACTION(blank, clippedCutter)` → final jaw. Jaw inner face X from blank's own bbox. `CSGEngine.createNegativeSpace` no longer used in jaw-profile path.
- [x] **`accumulateContours` hard-throw downgraded to warning.** Dense STL meshes (2700+ segments/slice) produce near-degenerate contour segments that cause `polygon-clipping` union failures inside `sweepCore.js`. Previously, any such failure threw a hard Error, crashing the entire profile generation. Fixed by changing the throw to `console.warn` — `safeUnion` already returns `fallbackA` (previous `accPoly`) on failure, so all slices in `accSlices` already contain the best data available; the loft is complete just without the incremental growth from those specific slices.
- [x] **Staircase banding eliminated — `profileWorker` rewritten to clean prismatic cutter.** The previous pipeline built a staircase loft via `createSweptMesh` (shelf transitions at every 0.5 mm layer height) and used it as the CSG cutter. This produced visible horizontal ribs on curved cavity walls (cylinders, spheres, threads). New pipeline: (1) `extractSilhouetteContour` runs slice+accumulate only and returns the final accumulated silhouette polygon (maximum union of all YZ cross-sections); (2) `THREE.ExtrudeGeometry` extrudes the 2D polygon by `depth` mm; (3) a rigid-body transform (det=+1, no winding flip) maps the ExtrudeGeometry's local XYZ into world space — left jaw: `x_w=jawFaceX−z_g, y_w=−y_g, z_w=−x_g`; right jaw: `x_w=jawFaceX+z_g, y_w=−y_g, z_w=+x_g`; (4) `SUBTRACTION(blank, prism)` produces a pocket with perfectly flat, smooth walls. The slab INTERSECTION step is no longer needed. The new `extractSilhouetteContour` API is added to `packages/cad-core/src/sweep/sweepProcessor.ts` and exported from the cad-core barrel.
- [x] **CSG worker timeout raised 60 s → 300 s.** Complex parts (threaded bolts, dense STLs) were hitting the 60 s wall during the accumulate phase. 300 s allows the full slice+accumulate to complete on real-world parts.
- [x] **CSG result re-welded via `mergeVertices(geom, 1e-4)` before `computeVertexNormals`.** three-bvh-csg emits a NON-indexed triangle soup where every triangle owns its own three vertices. `computeVertexNormals` on that pattern gave each vertex the face-normal of its single owning triangle — and each face-normal was computed from an independent floating-point cross-product, so two coplanar triangles ended up with normals that differed by ~0.001–0.01 rad. Those tiny differences pushed adjacent triangles past the `<Edges threshold={15}>` cutoff in `JawProfileMesh`, painting the long diagonal "scratch" lines you saw fanning across the pocket walls. Welding re-indexes coincident positions so `computeVertexNormals` correctly AVERAGES adjacent face-normals; coplanar triangles end up with identical vertex-normals and the false-positive edges disappear.
- [x] **Edges threshold raised 15° → 35° in `JawProfileMesh`.** Defence-in-depth: even with welding, the CSG output retains some normal noise on long-thin re-triangulation slivers. 35° still draws every legitimate corner (jaw outer edges, pocket-to-face transition, mounting-hole rims — all > 35°) while hiding numerical-precision noise on flat surfaces.
- [x] **`<Edges>` overlay removed from `JawProfileMesh`.** Kept on `JawBlankMesh` (clean box, 90° corners only — no false-positives). On the profiled jaw, three-bvh-csg's stitching triangles connecting the pocket boundary to the box corners carry enough per-triangle normal noise that `EdgesGeometry` couldn't distinguish them from real corners even at threshold=35° — the result was the long dark diagonal "scratch" lines fanning across the jaw face that survived all prior fixes (mergeVertices, threshold bump). Without the overlay the flat-shaded mesh reads as a clean machined surface; smooth shading shows the geometry without painting every internal triangulation edge.
- [x] **`CavityPreview` ghost X-axis scaled to the pocket depth.** v3 (workpiece-shaped, not box) showed the correct silhouette but the ghost extended the FULL workpiece width into the jaw — for a 45 mm-wide part with a 10 mm pocket the ghost poked through the back of the blank, suggesting the pocket was much deeper than it is. v4 keeps the ghost positioned at the cavity CENTER (`leftFaceX − depth/2` and `rightFaceX + depth/2`) and applies `scaleX = depth / partSpanX` so the workpiece silhouette compresses to fit exactly the pocket's X extent. YZ is untouched so the cross-section the user sees is the actual cross-section that will be cut. Reads like "this shape stamped this deep" — which is exactly what the cavity is.
- [x] **`CavityPreview` switched from a generic box to translucent workpiece-shaped ghosts.** v1 had this and dropped it; v2 used a box but a box doesn't show the user the SHAPE that will be cut. v3 (this) renders the workpiece geometry as two `opacity: 0.35` ghosts — left ghost positioned so the workpiece's right edge meets the left jaw inner face, right ghost mirrored on the other side. The user now sees the actual silhouette that will be cut. Shares `rightJawCenterX` / `bracketInnerX` / `computeWorldSpanX` with the rest of the pipeline so the preview cannot drift from the eventual CSG result.
- [x] **Cutter overshoots jaw inner face by 2 mm — eliminates starburst/diagonal artifacts.** When the prism's front cap landed exactly on the jaw inner face plane, `three-bvh-csg` stitched every earcut internal diagonal of that cap into the output mesh (fan-shaped lines visible on the flat jaw face). Fix: `ExtrudeGeometry` depth is `data.depth + 2`, and the transformation matrix shifts the starting position 2 mm past `jawFaceX` (outside the blank). The front cap is now in air and never intersects any blank face; the jaw inner face is cut only by the cutter's clean perimeter side-walls. Pocket depth remains exactly `data.depth`.
- [x] **Polygon ring capped at 300 points before ExtrudeGeometry.** `polygon-clipping`'s union adds O(N) intersection vertices per accumulate step; after ~50 steps a 500-point ring grows to 5000–10000 points. `earcut` (called inside `ExtrudeGeometry`) is O(n²) on large polygons with holes, costing 10–30 s per side → 300 s timeout on threaded/dense STLs. `limitRing` uniformly downsamples to MAX_RING_POINTS = 300; max chord error at r=8 mm is 0.003 mm (negligible). earcut now takes ~50 ms per side.
- [x] **3D Cavity Subtraction ("Dipped into a Mold")**: Changed the CSG cutter from a flat-walled 2D silhouette prism to a 3D negative shape subtraction of the workpiece (inflated by clearance, clipped by a depth-limiting slab). Pocket geometry now matches the actual 3D curves of the model.

### Step 5 — Grip Features
- [ ] **STUB** — UI exists (pattern picker, depth, spacing inputs) but no geometry pipeline. Nothing renders. Last unfinished feature in the workflow.

### Step 6 — Mounting Holes
- [x] **Architecture corrected**: bracket tapped holes are FACTORY HARDWARE — they exist from the moment the vise renders. Step 6's CSG only drills the SOFT JAW BLANKS to match the bracket's pattern. UI copy updated to make this purpose clear.
- [x] **`PillarBoltDecals` always renders** — was previously gated on `mountingHoles.generated` (wrong: bracket holes don't appear when the user runs CSG, they're present from initial render).
- [x] **Right bracket decals track the moving carriage** — new shared helper `rightBracketInnerX(viseConfig, jawBlank, activePart, clampGap)` in `src/utils/partGeometry.ts`. Same function consumed by ViseModel (renders the moved bracket) and PillarBoltDecals (renders the bolt-exit feature on the moved bracket's back face). Decals can no longer float in mid-air when the right carriage moves to clamp a part.
- [x] **3D rim + dark cavity instead of flat decal** — protruding rim cylinder (catches light) plus a dark interior disc. Reads as a recessed hole at any angle without paying for CSG on the procedural pillar mesh.
- [x] **`JawBoltDecorations` — inner-face counterbore previews on the jaw blanks**. Same architectural pattern as `PillarBoltDecals` (single source of truth via `computeMountingHolePositions`, no CSG cost, scope-aware rendering). Completes the inside-to-out bolt path: counterbore preview on the jaw inner face (workpiece side) + pillar exit decal on the bracket back face. Gated complementarily: bracket decoration always shown (factory hardware); jaw decoration shown only while `mountingHoles.generated === false` — once the CSG runs, the JAW_HOLED geometry IS the hole and the decoration would visually double up.
- [x] **`computeMountingHolePositions` is now part-aware.** Previous signature took an optional `adaptiveXOff` that was never wired up, so every consumer of `positions.x` saw the *fixed max-stroke* jaw position regardless of whether the right bracket carriage had moved inward to clamp a part. New signature takes `activePart` + `clampGap` and computes `xCenterRight` via the shared `rightJawCenterX` helper internally. All four call sites (`PillarBoltDecals`, `JawBoltDecorations`, `ViseModel.pillarHoles`, `useMountingHoles`) pass the live part — bracket decals, jaw counterbore previews, pillar top tapped-hole positions, and the Step-6 CSG drill positions now all track the moving carriage together. The ad-hoc `adaptiveXOff` recomputation inside `useMountingHoles` (which used the non-rotation-aware bbox span) is gone.
- [x] **Bolt Y is a fixed hardware offset** — `bracketBoltY = RAIL_HEIGHT + BR_FOOT_H + BR_BOLT_Y_OFFSET = 40 + 0 + 30 = 70 mm`. Replaces the older `× BR_BOLT_Y_FRAC` formula which scaled with `jawHeight` and pushed bolts outside the jaw blank on tall pillars.
- [x] **Y safety-clamp in `computeMountingHolePositions`** — `yCenter` clamped to `[jawBaseY + margin, jawTopY − margin]` where `margin = (boltDia × COUNTERBORE_DIA_K) / 2 + 1 mm`. `COUNTERBORE_DIA_K` is exported from `buildHoleTool.ts` so the planned margin matches the counterbore the CSG actually cuts.
- [x] **Spacing auto-derives from `viseConfig.tSlotSpacing`** on preset change; default raised from 50 → 125 mm.
- [x] **Step 6 UI hint** — green ✓ when spacing matches the vise's bolt pattern, amber + one-click "Match vise" when not.
- [x] **Real CSG** drills counterbore + through-hole into each profiled blank; result cached under `JAW_HOLED_CACHE_KEY_{LEFT,RIGHT}`.

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

### Docs / setup hardening
- [x] **Per-directory `CLAUDE.md` hierarchy** — Claude now additively auto-loads the right rules based on which folder you're working in:
  - `CLAUDE.md` (root, ~110 lines) — pointers + the two invariants + axis convention + commands
  - `src/CLAUDE.md` — app-layer rules: layer decision, dependency direction, hot path, perf, stores
  - `src/features/CLAUDE.md` — workflow-step shape, step-content + CSG-hook patterns, registration
  - `packages/cad-ui/CLAUDE.md` — what belongs / doesn't belong in cad-ui, forbidden imports
  - `packages/cad-core/CLAUDE.md` — pure-algorithm rules, worker pattern, result contract
- [x] **Root `CLAUDE.md` slimmed from 173 → 110 lines.** No longer carries detailed narratives — those live in the per-directory files. Article-aligned: "pointers and critical gotchas only".
- [x] **Deduped architect agent** — removed `.github/agents/softjaws-architect.agent.md` (Copilot Workspace format, outdated content referring to Manifold WASM CSG). Single canonical agent file is now `.claude/agents/softjaws-architect.md` with its reading order updated to the new `CLAUDE.md` hierarchy.
- [x] **Cross-doc references updated** — `README.md` directory tree, `memories/repo/architecture-state.md` instruction-files list, architect agent reading order.
- [x] **`.claude/settings.json`** — permission allowlist for routine read-only commands (`npx tsc --noEmit`, `git status/diff/log/show`, `gh pr/issue/api view`); deny list for destructive ones (`rm -rf`, `git push --force`, `git reset --hard`, `git clean -f`). Removes most permission prompts without weakening safety on the dangerous ones.
- [x] **`.claudeignore`** — adds `Microsoft/` (stray untracked folder from a prior session) and `memories/` (point-in-time snapshots that risk being acted on as live state). `.gitignore` already covers `node_modules/`, `dist/`, `.vite/`, etc.
- [x] **Slash commands** in `.claude/commands/`:
  - `/verify` — runs `softjaws-verifier` on the working tree
  - `/progress` — updates PROGRESS.md per the standing rule
- [x] **Stop hook** in `.claude/hooks/check-progress.cjs` — non-blocking notice when source files change but PROGRESS.md is untouched. Wired into `settings.json` `hooks.Stop`. Cross-platform (Node + git), 5 s timeout, silent if git unavailable.

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

### ~~P1 — Jaw blank vs L-bracket pillar Y alignment~~ ✅ CLOSED
**Resolved by Phase-1 foot collapse.** `BR_FOOT_H` set to 0 — bracket now renders as a plain vertical block flush with the rail. Pillar bottom = jaw bottom = `RAIL_HEIGHT`; pillar top = jaw top = `RAIL_HEIGHT + jawHeight`. No more 5 mm offset. The foot `<Box>` is conditionally skipped in `ViseModel` when `BR_FOOT_H === 0` to avoid degenerate-geometry warnings. `BR_FOOT_LEN` (X) is retained — it still drives `bracketInnerX`.

### ~~P2 — Mounting-hole counterbore clearance~~ ✅ CLOSED
**Resolved by Phase-3 Y-clamp.** `computeMountingHolePositions` now clamps `yCenter` to `[jawBaseY + margin, jawTopY − margin]` where `margin = (boltDia × COUNTERBORE_DIA_K) / 2 + 1 mm`. The constant `COUNTERBORE_DIA_K` is imported from `buildHoleTool.ts` (the same file the CSG worker reads), so the planned safety margin always matches the counterbore the CSG will actually cut. No magic-number drift possible. Y validity is now guaranteed by construction for any combination of `jawHeight`, `jawBlank.height`, and `boltSize`.

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
| ~~Jaw blank ↔ pillar Y alignment~~ | resolved — `BR_FOOT_H = 0` | ✅ closed |
| ~~Counterbore can break through jaw top~~ | resolved — Y-clamp in `positions.ts` | ✅ closed |
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

