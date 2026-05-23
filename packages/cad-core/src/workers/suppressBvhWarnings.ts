const MAX_LEAF_TRIS_WARNING =
  'MeshBVH: "maxLeafTris" option has been deprecated. Use maxLeafSize, instead.';

/**
 * three-bvh-csg@0.0.17 still passes `maxLeafTris` internally when it builds
 * MeshBVH instances. Until that upstream package updates, filter only this
 * known warning inside worker contexts so real CSG errors remain visible.
 */
export function suppressDeprecatedMaxLeafTrisWarning(): void {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args[0] === MAX_LEAF_TRIS_WARNING) return;
    originalWarn(...args);
  };
}
