/**
 * CavityPreview — Translucent ghost of the WORKPIECE at each cavity location.
 *
 * Earlier iterations:
 *   • v1 rendered the workpiece geometry twice (one ghost at each sweep end)
 *     but at the workpiece's own X position, which read as "three workpieces"
 *     in iso view.
 *   • v2 simplified to ONE translucent box per jaw clamped to the jaw extents.
 *     Worked, but a generic box doesn't show the user what SHAPE will be cut.
 *
 * This version restores the workpiece-shaped ghost, positioned correctly:
 *   • Left  ghost: workpiece geometry placed so its RIGHT-facing side touches
 *                  the LEFT jaw's inner face → shows the workpiece "embedded"
 *                  in the left jaw exactly where the cavity will be cut.
 *   • Right ghost: workpiece's LEFT-facing side touches the right jaw's inner
 *                  face → same idea on the other side.
 *
 * If the workpiece is deeper than the pocket (`partSpanX > jawProfile.depth`)
 * the ghost extends past the back of the jaw — that's a useful visual cue
 * that the cavity won't fully enclose the part.
 *
 * Render gate:
 *   • Hidden when `jawProfile.generated === true` (real cavity geometry takes
 *     over via JawProfileMesh).
 *   • Hidden when no active part — nothing to preview.
 *   • Hidden outside Step 4 — the indicator is only relevant while
 *     configuring the profile.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useWorkflowStore } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
} from '@/features/vise-config/data/presets';
import { computeWorldSpanX, rightJawCenterX } from '@/utils/partGeometry';

const PREVIEW_COLOR   = '#5cd0ff';
const PREVIEW_OPACITY = 0.35;

export function CavityPreview() {
  const activeStep       = useWorkflowStore((s) => s.activeStep);
  const profileGenerated = useSoftJawsStore((s) => s.jawProfile.generated);
  const pocketDepth      = useSoftJawsStore((s) => s.jawProfile.depth);
  const jawBlank         = useSoftJawsStore((s) => s.jawBlank);
  const clampGap         = useSoftJawsStore((s) => s.clampGap);
  const viseConfig       = useViseStore((s) => s.viseConfig);
  const activePart       = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  // Build a centered THREE.BufferGeometry from the part's cached arrays —
  // same recipe as PartMeshes so the ghost matches the rendered workpiece.
  const partGeo = useMemo(() => {
    if (!activePart) return null;
    const cached = geometryCache.get(activePart.id);
    if (!cached) return null;

    const { min, max } = activePart.boundingBox;
    const cx = (min[0] + max[0]) / 2;
    const cy = (min[1] + max[1]) / 2;
    const cz = (min[2] + max[2]) / 2;

    const shifted = new Float32Array(cached.positions.length);
    for (let i = 0; i < cached.positions.length; i += 3) {
      shifted[i]     = cached.positions[i]     - cx;
      shifted[i + 1] = cached.positions[i + 1] - cy;
      shifted[i + 2] = cached.positions[i + 2] - cz;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(shifted, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(cached.normals.slice(), 3));
    return geo;
  }, [activePart]);

  const layout = useMemo(() => {
    if (!activePart) return null;

    const baseH        = jawBaseH(viseConfig.jawHeight);
    const innerX       = bracketInnerX(viseConfig);

    // Same source-of-truth math as PartMeshes / JawBlankMesh / useJawProfile.
    const leftFaceX    = -innerX + jawBlank.thickness;          // left jaw inner face
    const rightCenter  = rightJawCenterX(viseConfig, jawBlank, activePart, clampGap);
    const rightFaceX   = rightCenter - jawBlank.thickness / 2;  // right jaw inner face

    const partSpanX    = computeWorldSpanX(activePart);
    const partHeight   = activePart.boundingBox.max[1] - activePart.boundingBox.min[1];

    // The pocket is `pocketDepth` mm deep, but a real workpiece is usually
    // MUCH wider than that (e.g. depth=10 mm, partSpanX=45 mm). If we placed
    // the ghost so its facing edge touched the jaw face, it would poke
    // through the back of the blank — exactly the misleading preview shown
    // in the top-view screenshot.
    //
    // Instead: position each ghost CENTERED in its cavity (X = jawFaceX ∓ depth/2)
    // and SCALE the X axis so the workpiece compresses to fit exactly the
    // pocket's X extent. YZ is left untouched, so the silhouette/profile that
    // will be cut is preserved. The user sees "this is the shape that lands
    // in this exact volume", which is what the cavity actually is.
    const xScale       = pocketDepth > 0 ? pocketDepth / partSpanX : 1;
    const leftGhostCx  = leftFaceX  - pocketDepth / 2;
    const rightGhostCx = rightFaceX + pocketDepth / 2;

    // Y/Z: same as PartMeshes — bottom of the part sits on the rail.
    const ghostY = baseH + partHeight / 2 + activePart.transform.position.y;
    const ghostZ = activePart.transform.position.z;

    return {
      leftGhostCx, rightGhostCx,
      ghostY, ghostZ,
      xScale,
      rotation: activePart.transform.rotation,
    };
  }, [activePart, jawBlank, viseConfig, clampGap, pocketDepth]);

  if (activeStep !== 'jaw-profile') return null;
  if (profileGenerated)             return null;
  if (!partGeo || !layout)          return null;

  const DEG2RAD = Math.PI / 180;
  const rot: [number, number, number] = [
    layout.rotation.x * DEG2RAD,
    layout.rotation.y * DEG2RAD,
    layout.rotation.z * DEG2RAD,
  ];

  return (
    <group>
      {/* Left jaw ghost — workpiece compressed to fit left cavity X extent */}
      <mesh
        geometry={partGeo}
        position={[layout.leftGhostCx, layout.ghostY, layout.ghostZ]}
        scale={[layout.xScale, 1, 1]}
        rotation={rot}
      >
        <meshStandardMaterial
          color={PREVIEW_COLOR}
          transparent
          opacity={PREVIEW_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Right jaw ghost — workpiece compressed to fit right cavity X extent */}
      <mesh
        geometry={partGeo}
        position={[layout.rightGhostCx, layout.ghostY, layout.ghostZ]}
        scale={[layout.xScale, 1, 1]}
        rotation={rot}
      >
        <meshStandardMaterial
          color={PREVIEW_COLOR}
          transparent
          opacity={PREVIEW_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
