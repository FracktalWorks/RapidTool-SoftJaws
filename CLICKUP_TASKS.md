# ClickUp Tasks — RapidTool SoftJaws

> Copy these into ClickUp. Suggested list structure: one List per workflow step + one "Infrastructure" list.
> Status labels: `Todo` / `In Progress` / `Done` / `Blocked`

---

## List: Infrastructure

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Three-layer architecture setup (src / cad-ui / cad-core) | P0 | Done | |
| Zustand + Immer store scaffolding | P0 | Done | `softJawsStore`, `types.ts` |
| Vite + React + TS + Tailwind project setup | P0 | Done | |
| DashboardLayout — left panel + viewport + right panel | P0 | Done | `packages/cad-ui` |
| Left panel scroll fix | P1 | Done | `panelContent` flex chain |
| Workflow step navigation (useWorkflow hook) | P0 | Done | nextStep, prevStep, completeStep |
| completeStep() wired into nextStep() | P1 | Done | progress tracking |
| Properties panel default collapsed | P2 | Done | |
| View orientation buttons (front/back/left/right/top/iso) | P1 | Done | window event `set-view-orientation` |
| Orthographic camera auto-fit on load | P1 | Done | per-axis fit, iso initial position |
| Camera isometric default fix (was upside-down) | P1 | Done | repositions camera before controls.update() |
| Move shadcn primitives from src/ to cad-ui | P3 | Todo | tech debt |
| Bundle size optimisation (1.2MB chunk) | P3 | Todo | code split / lazy load |
| cn() deduplication (src/lib/utils.ts vs cad-ui) | P3 | Todo | tech debt |

---

## List: Step 1 — Vise Configuration

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| ViseType enum — Spreitzer / Roemheld / Kurt / Schunk / Glacern | P0 | Done | `stores/types.ts` |
| 15 real vise presets with manufacturer specs | P0 | Done | `ViseConfigStepContent.tsx` |
| Grouped preset UI with manufacturer headers | P1 | Done | |
| selectPreset seeds jawBlank dims | P1 | Done | width, height, depth auto-populated |
| selectPreset passes tSlotWidth + tSlotSpacing | P1 | Done | bug fix |
| Default vise: spreitzer-mzc-125 | P1 | Done | store initial state |
| Custom vise input fields | P2 | Done | inline form when `type === 'custom'` |
| ViseModel — centering vise procedural mesh | P0 | Done | both jaws symmetric from X=0 |
| ViseModel — body slab + rail + bolt holes + lead screw | P1 | Done | |
| ViseModel — handwheel detail | P2 | Done | |

---

## List: Step 2 — Import Part

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| STL drag-and-drop file import | P0 | Done | |
| 3MF file import | P1 | Done | |
| CSG Web Worker setup (profileWorker.ts) | P0 | Done | |
| geometryCache — module-level Float32Array cache | P0 | Done | non-serializable, not in store |
| ProcessedPart bounding box extraction | P0 | Done | stored in parts[] |
| ParseResult.meta type fix (Omit<ProcessedPart, 'transform'>) | P1 | Done | TS fix |
| PartMeshes renderer — display imported part in viewport | P0 | Done | |
| Camera re-fit when new part added | P1 | Done | |

---

## List: Step 3 — Jaw Blank

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Jaw blank dimension inputs (width / height / depth) | P0 | Done | |
| Material selector | P1 | Done | aluminum-6061, steel, etc. |
| Auto-populate from vise preset | P1 | Done | called in selectPreset |
| **JawBlankRenderer — render blank box in 3D viewport** | P0 | Todo | solid translucent box, Y=0, centered |

---

## List: Step 4 — Jaw Profile (CSG)

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Clearance + pocket depth parameter inputs | P0 | Done | |
| Generate button + loading/error/success states | P0 | Done | |
| useJawProfile hook — CSG worker invocation | P0 | Done | |
| CSG boolean subtract (blank − part) | P0 | Done | runs in worker |
| **JawBlankRenderer — show profiled mesh after generate** | P0 | Todo | swap geometry on `jawProfile.generated === true` |
| Wire profiled geometry into Scene3D | P0 | Todo | alongside ViseModel + PartMeshes |
| Regenerate profile on parameter change | P2 | Todo | re-run CSG if clearance/depth edited |

---

## List: Step 5 — Grip Features

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Pattern selector UI (smooth/serrated/diamond/custom) | P1 | Done | stub |
| Depth + spacing inputs | P1 | Done | stub |
| Serration geometry generation | P1 | Todo | extrude grooves on jaw face |
| Diamond knurl geometry generation | P2 | Todo | |
| Apply grip features to jaw mesh | P1 | Todo | modify CSG result or add geometry |
| Grip features preview in viewport | P1 | Todo | |

---

## List: Step 6 — Mounting Holes

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Bolt size selector (M4–M16) | P1 | Done | stub |
| Spacing + count inputs | P1 | Done | stub |
| Standard / custom pattern toggle | P2 | Done | stub |
| Auto-suggest spacing from viseConfig.tSlotSpacing | P1 | Todo | |
| MountingHolesRenderer — bolt hole cylinders in viewport | P0 | Todo | visual only, Y-axis cylinders |
| Drill holes into jaw blank geometry (CSG) | P1 | Todo | subtract cylinders from blank mesh |

---

## List: Step 7 — Export

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Format selector (STL / 3MF) | P1 | Done | stub |
| Quality selector (low / medium / high) | P2 | Done | stub |
| **STL binary serializer** | P0 | Todo | serialize final mesh → ArrayBuffer |
| **Browser file download** | P0 | Todo | `URL.createObjectURL` + `<a>` click |
| 3MF export | P2 | Todo | stretch goal |
| Pre-export validation (check profile generated, holes set) | P1 | Todo | |

---

## Suggested Sprint Order

```
Sprint 1 (current):
  → JawBlankRenderer (jaw blank box in viewport)        [Step 3]
  → Wire profiled jaw mesh into viewport after CSG      [Step 4]

Sprint 2:
  → MountingHolesRenderer (visual bolt holes)           [Step 6]
  → Auto-suggest hole spacing from tSlotSpacing         [Step 6]

Sprint 3:
  → STL export + file download                          [Step 7]
  → Pre-export validation                               [Step 7]

Sprint 4:
  → Grip features geometry (serrations)                 [Step 5]
  → 3MF export                                         [Step 7]

Sprint 5 (polish):
  → Tech debt: cn() dedup, shadcn in cad-ui, bundle split
```
