/**
 * useJawProfile — CSG pipeline hook for generating jaw profile cavities.
 *
 * The end product is TWO soft-jaw blanks (left and right) with workpiece-
 * shaped pockets cut into their inner X-faces. This hook:
 *   1. Validates inputs (active part, geometry cache, store consistency)
 *   2. Builds a positioned blank mesh on each side, using the SAME
 *      `rightJawCenterX` helper that JawBlankMesh renders with (no drift)
 *   3. Bakes each blank's world transform into its geometry
 *   4. Fires one CSG worker per side with the correct sweep direction
 *   5. Validates the result face count (catches silent no-overlap failures)
 *   6. Caches the results under JAW_PROFILE_CACHE_KEY_{LEFT,RIGHT}
 *
 * Removal directions:
 *   - Left  blank  → sweep toward -X  (removalDir = [-1, 0, 0])
 *   - Right blank  → sweep toward +X  (removalDir = [+1, 0, 0])
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_PROFILE_CACHE_KEY_LEFT,
  JAW_PROFILE_CACHE_KEY_RIGHT,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
} from '@/features/vise-config/data/presets';
import { computeWorldSpanX, rightJawCenterX, rightBracketInnerX } from '@/utils/partGeometry';

export type JawProfileStatus = 'idle' | 'running' | 'success' | 'error';

export interface UseJawProfileReturn {
  status:    JawProfileStatus;
  error:     string | null;
  /** Total face count of the two profiled blanks combined, after a successful
   *  run. null when not generated. Lets the UI confirm a substantive cut. */
  faceCount: number | null;
  generate:  () => void;
}

/** A raw blank box has 12 triangles. If CSG returns ≤ this many, the part
 *  did not intersect the blank and the "cut" was a no-op. We treat that as
 *  a validation failure so the user sees a clear error instead of an
 *  unchanged jaw rendered as a "profile". */
const MIN_VALID_FACE_COUNT = 24;

/** Upper bound on per-side face count. Runaway CSG output (millions of
 *  triangles from non-manifold input or degenerate intersections) uploads
 *  multi-megabyte buffers to the GPU and can trip a WebGL context loss.
 *  Bail before that happens with a clear error message. */
const MAX_VALID_FACE_COUNT = 150_000;

// ─── Helper: build a positioned blank mesh ────────────────────────────────────

/**
 * Blank axis mapping matches JawBlankMesh.tsx:
 *   X thickness = jawBlank.thickness  (stick-out from carriage)
 *   Y height    = jawBlank.height
 *   Z face      = jawBlank.face       (along the jaw face)
 */
function buildBlankMesh(
  thickness: number,
  height:    number,
  face:      number,
  xCenter:   number,
  yCenter:   number,
): THREE.Mesh {
  const geo  = new THREE.BoxGeometry(thickness, height, face);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.position.set(xCenter, yCenter, 0);
  mesh.updateMatrixWorld(true);
  return mesh;
}

// ─── Helper: fire a single worker and resolve when it posts back ─────────────

/** Hard timeout for a single CSG worker call. Generous (60 s) — a typical
 *  pocket cut on a 5–50 k-triangle part finishes in under 5 s on modest
 *  hardware. If we hit this ceiling something is wrong (BVH max-depth
 *  thrashing, runaway intersection, dead worker) and the user should see
 *  an error instead of an indefinite "Generating…" spinner that culminates
 *  in a WebGL context loss. */
const CSG_WORKER_TIMEOUT_MS = 300_000;

function runCsgWorker(
  payload: import('../worker/profileWorker').ProfileWorkerInput,
): Promise<import('../worker/profileWorker').ProfileWorkerOutput> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../worker/profileWorker.ts', import.meta.url),
      { type: 'module' },
    );
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error(
        `CSG worker timed out after ${CSG_WORKER_TIMEOUT_MS / 1000} s. ` +
        `The part may be too complex or have non-manifold geometry — try a ` +
        `simpler / decimated STL or check for self-intersections.`,
      ));
    }, CSG_WORKER_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<import('../worker/profileWorker').ProfileWorkerOutput>) => {
      clearTimeout(timeoutId);
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (err) => {
      clearTimeout(timeoutId);
      reject(new Error('Worker execution error: ' + err.message));
      worker.terminate();
    };
    worker.postMessage(payload);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJawProfile(): UseJawProfileReturn {
  const [status,    setStatus]    = useState<JawProfileStatus>('idle');
  const [error,     setError]     = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number | null>(null);

  const {
    parts,
    jawBlank,
    jawProfile,
    activePart,
    clampGap,
    updateJawProfile,
  } =
    useSoftJawsStore();
  const viseConfig = useViseStore((s) => s.viseConfig);

  const generate = useCallback(async () => {
    // Clear stale UI state immediately so the user sees the new run begin.
    setError(null);
    setFaceCount(null);
    setStatus('running');
    // ONLY clear the JAW_PROFILE cache.  Do NOT touch JAW_HOLED — the holed
    // blank is the BASE GEOMETRY this CSG cuts into, and it's populated by
    // AppShell's auto-drill.  Previously this hook deleted JAW_HOLED and
    // also called updateMountingHoles({ generated: false }), which:
    //   (a) forced getBaseGeo() to fall back to a raw blank box (no holes),
    //       so the CSG cut a profile into an UN-holed blank, and
    //   (b) triggered AppShell's auto-drill effect to re-run in parallel,
    //       eventually overwriting JAW_HOLED with a holed-but-un-profiled
    //       blank — which JawProfileMesh then preferred over JAW_PROFILE,
    //       making the carved profile invisible.
    geometryCache.delete(JAW_PROFILE_CACHE_KEY_LEFT);
    geometryCache.delete(JAW_PROFILE_CACHE_KEY_RIGHT);

    // ── Input validation — specific error per failure mode ────────────────
    const partId = activePart ?? parts[0]?.id ?? null;
    if (!partId) {
      setError('No active part. Import an STL in Step 2 before generating the profile.');
      setStatus('error');
      return;
    }

    const cachedGeo = geometryCache.get(partId);
    if (!cachedGeo) {
      setError('Part geometry missing from the cache. Try re-importing the file.');
      setStatus('error');
      return;
    }

    const part = parts.find((p) => p.id === partId);
    if (!part) {
      setError('Active part not found in store. Try re-importing the file.');
      setStatus('error');
      return;
    }

    if (jawProfile.depth <= 0) {
      setError('Pocket depth must be greater than 0.');
      setStatus('error');
      return;
    }

    const minThickness = Math.min(jawBlank.left.thickness, jawBlank.right.thickness);
    if (jawProfile.depth >= minThickness) {
      setError(`Pocket depth (${jawProfile.depth} mm) must be less than jaw thickness (${minThickness} mm).`);
      setStatus('error');
      return;
    }

    // ── Geometry layout ─────────────────────────────────────────────────────
    const baseH      = jawBaseH(viseConfig.jawHeight);
    const innerX     = bracketInnerX(viseConfig);

    // ── Jaw blank X positions — shared with JawBlankMesh via rightJawCenterX
    const leftXCenter  = -(innerX - jawBlank.left.thickness / 2);
    const rightXCenter = rightJawCenterX(viseConfig, jawBlank, part, jawProfile);
    
    const leftFaceXActual = -innerX + jawBlank.left.thickness;
    const rightInnerXActual = rightBracketInnerX(viseConfig, jawBlank, part, jawProfile);
    const rightFaceXActual = rightInnerXActual - jawBlank.right.thickness;
    
    const partSpanX    = computeWorldSpanX(part);
    
    // Default snapping point of the part at design-time
    const leftFaceXDefault = -innerX + 30.0;
    const snapX        = leftFaceXDefault - jawProfile.depth + partSpanX / 2;
    
    // Word coordinates of the part:
    const partCenterWorldX = snapX + part.transform.position.x;
    const partLeftEdgeX = partCenterWorldX - partSpanX / 2;
    const partRightEdgeX = partCenterWorldX + partSpanX / 2;

    // Calculate actual physical overlaps at design time
    const minBackWall = 5.0;
    const maxLeftDepth = Math.max(1.0, jawBlank.left.thickness - minBackWall);
    const maxRightDepth = Math.max(1.0, jawBlank.right.thickness - minBackWall);
    
    const leftOverlap = parseFloat(Math.max(1.0, Math.min(maxLeftDepth, leftFaceXActual - partLeftEdgeX)).toFixed(2));
    const rightOverlap = parseFloat(Math.max(1.0, Math.min(maxRightDepth, partRightEdgeX - rightFaceXActual)).toFixed(2));

    // ── Build left & right blanks ────────────────────────────────────────────
    const getBaseGeo = (cacheKey: string, xCenter: number, side: 'left' | 'right') => {
      const cached = geometryCache.get(cacheKey);
      const dims = jawBlank[side];
      const blankY = baseH + dims.height / 2;
      if (cached) {
        // Reconstruct the local-frame holed geometry from the cache.
        const local = new THREE.BufferGeometry();
        local.setAttribute('position', new THREE.BufferAttribute(cached.positions.slice(), 3));
        local.setAttribute('normal',   new THREE.BufferAttribute(cached.normals.slice(),   3));
        if (cached.indices) {
          local.setIndex(new THREE.BufferAttribute(cached.indices.slice(), 1));
        }
        // Translate from local to world coords for the CSG.
        local.translate(xCenter, blankY, 0);
        return local;
      }

      // Fallback: no drill yet — bake a raw blank box at world coords.
      const mesh = buildBlankMesh(
        dims.thickness,
        dims.height,
        dims.face,
        xCenter,
        blankY,
      );
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      return geo;
    };

    const leftGeo  = getBaseGeo(JAW_HOLED_CACHE_KEY_LEFT, leftXCenter, 'left');
    const rightGeo = getBaseGeo(JAW_HOLED_CACHE_KEY_RIGHT, rightXCenter, 'right');

    // The worker positions the part at `partHeight/2 + transform.y`, which
    // would land it with its bottom at world Y = 0. The scene's PartMeshes
    // sits the part on the RAIL (Y = jawBaseH). Without this correction the
    // CSG sweep and the blank only partially overlap on Y, producing
    // degenerate slivers + inverted normals (the "black artifact" mess).
    // Push the rail offset into transform.position.y so the worker lands
    // the part at the same world Y the scene shows.
    const partTransformForCsg = {
      position: {
        x: partCenterWorldX,
        y: baseH + part.transform.position.y,
        z: part.transform.position.z,
      },
      rotation: part.transform.rotation,
    };

    const makePayload = (
      geo: THREE.BufferGeometry,
      removalDir: [number, number, number],
      sideDepth: number,
    ): import('../worker/profileWorker').ProfileWorkerInput => ({
      id:              partId,
      blankPositions:  geo.getAttribute('position').array as Float32Array,
      blankNormals:    geo.getAttribute('normal').array   as Float32Array,
      blankIndices:    geo.index?.array as Uint32Array | undefined,
      partPositions:   cachedGeo.positions,
      partNormals:     cachedGeo.normals,
      partIndices:     cachedGeo.indices,
      partTransform:   partTransformForCsg,
      partBoundingBox: part.boundingBox,
      removalDir,
      depth:           sideDepth,
      offset:          jawProfile.clearance,
    });

    try {
      // Run both sides in parallel — each worker is independent.
      const [leftRes, rightRes] = await Promise.all([
        runCsgWorker(makePayload(leftGeo,  [-1, 0, 0], leftOverlap)),
        runCsgWorker(makePayload(rightGeo, [+1, 0, 0], rightOverlap)),
      ]);

      leftGeo.dispose();
      rightGeo.dispose();

      if (!leftRes.success || !leftRes.positions || !leftRes.normals) {
        throw new Error(leftRes.error || 'CSG worker returned no geometry for the left blank.');
      }
      if (!rightRes.success || !rightRes.positions || !rightRes.normals) {
        throw new Error(rightRes.error || 'CSG worker returned no geometry for the right blank.');
      }

      // ── Result validation ────────────────────────────────────────────────
      // A raw box has 12 triangles; a real pocket cut adds many more. If
      // either result has too few faces, the part didn't overlap the blank
      // and the "cut" was a no-op. Surface that as a clear error instead of
      // marking generated=true on an unchanged jaw.
      const leftFaceCount  = leftRes.indices  ? leftRes.indices.length  / 3 : leftRes.positions.length  / 9;
      const rightFaceCount = rightRes.indices ? rightRes.indices.length / 3 : rightRes.positions.length / 9;

      // Guard against runaway CSG output — uploads
      // multi-megabyte buffers to the GPU and can trip a WebGL context loss.
      // Usually indicates a non-manifold input or degenerate intersection.
      if (leftFaceCount > MAX_VALID_FACE_COUNT || rightFaceCount > MAX_VALID_FACE_COUNT) {
        throw new Error(
          `CSG produced ${Math.max(leftFaceCount, rightFaceCount).toLocaleString()} ` +
          `triangles on one side — far above the ${MAX_VALID_FACE_COUNT.toLocaleString()} ` +
          `safety limit. The part may have non-manifold geometry, or the clearance/depth ` +
          `combination is producing degenerate slivers. Try a simpler part or different params.`,
        );
      }

      // Allow one jaw to remain uncut (12 faces) if it has no overlap.
      // But at least one jaw must have a cut (face count > 12).
      const leftIsCut = leftFaceCount > 12;
      const rightIsCut = rightFaceCount > 12;
      if (!leftIsCut && !rightIsCut) {
        throw new Error(
          'CSG produced an empty cut — the part does not overlap either jaw blank clamping zone. ' +
          'Check that the part is positioned between the jaws and that pocket depth is > 0.',
        );
      }

      geometryCache.set(JAW_PROFILE_CACHE_KEY_LEFT, {
        positions: leftRes.positions,
        normals:   leftRes.normals,
        indices:   leftRes.indices,
        faceCount: leftFaceCount,
      });
      geometryCache.set(JAW_PROFILE_CACHE_KEY_RIGHT, {
        positions: rightRes.positions,
        normals:   rightRes.normals,
        indices:   rightRes.indices,
        faceCount: rightFaceCount,
      });

      updateJawProfile({
        leftDepth: leftOverlap,
        rightDepth: rightOverlap,
        generated: true
      });
      setFaceCount(leftFaceCount + rightFaceCount);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [
    parts,
    activePart,
    jawBlank,
    jawProfile,
    viseConfig,
    clampGap,
    updateJawProfile,
  ]);

  return { status, error, faceCount, generate };
}
