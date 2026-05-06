# RapidTool SoftJaws — Project Reference

> Last updated: 2026-04-28 | Branch: `main`
> Use this file as the resume point at the start of every new session.

---

## What This App Does

Browser-based CAD tool for designing **CNC soft-jaw inserts**.

**User flow:**
1. Import a 3D workpiece (STL)
2. Configure the CNC vise dimensions
3. Define the jaw blank stock (aluminium plate dimensions)
4. Generate pockets matching the part shape (CSG)
5. Add grip features (serrations, knurls)
6. Drill mounting bolt holes (CSG)
7. Export two STL files → send to CNC machine

**The physical output** is two aluminium plates with pockets cut into their inner faces. The operator bolts them onto the vise carriages, and the workpiece snaps in with precision.

---

## Vocabulary & Domain Terms

### Physical / CNC

| Term | Meaning |
|---|---|
| **Soft jaw** | Custom aluminium insert bolted onto a vise jaw; holds an irregular workpiece |
| **Jaw blank** | Raw uncut aluminium stock before any machining |
| **Jaw profile** | The blank after a workpiece-shaped pocket has been CSG-subtracted |
| **Jaw holed** | The profiled blank after mounting bolt holes have been drilled |
| **Vise** | The CNC machine workholding device — has two jaws that clamp the part |
| **L-bracket** | The fixed end-stop pillars bolted to each end of the vise rail |
| **Pillar** | Vertical leg of the L-bracket; the jaw blank's outer face abuts this |
| **Clamp gap** | Small clearance (default 0.01 mm) between the right jaw inner face and the part |
| **Counterbore** | Recessed large-diameter pocket that accepts a bolt head flush with the surface |
| **Through-hole** | Clearance bore for the bolt shank to pass through |
| **Tapped hole** | Threaded hole in the L-pillar that accepts the bolt thread |
| **SHCS** | Socket Head Cap Screw — hex-socket bolt used to mount the jaw blank |
| **T-slot** | Slot in the vise base that accepts T-nuts for mounting the vise to the machine table |

### Coordinate System (Three.js Y-up)

| Axis | Meaning | Jaw field |
|---|---|---|
| **X** | Clamping direction — jaws move along X | `jawBlank.thickness` |
| **Y** | Vertical — gravity, rail height | `jawBlank.height` |
| **Z** | Along the jaw face — jaw width | `jawBlank.face` |

> Never write `position={[face, height, thickness]}` — it silently breaks everything.

### Code / Architecture

| Term | Meaning |
|---|---|
| **geometry cache** | Module-level `Map<string, CachedGeometry>` — holds `Float32Array` geometry that cannot live in Zustand |
| **CSG** | Constructive Solid Geometry — boolean subtraction of one mesh from another |
| **three-bvh-csg** | The CSG library used (`Brush` + `Evaluator`); requires indexed geometry |
| **BVH** | Bounding Volume Hierarchy — acceleration structure for ray/intersection tests |
| **matrixWorld bake** | Applying a mesh's world transform into its geometry before passing to CSG so positions are in world-space |
| **world-space geometry** | Geometry whose vertex positions are absolute scene coordinates (no parent transform) |
| **xOffset coupling invariant** | The jaw X position formula must be identical in render (JawBlankMesh), CSG bake (useJawProfile), and camera fit (CameraController) |
| **presets.ts** | Single source of truth for all vise dimension math — never inline fractions elsewhere |
| **Zustand slice selector** | `useSoftJawsStore(s => s.field)` — always do this, never subscribe to whole store |
| **profileWorker** | Web Worker that runs three-bvh-csg to subtract the part from one blank |
| **holeCSGWorker** | Web Worker that subtracts the merged hole-tool geometry from a profiled blank |

### Geometry Cache Keys

| Key constant | Contents |
|---|---|
| `JAW_PROFILE_CACHE_KEY_LEFT` | Left blank with workpiece pocket (profile CSG result) |
| `JAW_PROFILE_CACHE_KEY_RIGHT` | Right blank with workpiece pocket |
| `JAW_HOLED_CACHE_KEY_LEFT` | Left blank with pocket + drilled mounting holes |
| `JAW_HOLED_CACHE_KEY_RIGHT` | Right blank with pocket + drilled mounting holes |
| `JAW_PROFILE_CACHE_KEY` | **Legacy** single-blank key — nothing writes here anymore, ignore |

### Key Helper Functions (`src/features/vise-config/data/presets.ts`)

| Function | Returns |
|---|---|
| `bracketInnerX(viseConfig)` | X position of pillar inner face — jaw outer face abuts here |
| `jawBaseH(jawHeight)` | Y of the rail surface where blanks and parts sit |
| `pillarFaceWidth(viseConfig)` | Pillar Z width — caps the practical jaw face dimension |
| `viseBodyLen(viseConfig)` | Total vise body length along X |
| `computeViseGeometry(viseConfig)` | Full derived dimension set for ViseModel rendering |

### xOffset Formula (the invariant)
```ts
const fixedXOff = bracketInnerX(viseConfig) - jawBlank.thickness / 2;
const rightXOff  = Math.min(fixedXOff, partHalfX + clampGap + thickness / 2);
```
Left jaw uses `fixedXOff` always. Right jaw uses `rightXOff` (capped so it never clips the pillar for large parts). **All three files must use this exact formula.**

---

## Workflow Step Status — Accurate as of 2026-04-28

| # | Step | Status | Notes |
|---|---|---|---|
| 1 | `vise-config` | ✅ Complete | Parametric — all geometry derives from jawWidth/jawHeight/jawStroke |
| 2 | `import` | ✅ Complete | STL parse → geometryCache + ProcessedPart in store |
| 3 | `jaw-blank` | ✅ Complete | Drives JawBlankMesh dimensions and material |
| 4 | `jaw-profile` | ✅ Complete | 2× parallel CSG workers → JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT} |
| 5 | `grip-features` | ⬜ Stub | UI writes to store; geometry pipeline not connected |
| 6 | `mounting-holes` | ✅ Complete | Positions, tool geometry, CSG drill, JawProfileMesh auto-upgrades |
| 7 | `export` | ❌ Broken | Reads legacy single-jaw key; exports one file instead of two |

---

## What's Built in the 3D Scene

| Component | File | What it renders |
|---|---|---|
| `ViseModel` | `3DScene/ViseModel.tsx` | 2-tier staircase body, L-brackets, chamfers, SHCS decals, tapped-hole decals |
| `JawBlankMesh` | `3DScene/JawBlankMesh.tsx` | Two dark steel blanks at ±xOffset with 4-layer SHCS counterbores + outer bore exits |
| `JawProfileMesh` | `3DScene/JawProfileMesh.tsx` | Profiled blanks from cache (replaces JawBlankMesh after profile CSG); upgrades to holed keys when available |
| `PartMeshes` | `3DScene/PartMeshes.tsx` | Imported workpiece meshes with PivotControls gizmo |
| `PillarBoltDecals` | `3DScene/PillarBoltDecals.tsx` | Exit-hole decals on pillar back faces after mounting holes are drilled |
| `CameraController` | `3DScene/CameraController.tsx` | Orthographic fit on load/import/dim change; view orientation snapping |

---

## Next Task: Fix Export (P0)

`src/features/export/hooks/useExport.ts` is broken. It references the legacy `JAW_PROFILE_CACHE_KEY` which nothing writes to anymore, and exports a single jaw instead of two separate STL files.

### What it needs to do

**Cache priority per jaw:**
```
JAW_HOLED_CACHE_KEY_{LEFT,RIGHT}   ← prefer if mountingHoles.generated
  ↓ fall back
JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT} ← if jawProfile.generated
  ↓ fall back
raw BoxGeometry                    ← jaw blank dimensions from store
```

**Output:** Two browser file downloads
- `softjaw-left.stl`
- `softjaw-right.stl`

**Geometry note:** All cached geometries are already in world-space (matrixWorld baked at CSG time). Build the `THREE.BufferGeometry` directly from the cache arrays with no position offset. For the raw blank fallback, position the blank at `(±xOffset, centerY, 0)` and bake matrixWorld before export.

### Files to change
- `src/features/export/hooks/useExport.ts` — rewrite the hook
- `src/features/export/components/ExportStepContent.tsx` — update UI if needed (show "Exporting left jaw…" progress)

### After export: P1 backlog
- Grip features geometry (serrations on pocket face) — currently store-only stub
- 3MF export support (currently returns "not implemented")
- Multi-part jaw generation (only `activePart ?? parts[0]` used)

---

## Architecture: Three-Layer Rule

```
src/                         ← app layer (vise, jaws, workflow)
  features/<step>/
    components/              ← step UI
    hooks/                   ← step logic
    data/                    ← domain helpers (no React)
    utils/                   ← geometry builders (no React)
  stores/                    ← Zustand (metadata only — no Float32Arrays)
  components/3DScene/        ← R3F scene components
  workflow/                  ← step definitions + gates

packages/cad-ui/             ← generic React UI (no jaw/vise knowledge)
packages/cad-core/           ← pure algorithms (no React, no DOM)
  workers/                   ← Web Workers for CSG + mesh ops
  csg/                       ← CSG engine (three-bvh-csg wrapper)
  parsers/                   ← STL parser
  export/                    ← meshToSTL, downloadFile
```

**Dependency direction is one-way:**
```
src/  →  cad-ui  →  cad-core
src/  →  cad-core
```
Never reverse. `cad-core` has no React. `cad-ui` has no jaw/vise knowledge.

---

## Commands

```bash
npm run dev        # start dev server (Vite)
npm run build      # tsc -b && vite build
npx tsc --noEmit   # typecheck only — run this before every commit
npm run lint       # eslint
```

---

## Known Tech Debt

| Issue | File | Priority |
|---|---|---|
| `useExport` uses legacy single-jaw key, exports one file | `features/export/hooks/useExport.ts` | **P0 — next task** |
| Grip features store-only, no geometry | `features/grip-features/` | P1 |
| 3MF export not implemented | `features/export/` | P2 |
| `JAW_PROFILE_CACHE_KEY` (no suffix) still exported from geometryCache — dead code | `stores/geometryCache.ts` | Cleanup |
| PROGRESS.md is stale (says mounting-holes is a stub) | `PROGRESS.md` | Update |
