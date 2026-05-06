/**
 * JawBlankMesh — Renders the TWO soft-jaw blanks bolted to the L-bracket
 * fixed end-stops on the vise.
 *
 * Each blank's outer face abuts the inner face of its corresponding L-bracket
 * pillar (positions match across ViseModel.tsx via shared helpers in
 * presets.ts: bracketInnerX, pillarFaceWidth). 2× horizontal countersunk
 * SHCS are inserted from the INNER face (workpiece side), pass through the
 * jaw, and thread out through the L-pillar — the bolt head reads on the
 * inner face, the exit decal sits on the back of the pillar (PillarBoltDecals).
 *
 * Axis mapping:
 *   jawBlank.thickness → X (clamping direction)
 *   jawBlank.height    → Y vertical
 *   jawBlank.face      → Z (along the jaw face) — visually capped at the
 *                        pillar Z width so the jaw never overhangs the
 *                        platform.
 *
 * Vertical "LEFT" / "RIGHT" labels on BOTH ±Z faces of each jaw, so the
 * orientation reads from any front/back orbit angle (the inner X-face label
 * was hidden inside the gap between jaws and only visible looking down it).
 */

import { useMemo, useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { Edges, Text, Cone, Cylinder } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import { useWorkflowStore } from '@rapidtool/cad-ui';
import {
  jawBaseH,
  bracketInnerX,
  pillarFaceWidth,
} from '@/features/vise-config/data/presets';
import { computeMountingHolePositions } from '@/features/mounting-holes/data/positions';

// ─── Interactive Drag Handle ─────────────────────────────────────────────────
// A 3D arrow (cylinder + cone) that the user can drag along a single axis.
// Uses native R3F pointer events + setPointerCapture for reliable tracking.

type Axis = 'x' | 'y' | 'z';

interface DragHandleProps {
  /** World position of the handle base */
  position: [number, number, number];
  /** Which world axis dragging moves along */
  axis: Axis;
  /** Direction multiplier — +1 or -1 (e.g. right jaw thickness grows toward -X) */
  direction: number;
  /** Current dimension value (mm) */
  value: number;
  /** Min / max clamp for the dimension */
  range: [number, number];
  /** Called with the new dimension value while dragging */
  onChange: (newValue: number) => void;
  /** Handle color (idle) */
  color?: string;
  /** Handle length scale */
  length?: number;
}

const HANDLE_HOVER_COLOR = '#ffdd44';

function DragHandle({
  position,
  axis,
  direction,
  value,
  range,
  onChange,
  color = '#00bbff',
  length = 8,
}: DragHandleProps) {
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerWorld: number; startValue: number } | null>(null);

  // Build axis vector
  const axisVec = useMemo(() => {
    const v = new THREE.Vector3();
    v[axis] = direction;
    return v;
  }, [axis, direction]);

  // Rotation to point the arrow along the drag axis
  const rotation = useMemo((): [number, number, number] => {
    if (axis === 'y') return direction > 0 ? [0, 0, 0] : [Math.PI, 0, 0];
    if (axis === 'x') return direction > 0 ? [0, 0, -Math.PI / 2] : [0, 0, Math.PI / 2];
    return direction > 0 ? [Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, 0];
  }, [axis, direction]);

  // Project pointer position onto the drag axis in world space
  const projectPointerOnAxis = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);

    // Project ray onto a plane containing the handle and perpendicular to the
    // camera's view direction (gives most stable tracking for ortho cameras).
    const handlePos = new THREE.Vector3(...position);
    const planeNormal = camera.getWorldDirection(new THREE.Vector3()).clone();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, handlePos);
    const intersection = new THREE.Vector3();
    ray.ray.intersectPlane(plane, intersection);
    if (!intersection) return 0;
    return intersection.dot(axisVec);
  }, [camera, gl, position, axisVec]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    const worldCoord = projectPointerOnAxis(e);
    dragStartRef.current = { pointerWorld: worldCoord, startValue: value };
    setDragging(true);
  }, [projectPointerOnAxis, value]);

  const handlePointerMove = useCallback((e: any) => {
    if (!dragging || !dragStartRef.current) return;
    e.stopPropagation();
    const worldCoord = projectPointerOnAxis(e);
    const delta = (worldCoord - dragStartRef.current.pointerWorld) * direction;
    const newVal = Math.max(range[0], Math.min(range[1], dragStartRef.current.startValue + delta));
    onChange(Math.round(newVal * 10) / 10); // snap to 0.1mm
  }, [dragging, projectPointerOnAxis, direction, range, onChange]);

  const handlePointerUp = useCallback((e: any) => {
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    dragStartRef.current = null;
    setDragging(false);
  }, []);

  const activeColor = dragging ? '#ffffff' : hovered ? HANDLE_HOVER_COLOR : color;

  return (
    <group
      position={position}
      rotation={rotation}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = 'grab'; }}
      onPointerOut={() => { setHovered(false); if (!dragging) gl.domElement.style.cursor = 'auto'; }}
    >
      {/* Shaft */}
      <Cylinder args={[0.8, 0.8, length, 8]} position={[0, length / 2, 0]}>
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={hovered || dragging ? 0.6 : 0.2}
          roughness={0.3}
          metalness={0.5}
          transparent
          opacity={0.85}
        />
      </Cylinder>
      {/* Arrowhead */}
      <Cone args={[2.2, 4, 12]} position={[0, length + 2, 0]}>
        <meshStandardMaterial
          color={activeColor}
          emissive={activeColor}
          emissiveIntensity={hovered || dragging ? 0.8 : 0.3}
          roughness={0.2}
          metalness={0.6}
          transparent
          opacity={0.9}
        />
      </Cone>
    </group>
  );
}

// Dark soft-jaw palette — reads as forged steel against the light vise body.
const MATERIAL_COLORS: Record<string, string> = {
  'aluminum-6061': '#3a4048',
  'aluminum-7075': '#2f353c',
  'steel-mild':    '#2a2f36',
  'steel-4140':    '#22272e',
  'brass':         '#a07b2a',
  'nylon':         '#7a6238',
};

const DEFAULT_BLANK_COLOR = '#353a42';

const LABEL_COLOR = '#cfd2d7';  // light grey text against dark jaw

// ─── SHCS Counterbore on inner jaw face ──────────────────────────────────────
// Bolt is inserted head-first from the workpiece side, so the inner face shows
// the bolt-head view. Four concentric layers build the depth illusion:
//
//   Layer 1 — Bright machined rim   (widest)  → polished counterbore wall
//   Layer 2 — Dark cavity floor     (ring)    → shadowed recess behind rim
//   Layer 3 — SHCS cylindrical head (disc)    → black oxide bolt head
//   Layer 4 — Hex key socket        (6-sided) → Allen drive recess (innermost)
//
// Each layer is offset sign*Δ toward the viewer so deeper layers render in front.

function SideBolt({
  x, y, z, dia, sign,
}: { x: number; y: number; z: number; dia: number; sign: 1 | -1 }) {
  const cboreR = dia * 0.90;  // counterbore opening (bright machined face)
  const floorR = dia * 0.80;  // floor disc — dark ring between rim & head visible
  const headR  = dia * 0.68;  // SHCS cylindrical head fills most of the pocket
  const hexR   = dia * 0.28;  // hex key socket (M6/M8 scale)
  const eps    = 0.05;
  const yRot   = sign === 1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <group position={[x + sign * eps, y, z]}>
      {/* Layer 1 — Machined counterbore rim: bright ground surface */}
      <mesh rotation={[0, yRot, 0]}>
        <circleGeometry args={[cboreR, 48]} />
        <meshStandardMaterial color="#9aa2a8" roughness={0.18} metalness={0.96} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 2 — Cavity floor: dark annular ring, sells the pocket depth */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.010, 0, 0]}>
        <circleGeometry args={[floorR, 48]} />
        <meshStandardMaterial color="#12151a" roughness={0.75} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 3 — SHCS head: black oxide cylindrical head, dominant element */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.020, 0, 0]}>
        <circleGeometry args={[headR, 48]} />
        <meshStandardMaterial color="#28292e" roughness={0.28} metalness={0.94} side={THREE.DoubleSide} />
      </mesh>
      {/* Layer 4 — Hex socket: 6-sided Allen drive recess, near-black */}
      <mesh rotation={[0, yRot, 0]} position={[sign * 0.030, 0, 0]}>
        <circleGeometry args={[hexR, 6]} />
        <meshStandardMaterial color="#06080c" roughness={0.90} metalness={0.10} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── JawBlankMesh ────────────────────────────────────────────────────────────

const JAWS = [
  { sign: -1 as const, label: 'LEFT'  },
  { sign:  1 as const, label: 'RIGHT' },
];

export function JawBlankMesh() {
  const jawBlank         = useSoftJawsStore((s) => s.jawBlank);
  const updateJawBlank   = useSoftJawsStore((s) => s.updateJawBlank);
  const viseConfig       = useViseStore((s) => s.viseConfig);
  const mountingHoles    = useSoftJawsStore((s) => s.mountingHoles);
  const clampGap         = useSoftJawsStore((s) => s.clampGap);
  const activePartBbox   = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id)?.boundingBox ?? null) : null;
  });
  const { face, height, thickness, material } = jawBlank;

  // Only show interactive handles during the jaw-blank workflow step
  const activeStep = useWorkflowStore((s) => s.activeStep);
  const showHandles = activeStep === 'jaw-blank';

  const handleHeightChange = useCallback((val: number) => {
    updateJawBlank({ height: val });
  }, [updateJawBlank]);

  const handleThicknessChange = useCallback((val: number) => {
    updateJawBlank({ thickness: val });
  }, [updateJawBlank]);

  const { centerY, leftXOff, rightXOff, boltDia, boltZs, holesY, renderFace, labelSize } = useMemo(() => {
    const baseY   = jawBaseH(viseConfig.jawHeight);
    const innerX  = bracketInnerX(viseConfig);
    const maxFace = pillarFaceWidth(viseConfig);
    const rFace   = Math.min(face, maxFace * 0.98);

    const dia = Math.min(thickness * 0.30, rFace * 0.16);

    const positions = computeMountingHolePositions(viseConfig, jawBlank, mountingHoles);
    const zs        = positions.right.map((p) => p.z);
    const yCenter   = positions.right[0]?.y ?? baseY + height / 2;

    const fixedXOff = innerX - thickness / 2;
    const rXOff = activePartBbox
      ? Math.min(
          fixedXOff,
          (activePartBbox.max[0] - activePartBbox.min[0]) / 2 + clampGap + thickness / 2,
        )
      : fixedXOff;

    return {
      centerY:    baseY + height / 2,
      leftXOff:   rXOff,
      rightXOff:  rXOff,
      boltDia:    dia,
      boltZs:     zs,
      holesY:     yCenter,
      renderFace: rFace,
      labelSize:  height * 0.09,
    };
  }, [viseConfig, jawBlank, mountingHoles, face, height, thickness, activePartBbox, clampGap]);

  const color = MATERIAL_COLORS[material] ?? DEFAULT_BLANK_COLOR;

  return (
    <group>
      {JAWS.map(({ sign, label }) => {
        const xOffset  = sign === -1 ? leftXOff : rightXOff;
        const x        = sign * xOffset;
        const innerX   = x - sign * (thickness / 2);   // workpiece-facing X
        const halfFace = renderFace / 2;
        const labelEps = 0.08;
        const boltSign = (-sign) as 1 | -1;            // bolt head faces inward
        return (
          <group key={sign}>
            {/* Soft-jaw block — dark forged-steel look */}
            <mesh position={[x, centerY, 0]} castShadow receiveShadow>
              <boxGeometry args={[thickness, height, renderFace]} />
              <meshStandardMaterial
                color={color}
                roughness={0.90}
                metalness={0.30}
              />
              <Edges color="#08090c" lineWidth={1} threshold={15} />
            </mesh>

            {/* Counterbored SHCS on INNER face (workpiece side) */}
            {boltZs.map((bz) => (
              <SideBolt
                key={bz}
                x={innerX}
                y={holesY}
                z={bz}
                dia={boltDia}
                sign={boltSign}
              />
            ))}

            {/* Small laser-etched ID label — top-outer corner of each ±Z face */}
            {[1, -1].map((zSide) => (
              <Text
                key={zSide}
                position={[
                  x,
                  centerY + height * 0.35,          // near top edge
                  zSide * (halfFace + labelEps),
                ]}
                rotation={[0, zSide === -1 ? Math.PI : 0, 0]}
                fontSize={labelSize}
                color={LABEL_COLOR}
                anchorX="center"
                anchorY="middle"
                outlineWidth={labelSize * 0.06}
                outlineColor="#000000"
                outlineOpacity={0.6}
              >
                {label}
              </Text>
            ))}

            {/* ── Interactive Resize Handles (jaw-blank step only) ────────── */}
            {showHandles && (
              <>
                {/* Height handle — sits on top of the jaw, drags upward */}
                <DragHandle
                  position={[x, centerY + height / 2, 0]}
                  axis="y"
                  direction={1}
                  value={height}
                  range={[15, 200]}
                  onChange={handleHeightChange}
                  color="#40ff60"
                  length={6}
                />

                {/* Thickness handle — sits on inner face, drags inward (toward workpiece) */}
                <DragHandle
                  position={[innerX, centerY, 0]}
                  axis="x"
                  direction={-sign}
                  value={thickness}
                  range={[8, 80]}
                  onChange={handleThicknessChange}
                  color="#ff4060"
                  length={6}
                />
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}
