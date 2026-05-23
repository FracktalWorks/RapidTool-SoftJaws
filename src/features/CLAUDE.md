# `src/features/` — Workflow step modules

Each subdirectory here is one of the seven workflow steps. The user's path through the app is a linear walk through them; the gates in `src/workflow/gates.ts` enforce ordering.

## The seven steps

| # | Dir | Role |
|---|---|---|
| 1 | `vise-config/` | Vise hardware (width, height, stroke). Drives ALL downstream geometry. |
| 2 | `import/` | STL parse (binary + ASCII). Bakes Z-up→Y-up rotation, populates `geometryCache` + `softJawsStore.parts`. |
| 3 | `jaw-blank/` | Soft-jaw stock dimensions (length / width / height). Independent of vise. |
| 4 | `jaw-profile/` | CSG pocket cut. Two parallel workers, results in `JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT}`. |
| 5 | `grip-features/` | **STUB** — UI exists, no geometry pipeline. |
| 6 | `mounting-holes/` | CSG drill — counterbore + through-hole, result in `JAW_HOLED_CACHE_KEY_{LEFT,RIGHT}`. |
| 7 | `export/` | Two STL downloads. Cache fallback: `JAW_HOLED → JAW_PROFILE → raw blank`. |

## Mandatory feature shape

```
src/features/<step>/
├── components/<Step>StepContent.tsx     ← imported by ContextOptionsPanel
├── hooks/use<Step>.ts                   ← status + generate() pattern
├── worker/                              ← only if CSG-heavy
├── utils/                               ← step-private helpers
├── data/                                ← step-private static data
└── types.ts                             ← step-local types
```

## Step-content component pattern

Each `<Step>StepContent.tsx` is the right-panel UI when that step is active. Reads from `softJawsStore` and/or `viseStore` via selectors. Wires hover events to `dimensionHover` if it has axis-bound parameters. Calls its hook's `generate()` on the primary button.

```tsx
export function <Step>StepContent() {
  const { status, error, generate } = use<Step>();
  const partCount        = useSoftJawsStore(s => s.parts.length);
  const profileGenerated = useSoftJawsStore(s => s.jawProfile.generated);

  const gate        = getStepGate('<step>', { partCount, profileGenerated });
  const canGenerate = gate.allowed && status !== 'running';

  return ( /* … */ );
}
```

## CSG hook pattern (Steps 4 and 6)

`use<Step>()` returns `{ status, error, generate }` where:
- `status: 'idle' | 'running' | 'success' | 'error'`
- `generate()` is `useCallback` that fires the worker(s) via `Promise.all`, sets `generated: true` on success, writes results to `geometryCache`.

Validate inputs at the top of `generate()` with specific error messages — five typical failure modes:
1. No active part
2. Part cache miss
3. Part not in store
4. Pocket depth out of bounds
5. CSG returned a degenerate result (face count below threshold)

After CSG returns, **always validate the face count**. The worker silently returns the unchanged blank when the part doesn't overlap it; treating that as success leaves `generated: true` on a fake profile. Threshold: `MIN_VALID_FACE_COUNT = 24` (a raw box has 12, a real cut adds many).

## Workflow registration

The step is registered in three files:
1. `src/workflow/steps.ts` — adds to the `SOFTJAWS_WORKFLOW_STEPS` array.
2. `src/workflow/stepConfig.ts` — labels, description, icon, skippable flag.
3. `src/workflow/gates.ts` — when the step becomes available (e.g. mounting-holes needs `profileGenerated`).
4. `src/components/ContextOptionsPanel/` — maps step id → step content component.

## Cache invalidation contract

Steps that produce cached geometry (4 and 6) must:
- Write `geometryCache.set(KEY, ...)` on success.
- Set `<feature>.generated = true` on the store.

The store actions (`addPart`, `setActivePart`, `updateJawBlank`, etc.) and the cross-store subscription in `AppShell.tsx` together invalidate `jawProfile.generated = false` whenever any CSG input changes — so downstream steps never read stale results.
