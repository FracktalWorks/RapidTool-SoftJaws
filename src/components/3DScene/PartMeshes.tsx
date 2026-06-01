/**
 * PartMeshes — Renders all imported parts from the geometry cache.
 *
 * Click a part → activate PivotControls gizmo (move + rotate).
 *
 * Position ownership strategy
 * ────────────────────────────
 * R3F's reconciler re-applies declarative `position`/`rotation` props on
 * every re-render. SelectableTransformControls also sets these imperatively
 * while the gizmo is active. If both run simultaneously the mesh flies off.
 *
 * Fix: no `position`/`rotation` props on <mesh>. Instead:
 *   • useLayoutEffect sets them imperatively from the store — but only when
 *     the gizmo is NOT active (gizmoActive === false).
 *   • handleSelectionChange(true)  → gizmoActive = true  → effect is skipped
 *   • handleTransformChange(data)  → bake to store, then gizmoActive = false
 *     → next effect run picks up the new store values cleanly.
 */

import { useEffect, useMemo, useRef, useCallback, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { SelectableTransformControls } from '@rapidtool/cad-ui';
import type { TransformData } from '@rapidtool/cad-ui';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { geometryCache } from '@/stores/geometryCache';
import { jawBaseH } from '@/features/vise-config/data/presets';
import { computeWorldSpanY, partSnapX, RAIL_GAP_MM } from '@/utils/partGeometry';
import type { ProcessedPart } from '@/stores/types';

const PART_COLORS = [
  '#4ade80',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
];

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// ─── PartMesh ────────────────────────────────────────────────────────────────

function PartMesh({
  part,
  color,
  isActive,
  viseJawHeight,
  onSelect,
}: {
  part: ProcessedPart;
  color: string;
  isActive: boolean;
  viseJawHeight: number;
  onSelect: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geomData = geometryCache.get(part.id);
  const updatePartTransform = useSoftJawsStore((s) => s.updatePartTransform);
  const jawProfile = useSoftJawsStore((s) => s.jawProfile);
  const jawBlank = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig = useViseStore((s) => s.viseConfig);

  const showWorkpiece = !(jawProfile.hideModel ?? false);


  // Track whether SelectableTransformControls currently owns the mesh transform.
  // While true, useLayoutEffect must NOT re-apply store values.
  const [gizmoActive, setGizmoActive] = useState(false);

  // Build a centered BufferGeometry — STL files can have arbitrary origins
  const geometry = useMemo(() => {
    if (!geomData) return null;

    const { min, max } = part.boundingBox;
    const cx = (min[0] + max[0]) / 2;
    const cy = (min[1] + max[1]) / 2;
    const cz = (min[2] + max[2]) / 2;

    const shifted = new Float32Array(geomData.positions.length);
    for (let i = 0; i < geomData.positions.length; i += 3) {
      shifted[i]     = geomData.positions[i]     - cx;
      shifted[i + 1] = geomData.positions[i + 1] - cy;
      shifted[i + 2] = geomData.positions[i + 2] - cz;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(shifted, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(geomData.normals.slice(), 3));
    return geo;
  }, [geomData, part.boundingBox]);

  // Free the GPU buffers when this PartMesh unmounts or the geometry is
  // replaced (e.g. user re-imports the same part id). Otherwise every
  // import + remove cycle leaks the part's vertex/normal buffers.
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  const { position: pos, rotation: rot } = part.transform;
  const partHeight = computeWorldSpanY(part);
  // Y where part bottom floats RAIL_GAP_MM above the jaw rail surface
  const baseY = jawBaseH(viseJawHeight) + RAIL_GAP_MM + partHeight / 2;

  // X position: left edge of the centered geometry must touch the fixed left jaw's clamping face.
  // The geometry useMemo above centers the mesh, so local X goes from -partWidth/2 to +partWidth/2.
  // We must use the WIDTH (delta), NOT bbox.min[0] which is the original file coordinate.
  //
  // RENDER snapX: Uses the effective (possibly shifted) overlap. This is what
  // the user sees in the 3D viewport.
  const renderSnapX = useMemo(() => {
    return partSnapX(viseConfig, jawBlank.left.thickness, part, jawProfile, jawBlank.clearance);
  }, [viseConfig, jawBlank.left.thickness, jawBlank.clearance, jawProfile, part]);

  // ── Imperatively sync mesh transform from store (only when gizmo is idle) ─
  useLayoutEffect(() => {
    if (!meshRef.current || gizmoActive) return;
    meshRef.current.position.set(renderSnapX, baseY + pos.y, pos.z);
    meshRef.current.rotation.set(
      rot.x * DEG2RAD,
      rot.y * DEG2RAD,
      rot.z * DEG2RAD,
    );
  }, [renderSnapX, pos.y, pos.z, rot.x, rot.y, rot.z, baseY, gizmoActive]);

  // ── Double-click: select part + show gizmo ───────────────────────────────
  // Must be double-click, NOT single click — single-click-drag is camera orbit
  // and must never activate the gizmo mid-pan.
  const handleDoubleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onSelect(part.id);
      window.dispatchEvent(
        new CustomEvent('mesh-double-click', { detail: { partId: part.id } }),
      );
    },
    [part.id, onSelect],
  );

  // ── Gizmo activated/deactivated → guard useLayoutEffect ─────────────────
  const handleSelectionChange = useCallback((active: boolean) => {
    if (active) {
      setGizmoActive(true);
    } else {
      // SelectableTransformControls.deactivateGizmo() uses a
      // requestAnimationFrame to bake the world position back onto the mesh
      // and reset the pivot to identity. We must wait for that to complete
      // before allowing useLayoutEffect to touch mesh.position again.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setGizmoActive(false);
        });
      });
    }
  }, []);

  // ── Gizmo drag-end / close → bake world-space back into store ─────────
  const handleTransformChange = useCallback(
    ({ position: worldPos, rotation: worldRot }: TransformData) => {
      const newRotDeg = {
        x: worldRot.x * RAD2DEG,
        y: worldRot.y * RAD2DEG,
        z: worldRot.z * RAD2DEG,
      };

      // Did the rotation actually change (vs a pure translate)?
      const rotationChanged =
        Math.abs(newRotDeg.x - rot.x) > 0.01 ||
        Math.abs(newRotDeg.y - rot.y) > 0.01 ||
        Math.abs(newRotDeg.z - rot.z) > 0.01;

      // ROTATION RE-SEATS ON THE RAIL.
      //
      // `baseY` is the auto-seat: jawBaseH + RAIL_GAP + computeWorldSpanY/2.
      // It depends on the part's ROTATED world height, so it already places
      // the rotated part's bottom on the rail. `pos.y` is the user's manual
      // vertical nudge ON TOP of that seat.
      //
      // The bug: baking `pos.y = worldPos.y − baseY` here uses the PRE-rotation
      // baseY (closure). After the rotation commits, baseY recomputes for the
      // new orientation and the part jumps by the half-height delta — floating
      // above the jaws when the part gets taller. So on a rotation change we
      // reset the nudge to 0 (sit flat on the rail). A pure translate keeps
      // the Y drag, measured against the current (unchanged) baseY.
      const newY = rotationChanged ? 0 : (worldPos.y - baseY);

      updatePartTransform(part.id, {
        position: {
          x: 0, // X is mathematically locked to the fixed jaw, ignore gizmo drag
          y: newY,
          z: worldPos.z,
        },
        rotation: newRotDeg,
      });
      // Do NOT set gizmoActive = false here!
      // This callback fires on every drag-end while the mesh is still a
      // child of PivotControls. Setting gizmoActive=false would let
      // useLayoutEffect apply world-space values in local space, doubling
      // the offset. gizmoActive lifecycle is managed by handleSelectionChange.
    },
    [part.id, updatePartTransform, baseY, rot.x, rot.y, rot.z],
  );

  if (!geometry) return null;

  return (
    <SelectableTransformControls
      meshRef={meshRef}
      enabled={isActive}
      partId={part.id}
      onSelectionChange={handleSelectionChange}
      onTransformChange={handleTransformChange}
    >
      {/*
       * No position/rotation props here — set imperatively via useLayoutEffect.
       * Passing declarative props would fight SelectableTransformControls when
       * a Zustand update triggers a re-render mid-drag.
       */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        onDoubleClick={handleDoubleClick}
        castShadow
        receiveShadow
        visible={showWorkpiece}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.15}
          side={THREE.DoubleSide}
          emissive={isActive ? color : '#000000'}
          emissiveIntensity={isActive ? 0.1 : 0}
        />
      </mesh>
    </SelectableTransformControls>
  );
}

// ─── PartMeshes ──────────────────────────────────────────────────────────────

export function PartMeshes() {
  const parts         = useSoftJawsStore((s) => s.parts);
  const activePart    = useSoftJawsStore((s) => s.activePart);
  const setActivePart = useSoftJawsStore((s) => s.setActivePart);
  const viseJawHeight = useViseStore((s) => s.viseConfig.jawHeight);

  if (parts.length === 0) return null;

  return (
    <>
      {parts.map((part, idx) => (
        <PartMesh
          key={part.id}
          part={part}
          color={PART_COLORS[idx % PART_COLORS.length]}
          isActive={activePart === part.id}
          viseJawHeight={viseJawHeight}
          onSelect={setActivePart}
        />
      ))}
    </>
  );
}
