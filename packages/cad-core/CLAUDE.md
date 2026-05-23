# `packages/cad-core/` — Pure CAD algorithms

This package is **pure compute**. No React, no DOM, no framework, no domain knowledge. Everything here must be reusable by any RapidTool product (PCB, Fixture, SoftJaws, future apps) and by Node-side tooling that has no browser at all.

## Hard rules

- **No React imports.** No `react`, no `react-dom`, no `@react-three/fiber`, no `@react-three/drei`. `three` itself is fine (it's pure JS).
- **No DOM API calls** in module top-level code. (Inside worker `onmessage` handlers, accessing `self` is fine — that's a worker context, not a DOM.)
- **No domain terms.** No `jaw`, `vise`, `pillar`, `pocket`, `clamp`, `softJaw`. Anything with those names belongs in the consumer's `src/features/<step>/utils/`.
- **No app imports.** Never `from '@/...'` or `from '../src/...'`. The package is downstream of every consumer.

## What lives here

| Module | Role |
|---|---|
| STL parser | Binary + ASCII reader, returns `Float32Array` positions + normals + bbox |
| `CSGEngine` | Boolean operations (`createNegativeSpace`, `subtract`, etc.) wrapping `three-bvh-csg` |
| Worker manager | Pool / queue for off-main-thread CSG; consumers go through this rather than `new Worker(...)` ad-hoc |
| Mesh export | `meshToSTL(mesh, { binary })`, `downloadFile(data, name, mime)` |
| Coordinate helpers | CAD↔Three.js axis transforms, AABB utilities, etc. |

## Web-worker pattern

CSG workers run in worker context. They:
1. Accept `Float32Array`s + scalar params via `postMessage`.
2. Reconstruct `THREE.BufferGeometry` on the worker side (cannot transfer geometry objects directly).
3. Run the CSG operation.
4. Return result as `Float32Array`s using transferable buffers (`postMessage(result, [pos.buffer, nrm.buffer, idx.buffer])`).

Workers must **not** import anything from `cad-ui` or `src/`. They may import from `three` and from sibling files within `cad-core`.

## Result contract

Every CSG entry point returns either:
- A valid `THREE.BufferGeometry` (or `Float32Array` triple) with `position`, `normal`, and `index` set.
- An `Error` with a specific message (no silent zero-face results — callers cannot tell those from a successful no-op).

Indices are guaranteed: if the underlying CSG returns non-indexed geometry, `cad-core` synthesises a 0..N index array before returning.

## Performance

- CSG cost is roughly quadratic in mesh density. Callers should crop the cutter mesh to the local cut band before sending it in — this is the consumer's responsibility, not `cad-core`'s.
- STL parse > 50 MB blocks the main thread; consumers should run parse in a worker for large files (today they don't; that's a P4 in PROGRESS.md).

## Build artefacts

This package is consumed via workspace alias (`@rapidtool/cad-core`). It does not publish to npm and does not need a build step in dev — `tsc` resolves it directly from source. Production builds tree-shake at the consumer level.
