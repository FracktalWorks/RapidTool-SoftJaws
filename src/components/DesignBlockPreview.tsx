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
  hovered:       ReturnType<typeof useDimensionHoverStore.getState>['hovered'],
  viseConfig:    ReturnType<typeof useViseStore.getState>['viseConfig'],
  jawBlank:      ReturnType<typeof useSoftJawsStore.getState>['jawBlank'],
  jawProfile:    ReturnType<typeof useSoftJawsStore.getState>['jawProfile'],
  mountingHoles: ReturnType<typeof useSoftJawsStore.getState>['mountingHoles'],
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
      jawBlank.left.thickness,   // R3F X = Trinckle X
      jawBlank.left.height,      // R3F Y = Trinckle Z
      jawBlank.left.face,        // R3F Z = Trinckle Y
    ];
    switch (hovered.field) {
      case 'thickness':
        return { boxDims, axis: 'x', arrowR3F: 'x', value: jawBlank.left.thickness, label: 'Length', material: JAW_MATERIAL };
      case 'height':
        return { boxDims, axis: 'z', arrowR3F: 'y', value: jawBlank.left.height,    label: 'Height', material: JAW_MATERIAL };
      case 'face':
        return { boxDims, axis: 'y', arrowR3F: 'z', value: jawBlank.left.face,      label: 'Width',  material: JAW_MATERIAL };
    }
  }

  if (hovered.scope === 'profile') {
    // Show the jaw blank with a partial arrow along X — the arrow cuts
    // inward from the inner face by `depth`, visualising the pocket.
    const boxDims: [number, number, number] = [
      jawBlank.left.thickness,
      jawBlank.left.height,
      jawBlank.left.face,
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

  if (hovered.scope === 'holes') {
    const boxDims: [number, number, number] = [
      jawBlank.left.thickness,   // R3F X = Trinckle X
      jawBlank.left.height,      // R3F Y = Trinckle Z
      jawBlank.left.face,        // R3F Z = Trinckle Y
    ];
    switch (hovered.field) {
      case 'boltSize':
        return {
          boxDims,
          axis: 'y',
          arrowR3F: 'z',
          value: mountingHoles.boltSize,
          label: 'Screw diameter',
          material: JAW_MATERIAL,
          partialLength: mountingHoles.boltSize,
        };
      case 'screwheadHeight':
        return {
          boxDims,
          axis: 'x',
          arrowR3F: 'x',
          value: mountingHoles.screwheadHeight,
          label: 'Screwhead height',
          material: JAW_MATERIAL,
          partialLength: mountingHoles.screwheadHeight,
        };
      case 'screwheadDiameter':
        return {
          boxDims,
          axis: 'y',
          arrowR3F: 'z',
          value: mountingHoles.screwheadDiameter,
          label: 'Screwhead diameter',
          material: JAW_MATERIAL,
          partialLength: mountingHoles.screwheadDiameter,
        };
      case 'spacing':
        return {
          boxDims,
          axis: 'y',
          arrowR3F: 'z',
          value: mountingHoles.spacing,
          label: 'Holes distance',
          material: JAW_MATERIAL,
          partialLength: mountingHoles.spacing,
        };
      case 'holesHeight':
        return {
          boxDims,
          axis: 'z',
          arrowR3F: 'y',
          value: mountingHoles.holesHeight,
          label: 'Holes height',
          material: JAW_MATERIAL,
          partialLength: mountingHoles.holesHeight,
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

interface HolesPreviewDiagramProps {
  field: string;
  mountingHoles: ReturnType<typeof useSoftJawsStore.getState>['mountingHoles'];
}

function HolesPreviewDiagram({ field, mountingHoles }: HolesPreviewDiagramProps) {
  const highlightColor = '#0ea5e9'; // sky-500
  const isBoltSize = field === 'boltSize';
  const isScrewheadHeight = field === 'screwheadHeight';
  const isScrewheadDiameter = field === 'screwheadDiameter';
  const isSpacing = field === 'spacing';
  const isHolesHeight = field === 'holesHeight';

  return (
    <svg viewBox="0 0 300 240" className="w-full h-full text-card-foreground select-none font-tech">
      <defs>
        {/* Shading for the screw shafts */}
        <linearGradient id="holeShading" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        {/* Shading for the screw heads */}
        <linearGradient id="cbShading" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        {/* Define arrow markers */}
        <marker
          id="arrow-start"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill={highlightColor} />
        </marker>
        <marker
          id="arrow-end"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={highlightColor} />
        </marker>
      </defs>

      {/* ────────────────── TOP DIAGRAM: CROSS SECTION ────────────────── */}
      {/* Background cylinders (representing the holes in cross section) */}
      <rect x="93" y="30" width="14" height="28" fill="url(#holeShading)" />
      <rect x="86" y="58" width="28" height="12" fill="url(#cbShading)" />

      <rect x="193" y="30" width="14" height="28" fill="url(#holeShading)" />
      <rect x="186" y="58" width="28" height="12" fill="url(#cbShading)" />

      {/* Jaw Material pieces (split by holes) */}
      {/* Left Piece */}
      <path
        d="M 50 30 L 93 30 L 93 58 L 86 58 L 86 70 L 50 70 Z"
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Middle Piece */}
      <path
        d="M 107 30 L 193 30 L 193 58 L 186 58 L 186 70 L 114 70 L 114 58 L 107 58 Z"
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right Piece */}
      <path
        d="M 207 30 L 250 30 L 250 70 L 214 70 L 214 58 L 207 58 Z"
        fill="#f8fafc"
        stroke="#334155"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Dimension overlays for Top Diagram */}
      {/* 1. Screw diameter (boltSize) */}
      {isBoltSize && (
        <g>
          <line x1="93" y1="30" x2="93" y2="15" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="107" y1="30" x2="107" y2="15" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="75" y1="18" x2="93" y2="18" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <line x1="125" y1="18" x2="107" y2="18" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <text x="100" y="12" fill={highlightColor} fontSize="9" textAnchor="middle" fontWeight="bold">
            M{mountingHoles.boltSize}
          </text>
        </g>
      )}

      {/* 2. Screwhead height (screwheadHeight) */}
      {isScrewheadHeight && (
        <g>
          <line x1="86" y1="58" x2="68" y2="58" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="86" y1="70" x2="68" y2="70" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="72" y1="48" x2="72" y2="58" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <line x1="72" y1="80" x2="72" y2="70" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <text x="63" y="67" fill={highlightColor} fontSize="9" textAnchor="end" fontWeight="bold">
            {mountingHoles.screwheadHeight.toFixed(1)}
          </text>
        </g>
      )}

      {/* 3. Screwhead diameter (screwheadDiameter) */}
      {isScrewheadDiameter && (
        <g>
          <line x1="86" y1="70" x2="86" y2="85" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="114" y1="70" x2="114" y2="85" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="70" y1="81" x2="86" y2="81" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <line x1="130" y1="81" x2="114" y2="81" stroke={highlightColor} strokeWidth="1.5" markerEnd="url(#arrow-end)" />
          <text x="100" y="92" fill={highlightColor} fontSize="9" textAnchor="middle" fontWeight="bold">
            Ø{mountingHoles.screwheadDiameter.toFixed(1)}
          </text>
        </g>
      )}


      {/* ────────────────── BOTTOM DIAGRAM: FRONT VIEW ────────────────── */}
      {/* Front Face Panel */}
      <rect
        x="50"
        y="120"
        width="200"
        height="80"
        fill="#f1f5f9"
        stroke="#334155"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Left Hole Concentric Circles */}
      <circle cx="100" cy="160" r="14" fill="none" stroke="#475569" strokeWidth="1" />
      <circle cx="100" cy="160" r="7" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <line x1="100" y1="142" x2="100" y2="178" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.8" />
      <line x1="82" y1="160" x2="118" y2="160" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.8" />

      {/* Right Hole Concentric Circles */}
      <circle cx="200" cy="160" r="14" fill="none" stroke="#475569" strokeWidth="1" />
      <circle cx="200" cy="160" r="7" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <line x1="200" y1="142" x2="200" y2="178" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.8" />
      <line x1="182" y1="160" x2="218" y2="160" stroke="#0ea5e9" strokeWidth="0.75" strokeOpacity="0.8" />


      {/* Dimension overlays for Bottom Diagram */}
      {/* 4. Holes distance (spacing) */}
      {isSpacing && (
        <g>
          <line x1="100" y1="160" x2="100" y2="225" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="200" y1="160" x2="200" y2="225" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line
            x1="100"
            y1="220"
            x2="200"
            y2="220"
            stroke={highlightColor}
            strokeWidth="1.5"
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <text x="150" y="215" fill={highlightColor} fontSize="10" textAnchor="middle" fontWeight="bold">
            {mountingHoles.spacing.toFixed(1)} mm
          </text>
        </g>
      )}

      {/* 5. Holes height (holesHeight) */}
      {isHolesHeight && (
        <g>
          <line x1="100" y1="160" x2="35" y2="160" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line x1="50" y1="200" x2="35" y2="200" stroke={highlightColor} strokeWidth="1" strokeDasharray="2,2" />
          <line
            x1="40"
            y1="160"
            x2="40"
            y2="200"
            stroke={highlightColor}
            strokeWidth="1.5"
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <text x="30" y="184" fill={highlightColor} fontSize="9" textAnchor="end" fontWeight="bold">
            {mountingHoles.holesHeight.toFixed(1)}
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── Card wrapper ────────────────────────────────────────────────────────────

export function DesignBlockPreview() {
  const hovered       = useDimensionHoverStore((s) => s.hovered);
  const viseConfig    = useViseStore((s) => s.viseConfig);
  const jawBlank      = useSoftJawsStore((s) => s.jawBlank);
  const jawProfile    = useSoftJawsStore((s) => s.jawProfile);
  const mountingHoles = useSoftJawsStore((s) => s.mountingHoles);

  const resolved = useMemo(
    () => resolve(hovered, viseConfig, jawBlank, jawProfile, mountingHoles),
    [hovered, viseConfig, jawBlank, jawProfile, mountingHoles],
  );

  if (!resolved) return null;

  const { boxDims, axis, arrowR3F, value, label, material, partialLength } = resolved;
  const isHolesScope = hovered?.scope === 'holes';
  const isViseScope = hovered?.scope === 'vise';

  // Calculate maxDim with margin for the extra vise components if in vise scope
  const maxDim = isViseScope
    ? Math.max(boxDims[0] + 40, boxDims[1] + 20, boxDims[2])
    : Math.max(...boxDims);
  const triadSize = maxDim * 0.30;

  // Layout offsets: toolbar (56px) + context panel (320px) = 376px sidebar.
  // Leave a small gap so the card floats clear of the panel border.
  return (
    <div className="fixed left-[26rem] top-1/2 -translate-y-1/2 z-40 pointer-events-none select-none">
      <div className="w-[320px] rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur-md overflow-hidden">
        <div className="h-[280px] bg-gradient-to-br from-muted/40 to-background flex items-center justify-center p-2">
          {isHolesScope ? (
            <HolesPreviewDiagram field={hovered.field} mountingHoles={mountingHoles} />
          ) : (
            <Canvas gl={{ antialias: true, alpha: true }}>
              <FramedCamera maxDim={maxDim} />
              <ambientLight intensity={0.75} />
              <directionalLight position={[10, 15, 8]} intensity={0.7} />
              <directionalLight position={[-8, 4, -5]} intensity={0.3} />

              {isViseScope ? (
                <group>
                  {/* Vise Bed/Rail */}
                  <mesh position={[0, -boxDims[1] / 2 - 10, 0]}>
                    <boxGeometry args={[boxDims[0] + 40, 20, boxDims[2]]} />
                    <meshStandardMaterial
                      color={material.color}
                      roughness={material.roughness}
                      metalness={material.metalness}
                    />
                  </mesh>
                  {/* Left Jaw Block (Fixed) */}
                  <mesh position={[-(boxDims[0] / 2 + 10), 0, 0]}>
                    <boxGeometry args={[20, boxDims[1], boxDims[2]]} />
                    <meshStandardMaterial
                      color={material.color}
                      roughness={material.roughness}
                      metalness={material.metalness}
                    />
                  </mesh>
                  {/* Right Jaw Block (Movable) */}
                  <mesh position={[boxDims[0] / 2 + 10, 0, 0]}>
                    <boxGeometry args={[20, boxDims[1], boxDims[2]]} />
                    <meshStandardMaterial
                      color={material.color}
                      roughness={material.roughness}
                      metalness={material.metalness}
                    />
                  </mesh>
                </group>
              ) : (
                /* The block — jaw blank (forged) */
                <mesh>
                  <boxGeometry args={boxDims} />
                  <meshStandardMaterial
                    color={material.color}
                    roughness={material.roughness}
                    metalness={material.metalness}
                  />
                </mesh>
              )}

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
          )}
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
