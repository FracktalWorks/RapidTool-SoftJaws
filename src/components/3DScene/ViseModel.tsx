/**
 * ViseModel — Procedural parametric CNC milling vise
 *
 * Generates a realistic-looking milling vise directly in Three.js using
 * primitive geometries (boxes, cylinders). All dimensions are derived from
 * the vise preset in the store, so changing presets instantly re-renders
 * the correct vise proportions.
 *
 * Anatomy of the vise (Three.js Y-up):
 *   ┌──────────────────────────────────┐  ← Fixed Jaw
 *   │          BASE BODY               │
 *   │  ┌────┐              ┌────┐      │  ← Mounting tabs (T-slot)
 *   └──┴────┴──────────────┴────┴──────┘
 *                                   ┌──┐  ← Moving Jaw
 *                                   └──┘
 *        ════════════════════         ← Lead screw housing
 *
 * The vise sits centered at X=0, base on Y=0 plane, centered in Z.
 * Jaw opening is controlled by `jawOpening` prop (0 = closed, max = jawStroke).
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';

// ─── Color palette for realistic machined steel look ────────────────────────

const COLORS = {
  base:       '#7a8494',  // Cast iron grey
  baseEdge:   '#5a6474',
  jaw:        '#8a94a4',  // Machined steel
  jawFace:    '#6a7484',  // Slightly darker for jaw face
  screw:      '#5a6474',  // Dark steel
  tab:        '#6a7888',  // Mounting tab
  accent:     '#4a5a6e',  // Darkened accents
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

interface BoxPartProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  edgeColor?: string;
  showEdges?: boolean;
}

function BoxPart({ position, size, color, edgeColor = COLORS.baseEdge, showEdges = true }: BoxPartProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.5} />
      {showEdges && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
          <lineBasicMaterial color={edgeColor} transparent opacity={0.3} />
        </lineSegments>
      )}
    </mesh>
  );
}

interface CylinderPartProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  radius: number;
  height: number;
  color: string;
  segments?: number;
}

function CylinderPart({ position, rotation, radius, height, color, segments = 24 }: CylinderPartProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, segments]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.5} />
    </mesh>
  );
}

// ─── Mounting Hole ──────────────────────────────────────────────────────────

function MountingHole({ position, radius, depth }: { position: [number, number, number]; radius: number; depth: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius, depth, 16]} />
      <meshStandardMaterial color="#3a4454" roughness={0.8} metalness={0.3} />
    </mesh>
  );
}

// ─── T-Slot Tab ─────────────────────────────────────────────────────────────

function TSlotTab({ position, width, height, depth }: {
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
}) {
  const holeRadius = Math.min(width, depth) * 0.2;
  return (
    <group position={position}>
      <BoxPart
        position={[0, height / 2, 0]}
        size={[width, height, depth]}
        color={COLORS.tab}
        edgeColor={COLORS.accent}
      />
      {/* Mounting hole */}
      <MountingHole
        position={[0, height + 0.1, 0]}
        radius={holeRadius}
        depth={height * 0.6}
      />
    </group>
  );
}

// ─── Label Text Indicator ───────────────────────────────────────────────────

function JawLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <mesh position={position} rotation={[0, 0, 0]}>
      <planeGeometry args={[12, 5]} />
      <meshStandardMaterial color="#2a3444" roughness={0.9} metalness={0.1} />
    </mesh>
  );
}

// ─── Main ViseModel ─────────────────────────────────────────────────────────

interface ViseModelProps {
  jawOpening?: number; // mm — how far the moving jaw is open
}

export function ViseModel({ jawOpening }: ViseModelProps) {
  const viseConfig = useSoftJawsStore((s) => s.viseConfig);

  const dims = useMemo(() => {
    const { jawWidth, jawHeight, jawStroke } = viseConfig;

    // Proportional dimensions derived from vise specs
    const baseLength = jawStroke + jawWidth * 0.6;  // Total base length along X
    const baseWidth = jawWidth;                      // Width along Z
    const baseHeight = jawHeight * 0.5;              // Base thickness

    const jawThickness = jawWidth * 0.12;            // Jaw plate thickness
    const jawFaceHeight = jawHeight;                 // Full jaw face height

    const tabWidth = baseWidth * 0.25;               // T-slot tab width
    const tabDepth = baseWidth * 0.3;                // T-slot tab protrusion
    const tabHeight = baseHeight * 0.6;              // Tab height

    const screwRadius = baseHeight * 0.18;           // Lead screw radius
    const screwHousingWidth = baseWidth * 0.55;      // Screw housing width
    const screwHousingHeight = baseHeight * 0.5;     // Screw housing height

    const opening = jawOpening ?? jawStroke * 0.4;   // Default 40% open

    return {
      baseLength,
      baseWidth,
      baseHeight,
      jawThickness,
      jawFaceHeight,
      tabWidth,
      tabDepth,
      tabHeight,
      screwRadius,
      screwHousingWidth,
      screwHousingHeight,
      jawStroke,
      opening,
    };
  }, [viseConfig, jawOpening]);

  // Position the entire vise so it sits on the Y=0 ground plane
  // and is centered in X/Z
  return (
    <group>
      {/* ── Base Body ──────────────────────────────────────────── */}
      <BoxPart
        position={[0, dims.baseHeight / 2, 0]}
        size={[dims.baseLength, dims.baseHeight, dims.baseWidth]}
        color={COLORS.base}
      />

      {/* ── Raised rail on top of base (guide rail) ───────────── */}
      <BoxPart
        position={[0, dims.baseHeight + dims.baseHeight * 0.1, 0]}
        size={[dims.baseLength * 0.92, dims.baseHeight * 0.2, dims.baseWidth * 0.7]}
        color={COLORS.base}
        edgeColor={COLORS.accent}
      />

      {/* ── Fixed Jaw (left side, negative X) ─────────────────── */}
      <group position={[-dims.baseLength / 2 + dims.jawThickness / 2, 0, 0]}>
        {/* Jaw body */}
        <BoxPart
          position={[0, dims.baseHeight + dims.jawFaceHeight / 2, 0]}
          size={[dims.jawThickness, dims.jawFaceHeight, dims.baseWidth]}
          color={COLORS.jaw}
          edgeColor={COLORS.accent}
        />
        {/* Jaw face (gripping surface — slightly darker) */}
        <BoxPart
          position={[dims.jawThickness / 2 + 0.5, dims.baseHeight + dims.jawFaceHeight / 2, 0]}
          size={[1, dims.jawFaceHeight * 0.9, dims.baseWidth * 0.85]}
          color={COLORS.jawFace}
          showEdges={false}
        />
      </group>

      {/* ── Moving Jaw (slides along +X based on opening) ─────── */}
      <group position={[-dims.baseLength / 2 + dims.jawThickness + dims.opening, 0, 0]}>
        {/* Jaw body */}
        <BoxPart
          position={[0, dims.baseHeight + dims.jawFaceHeight / 2, 0]}
          size={[dims.jawThickness, dims.jawFaceHeight, dims.baseWidth]}
          color={COLORS.jaw}
          edgeColor={COLORS.accent}
        />
        {/* Jaw face (gripping surface) */}
        <BoxPart
          position={[-dims.jawThickness / 2 - 0.5, dims.baseHeight + dims.jawFaceHeight / 2, 0]}
          size={[1, dims.jawFaceHeight * 0.9, dims.baseWidth * 0.85]}
          color={COLORS.jawFace}
          showEdges={false}
        />
        {/* Sliding carriage block under moving jaw */}
        <BoxPart
          position={[0, dims.baseHeight * 0.6, 0]}
          size={[dims.jawThickness * 1.8, dims.baseHeight * 0.35, dims.baseWidth * 0.65]}
          color={COLORS.accent}
          showEdges={false}
        />
      </group>

      {/* ── Lead Screw Housing (extends from moving jaw to right end) ── */}
      <BoxPart
        position={[
          dims.baseLength / 2 - dims.baseLength * 0.18,
          dims.baseHeight + dims.screwHousingHeight / 2,
          0,
        ]}
        size={[dims.baseLength * 0.35, dims.screwHousingHeight, dims.screwHousingWidth]}
        color={COLORS.screw}
        edgeColor={COLORS.accent}
      />

      {/* ── Lead Screw Rod ──────────────────────────────────────── */}
      <CylinderPart
        position={[dims.baseLength / 2 * 0.2, dims.baseHeight + dims.screwHousingHeight / 2, 0]}
        rotation={[0, 0, Math.PI / 2]}
        radius={dims.screwRadius}
        height={dims.baseLength * 0.6}
        color={COLORS.accent}
      />

      {/* ── Handwheel / End Cap ──────────────────────────────────── */}
      <CylinderPart
        position={[dims.baseLength / 2 + 2, dims.baseHeight + dims.screwHousingHeight / 2, 0]}
        rotation={[0, 0, Math.PI / 2]}
        radius={dims.screwRadius * 2.5}
        height={3}
        color={COLORS.accent}
        segments={32}
      />

      {/* ── T-Slot Mounting Tabs ────────────────────────────────── */}
      {/* Front-left tab */}
      <TSlotTab
        position={[-dims.baseLength * 0.35, 0, dims.baseWidth / 2 + dims.tabDepth / 2]}
        width={dims.tabWidth}
        height={dims.tabHeight}
        depth={dims.tabDepth}
      />
      {/* Front-right tab */}
      <TSlotTab
        position={[dims.baseLength * 0.35, 0, dims.baseWidth / 2 + dims.tabDepth / 2]}
        width={dims.tabWidth}
        height={dims.tabHeight}
        depth={dims.tabDepth}
      />
      {/* Back-left tab */}
      <TSlotTab
        position={[-dims.baseLength * 0.35, 0, -dims.baseWidth / 2 - dims.tabDepth / 2]}
        width={dims.tabWidth}
        height={dims.tabHeight}
        depth={dims.tabDepth}
      />
      {/* Back-right tab */}
      <TSlotTab
        position={[dims.baseLength * 0.35, 0, -dims.baseWidth / 2 - dims.tabDepth / 2]}
        width={dims.tabWidth}
        height={dims.tabHeight}
        depth={dims.tabDepth}
      />

      {/* ── Jaw Label Indicators (machined marks) ────────────── */}
      <JawLabel position={[-dims.baseLength / 2 + dims.jawThickness + 8, dims.baseHeight + dims.jawFaceHeight * 0.8, dims.baseWidth / 2 + 0.6]} text="L" />
    </group>
  );
}
