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

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Edges, Text, PivotControls, Html } from '@react-three/drei';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  geometryCache,
  JAW_HOLED_CACHE_KEY_LEFT,
  JAW_HOLED_CACHE_KEY_RIGHT,
} from '@/stores/geometryCache';
import {
  jawBaseH,
  bracketInnerX,
} from '@/features/vise-config/data/presets';
import { rightJawCenterX } from '@/utils/partGeometry';
import { setOrbitControlsEnabled } from '@rapidtool/cad-core';

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

// ─── JawBlankMesh ────────────────────────────────────────────────────────────

const JAWS = [
  { sign: -1 as const, label: 'LEFT'  },
  { sign:  1 as const, label: 'RIGHT' },
];

export function JawBlankMesh() {
  const jawBlank        = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig      = useViseStore((s) => s.viseConfig);
  const clampGap        = useSoftJawsStore((s) => s.clampGap);
  const holesGenerated  = useSoftJawsStore((s) => s.mountingHoles.generated);
  const activePart      = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });
  const { face, height, thickness, material } = jawBlank;

  const [activeGizmoSide, setActiveGizmoSide] = useState<-1 | 1 | null>(null);
  const [hudHeight, setHudHeight] = useState<string>('');
  const [hudThickness, setHudThickness] = useState<string>('');

  const leftMeshRef = useRef<THREE.Mesh>(null);
  const rightMeshRef = useRef<THREE.Mesh>(null);
  const leftLabelGroupRef = useRef<THREE.Group>(null);
  const rightLabelGroupRef = useRef<THREE.Group>(null);
  const dragStartHeight = useRef<number>(0);
  const dragStartCenterY = useRef<number>(0);
  const dragStartThickness = useRef<number>(0);
  const dragStartLeftX = useRef<number>(0);
  const dragStartRightX = useRef<number>(0);

  // Build a CACHED BufferGeometry from the holed-blank cache entry.
  //
  // Safety:
  //   • Bail out if positions Float32Array is missing or empty — a
  //     half-populated cache (e.g. mid auto-drill) would otherwise produce
  //     a BufferGeometry with a count-0 position attribute, which crashes
  //     drei's <Edges> during EdgesGeometry construction.
  //   • Returns null on any invariant violation so the render falls back
  //     to the raw boxGeometry branch.
  function buildHoledGeometry(cacheKey: string): THREE.BufferGeometry | null {
    const cached = geometryCache.get(cacheKey);
    if (!cached) return null;
    if (!cached.positions || cached.positions.length === 0) return null;
    if (cached.positions.length % 9 !== 0 && !cached.indices) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cached.positions, 3));
    if (cached.normals && cached.normals.length === cached.positions.length) {
      geo.setAttribute('normal', new THREE.BufferAttribute(cached.normals, 3));
    } else {
      // Fallback — make sure we never hand drei a geometry without normals.
      geo.computeVertexNormals();
    }
    if (cached.indices && cached.indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(cached.indices, 1));
    }
    return geo;
  }

  const leftHoledGeo = useMemo(
    () => (holesGenerated ? buildHoledGeometry(JAW_HOLED_CACHE_KEY_LEFT)  : null),
    [holesGenerated],
  );
  const rightHoledGeo = useMemo(
    () => (holesGenerated ? buildHoledGeometry(JAW_HOLED_CACHE_KEY_RIGHT) : null),
    [holesGenerated],
  );

  // Per-geometry dispose effects.  The previous shared effect disposed BOTH
  // geometries whenever EITHER changed — fine today because they're driven
  // by the same `holesGenerated` flag, but a foundational lifecycle bug
  // waiting for a side-by-side regeneration to trigger a use-after-dispose.
  useEffect(() => {
    return () => { leftHoledGeo?.dispose(); };
  }, [leftHoledGeo]);
  useEffect(() => {
    return () => { rightHoledGeo?.dispose(); };
  }, [rightHoledGeo]);

  // Left jaw is fixed to the left L-bracket. Right jaw uses the shared
  // rightJawCenterX helper — same source of truth as ViseModel's bracket
  // carriage AND useJawProfile's CSG bake position. No drift possible.
  const { centerY, leftXOff, rightXOff, renderFace, labelSize } = useMemo(() => {
    const baseY     = jawBaseH(viseConfig.jawHeight);
    const innerX    = bracketInnerX(viseConfig);
    const fixedXOff = innerX - thickness / 2;

    return {
      centerY:    baseY + height / 2,
      leftXOff:   fixedXOff,
      rightXOff:  rightJawCenterX(viseConfig, jawBlank, activePart, clampGap),
      // Jaw face uses the user's jawBlank.face directly — does NOT clamp to
      // pillarFaceWidth(viseConfig). The jaw blank is a separate piece of
      // stock from the vise; changing vise jawWidth/jawHeight/jawStroke
      // should not silently resize the jaw. If `face` exceeds the bracket
      // pillar width, the jaw overhangs visibly — that's the correct cue
      // for the user to either widen the vise or narrow the jaw stock.
      renderFace: face,
      labelSize:  height * 0.09,
    };
  }, [viseConfig, jawBlank, face, height, thickness, activePart, clampGap]);

  const color = MATERIAL_COLORS[material] ?? DEFAULT_BLANK_COLOR;

  // Deactivate gizmo helper
  const deactivateGizmo = useCallback(() => {
    setActiveGizmoSide(null);
    setOrbitControlsEnabled(true);
    // Reset imperative scales and positions
    if (leftMeshRef.current) {
      leftMeshRef.current.scale.set(1, 1, 1);
      leftMeshRef.current.position.y = centerY;
      leftMeshRef.current.position.x = -leftXOff;
    }
    if (rightMeshRef.current) {
      rightMeshRef.current.scale.set(1, 1, 1);
      rightMeshRef.current.position.y = centerY;
      rightMeshRef.current.position.x = rightXOff;
    }
    if (leftLabelGroupRef.current) {
      leftLabelGroupRef.current.position.set(-leftXOff, centerY, 0);
      leftLabelGroupRef.current.children.forEach((child) => {
        child.position.y = height * 0.35;
      });
    }
    if (rightLabelGroupRef.current) {
      rightLabelGroupRef.current.position.set(rightXOff, centerY, 0);
      rightLabelGroupRef.current.children.forEach((child) => {
        child.position.y = height * 0.35;
      });
    }
  }, [centerY, leftXOff, rightXOff, height]);

  // Sync HUD input fields with store when values change from outside
  useEffect(() => {
    if (activeGizmoSide !== null && !jawBlank.isDragging) {
      setHudHeight(height.toFixed(1));
      setHudThickness(thickness.toFixed(1));
    }
  }, [height, thickness, activeGizmoSide, jawBlank.isDragging]);

  // Keyboard Escape listener
  useEffect(() => {
    if (activeGizmoSide === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        deactivateGizmo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGizmoSide, deactivateGizmo]);

  // Click-away listener
  useEffect(() => {
    if (activeGizmoSide === null) return;
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, [role="button"], [role="slider"]')) {
        deactivateGizmo();
      }
    };
    document.addEventListener('mousedown', handleDocumentClick, true);
    return () => document.removeEventListener('mousedown', handleDocumentClick, true);
  }, [activeGizmoSide, deactivateGizmo]);

  const handleDragStart = useCallback(() => {
    setOrbitControlsEnabled(false);
    dragStartHeight.current = height;
    dragStartCenterY.current = centerY;
    dragStartThickness.current = thickness;
    if (leftMeshRef.current) dragStartLeftX.current = leftMeshRef.current.position.x;
    if (rightMeshRef.current) dragStartRightX.current = rightMeshRef.current.position.x;

    setHudHeight(height.toFixed(1));
    setHudThickness(thickness.toFixed(1));
    useSoftJawsStore.getState().updateJawBlank({ isDragging: true });
  }, [height, thickness, centerY]);

  const handleDrag = useCallback((local: THREE.Matrix4) => {
    const tempPos = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    local.decompose(tempPos, tempQuat, tempScale);

    // Height (Y-axis)
    const newHeight = Math.max(10, Math.min(300, dragStartHeight.current + tempPos.y));
    const scaleY = newHeight / dragStartHeight.current;
    const newCenterY = dragStartCenterY.current + (newHeight - dragStartHeight.current) / 2;

    // Thickness (X-axis)
    const activeSign = activeGizmoSide!;
    const deltaT = -activeSign * tempPos.x;
    const newThickness = Math.max(5, Math.min(150, dragStartThickness.current + deltaT));
    const scaleX = newThickness / dragStartThickness.current;
    const actualDeltaT = newThickness - dragStartThickness.current;

    if (leftMeshRef.current) {
      leftMeshRef.current.scale.y = scaleY;
      leftMeshRef.current.position.y = newCenterY;
      leftMeshRef.current.scale.x = scaleX;
      leftMeshRef.current.position.x = dragStartLeftX.current + actualDeltaT / 2;
    }
    if (rightMeshRef.current) {
      rightMeshRef.current.scale.y = scaleY;
      rightMeshRef.current.position.y = newCenterY;
      rightMeshRef.current.scale.x = scaleX;
      rightMeshRef.current.position.x = dragStartRightX.current - actualDeltaT / 2;
    }

    if (leftLabelGroupRef.current && leftMeshRef.current) {
      leftLabelGroupRef.current.position.x = leftMeshRef.current.position.x;
      leftLabelGroupRef.current.position.y = leftMeshRef.current.position.y;
      leftLabelGroupRef.current.children.forEach((child) => {
        child.position.y = newHeight * 0.35;
      });
    }
    if (rightLabelGroupRef.current && rightMeshRef.current) {
      rightLabelGroupRef.current.position.x = rightMeshRef.current.position.x;
      rightLabelGroupRef.current.position.y = rightMeshRef.current.position.y;
      rightLabelGroupRef.current.children.forEach((child) => {
        child.position.y = newHeight * 0.35;
      });
    }

    setHudHeight(newHeight.toFixed(1));
    setHudThickness(newThickness.toFixed(1));
  }, [activeGizmoSide]);

  const handleDragEnd = useCallback(() => {
    let finalHeight = dragStartHeight.current;
    let finalThickness = dragStartThickness.current;
    if (leftMeshRef.current) {
      finalHeight = dragStartHeight.current * leftMeshRef.current.scale.y;
      finalThickness = dragStartThickness.current * leftMeshRef.current.scale.x;
      
      leftMeshRef.current.scale.set(1, 1, 1);
      leftMeshRef.current.position.y = centerY;
      leftMeshRef.current.position.x = -leftXOff;
    }
    if (rightMeshRef.current) {
      rightMeshRef.current.scale.set(1, 1, 1);
      rightMeshRef.current.position.y = centerY;
      rightMeshRef.current.position.x = rightXOff;
    }

    if (leftLabelGroupRef.current) {
      leftLabelGroupRef.current.position.set(-leftXOff, centerY, 0);
      leftLabelGroupRef.current.children.forEach((child) => {
        child.position.y = height * 0.35;
      });
    }
    if (rightLabelGroupRef.current) {
      rightLabelGroupRef.current.position.set(rightXOff, centerY, 0);
      rightLabelGroupRef.current.children.forEach((child) => {
        child.position.y = height * 0.35;
      });
    }

    // Keep remaining through-hole length constant
    const constantThroughLength = dragStartThickness.current - useSoftJawsStore.getState().mountingHoles.screwheadHeight;
    const newScrewheadHeight = Math.max(0, finalThickness - constantThroughLength);

    useSoftJawsStore.getState().updateJawBlank({ 
      height: parseFloat(finalHeight.toFixed(1)),
      thickness: parseFloat(finalThickness.toFixed(1)),
      isDragging: false 
    });

    useSoftJawsStore.getState().updateMountingHoles({
      screwheadHeight: parseFloat(newScrewheadHeight.toFixed(1))
    });

    setOrbitControlsEnabled(true);
  }, [centerY, leftXOff, rightXOff]);

  const handleHudSubmit = useCallback((heightStr: string, thicknessStr: string) => {
    const newH = parseFloat(heightStr);
    const newT = parseFloat(thicknessStr);
    
    const updates: any = {};
    if (!isNaN(newH) && newH >= 10 && newH <= 300) {
      updates.height = parseFloat(newH.toFixed(1));
    }
    if (!isNaN(newT) && newT >= 5 && newT <= 150) {
      updates.thickness = parseFloat(newT.toFixed(1));

      const currentThickness = useSoftJawsStore.getState().jawBlank.thickness;
      const currentScrewheadHeight = useSoftJawsStore.getState().mountingHoles.screwheadHeight;
      const constantThroughLength = currentThickness - currentScrewheadHeight;
      const newScrewheadHeight = Math.max(0, updates.thickness - constantThroughLength);
      
      useSoftJawsStore.getState().updateMountingHoles({
        screwheadHeight: parseFloat(newScrewheadHeight.toFixed(1))
      });
    }

    if (Object.keys(updates).length > 0) {
      useSoftJawsStore.getState().updateJawBlank({
        ...updates,
        isDragging: false
      });
      deactivateGizmo();
    }
  }, [deactivateGizmo]);

  const handleInputChangeHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHudHeight(e.target.value);
  };

  const handleInputChangeThickness = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHudThickness(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleHudSubmit(hudHeight, hudThickness);
    } else if (e.key === 'Escape') {
      deactivateGizmo();
    }
  };

  const handleInputBlur = () => {
    handleHudSubmit(hudHeight, hudThickness);
  };

  return (
    <group onPointerMissed={deactivateGizmo}>
      {JAWS.map(({ sign, label }) => {
        const xOffset = sign === -1 ? leftXOff : rightXOff;
        const x       = sign * xOffset;
        const halfFace = renderFace / 2;
        const labelEps = 0.08;
        const holedGeo = sign === -1 ? leftHoledGeo : rightHoledGeo;
        const meshRef = sign === -1 ? leftMeshRef : rightMeshRef;
        const isGizmoActive = activeGizmoSide === sign;

        return (
          <group key={sign}>

            {holedGeo ? (
              /*
               * Drilled blank — geometry is now cached in LOCAL frame (centred
               * at origin). Apply the world position via mesh.position so we
               * can re-position the blank as viseConfig / activePart / clampGap
               * change WITHOUT re-running CSG. This is the key win of the
               * local-frame cache strategy: position changes are free.
               *
               * `<primitive attach="geometry">` (not geometry={obj} prop)
               * guarantees r3f sets the geometry during the same commit step
               * as the mesh, avoiding the race where drei's <Edges> mounted
               * with parent.geometry still undefined.
               *
               * No <Edges> here — three-bvh-csg's output has hundreds of
               * stitching triangles whose face-normal noise trips
               * EdgesGeometry's dihedral threshold and paints diagonal scratch
               * lines across the blank. Flat shading reads cleanly on its own.
               */
              <mesh
                ref={meshRef}
                position={[x, centerY, 0]}
                castShadow
                receiveShadow
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setActiveGizmoSide(sign);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'auto';
                }}
              >
                <primitive object={holedGeo} attach="geometry" />
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
              </mesh>
            ) : (
              /* Raw stock blank */
              <mesh
                ref={meshRef}
                position={[x, centerY, 0]}
                castShadow
                receiveShadow
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setActiveGizmoSide(sign);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'auto';
                }}
              >
                <boxGeometry args={[thickness, height, renderFace]} />
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
                <Edges color="#08090c" lineWidth={1} threshold={15} />
              </mesh>
            )}

            {/* ── Laser-etched ID label — top-outer corner of each ±Z face ── */}
            <group ref={sign === -1 ? leftLabelGroupRef : rightLabelGroupRef} position={[x, centerY, 0]}>
              {[1, -1].map((zSide) => (
                <Text
                  key={zSide}
                  position={[
                    0,
                    height * 0.35,
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
            </group>

            {/* Height/Length Adjustment Gizmo (X & Y Translation) */}
            {isGizmoActive && (
              <group position={[x, centerY + height / 2, 0]}>
                <PivotControls
                  activeAxes={[true, true, false]}
                  disableRotations={true}
                  disableScaling={true}
                  scale={35}
                  lineWidth={3.5}
                  depthTest={false}
                  fixed={false}
                  onDragStart={handleDragStart}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                />
                
                {/* Floating CAD HUD Numeric Entry Overlay */}
                <Html position={[0, 0.4, 0]} center style={{ pointerEvents: 'auto', userSelect: 'none' }}>
                  <div className="flex items-center gap-2 bg-slate-950/85 text-white border border-slate-700/60 px-2 py-1 rounded-md shadow-2xl font-tech text-xs select-none backdrop-blur-sm tech-glass min-w-[170px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground/80 uppercase font-semibold">H:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={hudHeight}
                        onChange={handleInputChangeHeight}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        onFocus={() => setOrbitControlsEnabled(false)}
                        className="w-12 bg-black/40 border border-slate-700/80 text-white text-right px-1 py-0.5 rounded text-[10px] outline-none focus:ring-1 focus:ring-primary/40 font-tech"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground/80 uppercase font-semibold">L:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={hudThickness}
                        onChange={handleInputChangeThickness}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        onFocus={() => setOrbitControlsEnabled(false)}
                        className="w-12 bg-black/40 border border-slate-700/80 text-white text-right px-1 py-0.5 rounded text-[10px] outline-none focus:ring-1 focus:ring-primary/40 font-tech"
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground/60">mm</span>
                    <button 
                      onClick={deactivateGizmo} 
                      className="ml-1 hover:text-red-400 text-muted-foreground transition-colors cursor-pointer text-[10px] leading-none"
                    >
                      ✕
                    </button>
                  </div>
                </Html>
              </group>
            )}

          </group>
        );
      })}
    </group>
  );
}
