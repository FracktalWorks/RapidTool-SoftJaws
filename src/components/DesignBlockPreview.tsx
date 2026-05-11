/**
 * DesignBlockPreview — Trinckle-style floating card showing the dimension
 * being hovered. Renders an isolated 3D scene of just the relevant artefact
 * (vise envelope or jaw blank) with a single coloured arrow on the active
 * axis and a static R/G/B world-axis triad for orientation.
 *
 * Sourced entirely from `useDimensionHoverStore` — appears on hover/focus,
 * disappears on leave/blur. Pointer events disabled so it never intercepts
 * clicks on the main viewport.
 *
 * Trinckle → R3F mapping (consistent with the panel labels):
 *   Trinckle X (clamping)  → R3F X
 *   Trinckle Y (jaw face)  → R3F Z
 *   Trinckle Z (vertical)  → R3F Y
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Cone, Cylinder } from '@react-three/drei';
import { useDimensionHoverStore } from '@/stores/dimensionHover';
import { useViseStore } from '@/stores/viseStore';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { AXIS_COLORS, AXIS_TEXT_CLASS, type Axis } from '@/utils/axisColors';

type R3FAxis = 'x' | 'y' | 'z';

interface Resolved {
  /** Box dimensions in R3F space — [X, Y, Z]. */
  boxDims:  [number, number, number];
  /** Trinckle axis being highlighted (drives label colour). */
  axis:     Axis;
  /** R3F axis the arrow runs along (Trinckle Y → Z, Trinckle Z → Y). */
  arrowR3F: R3FAxis;
  value:    number;
  label:    string;
  /** Material that matches the scope's appearance in the main 3D scene. */
  material: { color: string; roughness: number; metalness: number };
  /**
   * Optional override for the arrow's length along arrowR3F. When set, the
   * arrow renders only `partialLength` units long, anchored at the negative
   * face of the box (e.g. pocket-depth visualisation cutting inward from the
   * jaw's inner face). Omit for full-extent arrows.
   */
  partialLength?: number;
}

// Scope-specific materials — sourced from ViseModel.BRACKET and JawBlankMesh
// MATERIAL_COLORS so the preview reads as the same artefact in miniature.
const VISE_MATERIAL = { color: '#c0c8d0', roughness: 0.35, metalness: 0.55 };
const JAW_MATERIAL  = { color: '#9099a3', roughness: 0.55, metalness: 0.25 };

// ─── Resolution: hover state → box geometry + axis ───────────────────────────

function resolve(
  hovered:    ReturnType<typeof useDimensionHoverStore.getState>['hovered'],
  viseConfig: ReturnType<typeof useViseStore.getState>['viseConfig'],
  jawBlank:   ReturnType<typeof useSoftJawsStore.getState>['jawBlank'],
  jawProfile: ReturnType<typeof useSoftJawsStore.getState>['jawProfile'],
): Resolved | null {
  if (!hovered) return null;

  if (hovered.scope === 'vise') {
    const boxDims: [number, number, number] = [
      viseConfig.jawStroke,   // R3F X = Trinckle X
      viseConfig.jawHeight,   // R3F Y = Trinckle Z
      viseConfig.jawWidth,    // R3F Z = Trinckle Y
    ];
    switch (hovered.field) {
      case 'jawStroke':
        return { boxDims, axis: 'x', arrowR3F: 'x', value: viseConfig.jawStroke, label: 'Max stroke',  material: VISE_MATERIAL };
      case 'jawHeight':
        return { boxDims, axis: 'z', arrowR3F: 'y', value: viseConfig.jawHeight, label: 'Vise height', material: VISE_MATERIAL };
      case 'jawWidth':
        return { boxDims, axis: 'y', arrowR3F: 'z', value: viseConfig.jawWidth,  label: 'Vise width',  material: VISE_MATERIAL };
    }
  }

  if (hovered.scope === 'jaw') {
    const boxDims: [number, number, number] = [
      jawBlank.thickness,   // R3F X = Trinckle X
      jawBlank.height,      // R3F Y = Trinckle Z
      jawBlank.face,        // R3F Z = Trinckle Y
    ];
    switch (hovered.field) {
      case 'thickness':
        return { boxDims, axis: 'x', arrowR3F: 'x', value: jawBlank.thickness, label: 'Length', material: JAW_MATERIAL };
      case 'height':
        return { boxDims, axis: 'z', arrowR3F: 'y', value: jawBlank.height,    label: 'Height', material: JAW_MATERIAL };
      case 'face':
        return { boxDims, axis: 'y', arrowR3F: 'z', value: jawBlank.face,      label: 'Width',  material: JAW_MATERIAL };
    }
  }

  if (hovered.scope === 'profile') {
    // Show the jaw blank with a partial arrow along X — the arrow cuts
    // inward from the inner face by `depth`, visualising the pocket.
    const boxDims: [number, number, number] = [
      jawBlank.thickness,
      jawBlank.height,
      jawBlank.face,
    ];
    if (hovered.field === 'depth') {
      return {
        boxDims,
        axis: 'x',
        arrowR3F: 'x',
        value: jawProfile.depth,
        label: 'Pocket depth',
        material: JAW_MATERIAL,
        partialLength: jawProfile.depth,
      };
    }
  }

  return null;
}

// ─── Single-axis dimension arrow (sits just outside the box) ─────────────────

function DimensionArrow({
  boxDims,
  arrowR3F,
  color,
  partialLength,
}: {
  boxDims: [number, number, number];
  arrowR3F: R3FAxis;
  color: string;
  /** When set, the arrow runs only `partialLength` units from the box's
   *  negative face inward (used for pocket-depth visualisation). */
  partialLength?: number;
}) {
  const [bx, by, bz] = boxDims;
  const maxD   = Math.max(bx, by, bz);
  const offset = maxD * 0.18;
  const shaftR = maxD * 0.012;
  const headR  = shaftR * 4;
  const headH  = shaftR * 12;

  let start: [number, number, number];
  let end:   [number, number, number];
  let length: number;
  let shaftRot: [number, number, number];
  let startConeRot: [number, number, number];
  let endConeRot:   [number, number, number];

  // Pocket-depth mode: arrow starts at the negative face and extends inward
  // by `partialLength` instead of spanning the full box dimension.
  if (arrowR3F === 'x') {
    const xStart = -bx / 2;
    const xEnd   = partialLength != null
      ? Math.min(xStart + partialLength, +bx / 2)
      : +bx / 2;
    start = [xStart, by / 2 + offset, bz / 2 + offset];
    end   = [xEnd,   by / 2 + offset, bz / 2 + offset];
    length = xEnd - xStart;
    shaftRot     = [0, 0, -Math.PI / 2];
    startConeRot = [0, 0,  Math.PI / 2];
    endConeRot   = [0, 0, -Math.PI / 2];
  } else if (arrowR3F === 'y') {
    const yStart = -by / 2;
    const yEnd   = partialLength != null
      ? Math.min(yStart + partialLength, +by / 2)
      : +by / 2;
    start = [bx / 2 + offset, yStart, bz / 2 + offset];
    end   = [bx / 2 + offset, yEnd,   bz / 2 + offset];
    length = yEnd - yStart;
    shaftRot     = [0, 0, 0];
    startConeRot = [Math.PI, 0, 0];
    endConeRot   = [0, 0, 0];
  } else {
    const zStart = -bz / 2;
    const zEnd   = partialLength != null
      ? Math.min(zStart + partialLength, +bz / 2)
      : +bz / 2;
    start = [bx / 2 + offset, by / 2 + offset, zStart];
    end   = [bx / 2 + offset, by / 2 + offset, zEnd];
    length = zEnd - zStart;
    shaftRot     = [Math.PI / 2, 0, 0];
    startConeRot = [-Math.PI / 2, 0, 0];
    endConeRot   = [ Math.PI / 2, 0, 0];
  }

  const center: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  return (
    <group>
      <Cylinder args={[shaftR, shaftR, length - headH * 1.6, 12]} position={center} rotation={shaftRot}>
        <meshBasicMaterial color={color} />
      </Cylinder>
      <Cone args={[headR, headH, 16]} position={start} rotation={startConeRot}>
        <meshBasicMaterial color={color} />
      </Cone>
      <Cone args={[headR, headH, 16]} position={end} rotation={endConeRot}>
        <meshBasicMaterial color={color} />
      </Cone>
    </group>
  );
}

// ─── Static R/G/B world-axis triad (corner indicator) ────────────────────────

function AxisTriad({ size }: { size: number }) {
  const shaftR = size * 0.025;
  const headR  = size * 0.08;
  const headH  = size * 0.18;
  const shaftL = size * 0.82;

  return (
    <group>
      {/* X — red (clamping) */}
      <Cylinder args={[shaftR, shaftR, shaftL, 8]} position={[shaftL / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshBasicMaterial color={AXIS_COLORS.x} />
      </Cylinder>
      <Cone args={[headR, headH, 12]} position={[size, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshBasicMaterial color={AXIS_COLORS.x} />
      </Cone>

      {/* Y — green (Trinckle Y, R3F Z, jaw-face direction) */}
      <Cylinder args={[shaftR, shaftR, shaftL, 8]} position={[0, 0, shaftL / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={AXIS_COLORS.y} />
      </Cylinder>
      <Cone args={[headR, headH, 12]} position={[0, 0, size]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={AXIS_COLORS.y} />
      </Cone>

      {/* Z — blue (Trinckle Z, R3F Y, vertical) */}
      <Cylinder args={[shaftR, shaftR, shaftL, 8]} position={[0, shaftL / 2, 0]}>
        <meshBasicMaterial color={AXIS_COLORS.z} />
      </Cylinder>
      <Cone args={[headR, headH, 12]} position={[0, size, 0]}>
        <meshBasicMaterial color={AXIS_COLORS.z} />
      </Cone>
    </group>
  );
}

// ─── Camera framed on origin (Three.js cameras don't auto-lookAt) ────────────

function FramedCamera({ maxDim }: { maxDim: number }) {
  const ref = useRef<THREE.OrthographicCamera>(null);
  const camDist = maxDim * 2.6;
  // Zoom is calibrated so a maxDim-sized box fills ~60% of the 320×280 canvas.
  const camZoom = 90 / maxDim;

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.lookAt(0, 0, 0);
      ref.current.updateProjectionMatrix();
    }
  }, [maxDim]);

  return (
    <OrthographicCamera
      ref={ref}
      makeDefault
      position={[camDist, camDist * 0.85, camDist]}
      zoom={camZoom}
      near={0.1}
      far={camDist * 8}
    />
  );
}

// ─── Card wrapper ────────────────────────────────────────────────────────────

export function DesignBlockPreview() {
  const hovered    = useDimensionHoverStore((s) => s.hovered);
  const viseConfig = useViseStore((s) => s.viseConfig);
  const jawBlank   = useSoftJawsStore((s) => s.jawBlank);
  const jawProfile = useSoftJawsStore((s) => s.jawProfile);

  const resolved = useMemo(
    () => resolve(hovered, viseConfig, jawBlank, jawProfile),
    [hovered, viseConfig, jawBlank, jawProfile],
  );

  if (!resolved) return null;

  const { boxDims, axis, arrowR3F, value, label, material, partialLength } = resolved;
  const maxDim    = Math.max(...boxDims);
  const triadSize = maxDim * 0.30;

  // Layout offsets: toolbar (56px) + context panel (320px) = 376px sidebar.
  // Leave a small gap so the card floats clear of the panel border.
  return (
    <div className="fixed left-[26rem] top-1/2 -translate-y-1/2 z-40 pointer-events-none select-none">
      <div className="w-[320px] rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur-md overflow-hidden">
        <div className="h-[280px] bg-gradient-to-br from-muted/40 to-background">
          <Canvas gl={{ antialias: true, alpha: true }}>
            <FramedCamera maxDim={maxDim} />
            <ambientLight intensity={0.75} />
            <directionalLight position={[10, 15, 8]} intensity={0.7} />
            <directionalLight position={[-8, 4, -5]} intensity={0.3} />

            {/* The artefact — vise envelope (light steel) or jaw blank (forged) */}
            <mesh>
              <boxGeometry args={boxDims} />
              <meshStandardMaterial
                color={material.color}
                roughness={material.roughness}
                metalness={material.metalness}
              />
            </mesh>

            {/* Highlighted dimension */}
            <DimensionArrow
              boxDims={boxDims}
              arrowR3F={arrowR3F}
              color={AXIS_COLORS[axis]}
              partialLength={partialLength}
            />

            {/* World-axis triad in the negative-corner of the view */}
            <group position={[-maxDim * 0.7, -maxDim * 0.55, -maxDim * 0.7]}>
              <AxisTriad size={triadSize} />
            </group>
          </Canvas>
        </div>
        <div className="border-t border-border/50 px-3 py-2.5 text-center text-xs font-tech">
          <span className={`font-semibold ${AXIS_TEXT_CLASS[axis]}`}>{label}</span>
          <span className="text-muted-foreground">: </span>
          <span className="font-semibold tabular-nums">{value.toFixed(1)} mm</span>
        </div>
      </div>
    </div>
  );
}
