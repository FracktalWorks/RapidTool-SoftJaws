# RapidTool-SoftJaws Setup Log

## Packages Pulled from RapidTool-Fixture (2024)

### @rapidtool/cad-ui
- **Source**: RapidTool-Fixture `packages/cad-ui/src/` — copied directly
- **48 files** total including 7 new files not previously in SoftJaws:
  - `transform/SelectableTransformControls.tsx` + index.ts
  - `primitives/PartThumbnail.tsx`, `PositionControl.tsx`, `RotationControl.tsx`
  - `viewport/ScalableGrid.tsx`, `SnapIndicator.tsx`, `NavigationHelp.tsx`
- TypeScript config: `strict: false` (matches Fixture)

### @rapidtool/cad-core
- **Source**: RapidTool-Fixture `packages/cad-core/src/` — copied directly
- Full modules: cad/, csg/, export/, mesh/, offset/, parsers/, snapping/, transform/, utils/, workers/
- TypeScript config: `strict: false`, `strictNullChecks: false` (matches Fixture)
- Fixed: `prepareGeometry(BVH_OPTIONS)` → `prepareGeometry()` for three-bvh-csg v0.0.17
- Fixed: Float32Array constructor in csgWorker.ts
- Fixed: Missing `successfulMeshCount`/`failedMeshCount` in manifoldMeshService.ts

### AppShell
- Rewritten to use `DashboardLayout` from cad-ui (same pattern as Fixture's AppShell)
- All layout logic now delegated to DashboardLayout component

### TypeScript Config
- Root tsconfig: `strict: false`, includes `["src", "packages"]`
- Matches Fixture's tsconfig.app.json approach
- Package tsconfigs exist for standalone checking

### Dependencies Added
- clsx, tailwind-merge (for cad-ui cn() utility)
- @react-three/fiber@^8.18.0, @react-three/drei@^9.122.0 (R3F)
- three@^0.166.1, @types/three@^0.180.0
- three-bvh-csg@^0.0.17, three-stdlib@^2.36.0, three-mesh-bvh@^0.9.4
- manifold-3d@^3.3.2 (WASM CSG engine)
- @types/node (dev)
