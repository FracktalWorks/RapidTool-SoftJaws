/**
 * JawBlankMesh — Renders the TWO soft-jaw blanks bolted to the L-bracket
 * fixed end-stops on the vise.
 *
 * Axis mapping:
 *   thickness → X (clamping direction)
 *   height    → Y vertical
 *   face      → Z (along the jaw face)
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { Edges, Text, PivotControls } from '@react-three/drei';
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
import { setOrbitControlsEnabled, resetPivotMatrix } from '@rapidtool/cad-core';

const MATERIAL_COLORS: Record<string, string> = {
  'aluminum-6061': '#3a4048',
  'aluminum-7075': '#2f353c',
  'steel-mild':    '#2a2f36',
  'steel-4140':    '#22272e',
  'brass':         '#a07b2a',
  'nylon':         '#7a6238',
};

const DEFAULT_BLANK_COLOR = '#353a42';
const LABEL_COLOR = '#cfd2d7';

const JAWS = [
  { sign: -1 as const, label: 'LEFT'  },
  { sign:  1 as const, label: 'RIGHT' },
];

export function JawBlankMesh() {
  const jawBlank        = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig      = useViseStore((s) => s.viseConfig);
  const jawProfile      = useSoftJawsStore((s) => s.jawProfile);
  const holesGenerated  = useSoftJawsStore((s) => s.mountingHoles.generated);
  const activePart      = useSoftJawsStore((s) => {
    const id = s.activePart;
    return id ? (s.parts.find((p) => p.id === id) ?? null) : null;
  });

  const [activeGizmoSide, setActiveGizmoSide] = useState<-1 | 1 | null>(null);
  const pivotRef = useRef<THREE.Group>(null);

  const leftMeshRef = useRef<THREE.Mesh>(null);
  const rightMeshRef = useRef<THREE.Mesh>(null);
  const leftLabelGroupRef = useRef<THREE.Group>(null);
  const rightLabelGroupRef = useRef<THREE.Group>(null);

  const dragStartHeight = useRef<number>(0);
  const dragStartCenterY = useRef<number>(0);
  const dragStartThickness = useRef<number>(0);
  const dragStartLeftX = useRef<number>(0);
  const dragStartRightX = useRef<number>(0);

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

  useEffect(() => {
    return () => { leftHoledGeo?.dispose(); };
  }, [leftHoledGeo]);
  useEffect(() => {
    return () => { rightHoledGeo?.dispose(); };
  }, [rightHoledGeo]);

  const baseY = useMemo(() => jawBaseH(viseConfig.jawHeight), [viseConfig.jawHeight]);
  const innerX = useMemo(() => bracketInnerX(viseConfig), [viseConfig]);
  const leftXOff = useMemo(() => innerX - jawBlank.left.thickness / 2, [innerX, jawBlank.left.thickness]);
  const rightXOff = useMemo(() => rightJawCenterX(viseConfig, jawBlank, activePart, jawProfile), [viseConfig, jawBlank, activePart, jawProfile]);

  const leftCenterY = useMemo(() => baseY + jawBlank.left.height / 2, [baseY, jawBlank.left.height]);
  const rightCenterY = useMemo(() => baseY + jawBlank.right.height / 2, [baseY, jawBlank.right.height]);

  const color = MATERIAL_COLORS[jawBlank.material] ?? DEFAULT_BLANK_COLOR;

  const deactivateGizmo = useCallback(() => {
    setActiveGizmoSide(null);
    setOrbitControlsEnabled(true);

    if (pivotRef.current) {
      resetPivotMatrix(pivotRef.current);
    }

    if (leftMeshRef.current) {
      leftMeshRef.current.scale.set(1, 1, 1);
      leftMeshRef.current.position.y = leftCenterY;
      leftMeshRef.current.position.x = -leftXOff;
    }
    if (rightMeshRef.current) {
      rightMeshRef.current.scale.set(1, 1, 1);
      rightMeshRef.current.position.y = rightCenterY;
      rightMeshRef.current.position.x = rightXOff;
    }
    if (leftLabelGroupRef.current) {
      leftLabelGroupRef.current.position.set(-leftXOff, leftCenterY, 0);
      leftLabelGroupRef.current.children.forEach((child) => {
        child.position.y = jawBlank.left.height * 0.35;
      });
    }
    if (rightLabelGroupRef.current) {
      rightLabelGroupRef.current.position.set(rightXOff, rightCenterY, 0);
      rightLabelGroupRef.current.children.forEach((child) => {
        child.position.y = jawBlank.right.height * 0.35;
      });
    }
  }, [leftCenterY, rightCenterY, leftXOff, rightXOff, jawBlank.left.height, jawBlank.right.height]);

  useEffect(() => {
    if (activeGizmoSide === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deactivateGizmo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGizmoSide, deactivateGizmo]);

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
    const side = activeGizmoSide === -1 ? 'left' : 'right';
    const dims = useSoftJawsStore.getState().jawBlank[side];

    dragStartHeight.current = dims.height;
    dragStartThickness.current = dims.thickness;
    dragStartCenterY.current = side === 'left' ? leftCenterY : rightCenterY;

    if (leftMeshRef.current) dragStartLeftX.current = leftMeshRef.current.position.x;
    if (rightMeshRef.current) dragStartRightX.current = rightMeshRef.current.position.x;

    useSoftJawsStore.getState().updateJawBlank({ isDragging: true });
  }, [activeGizmoSide, leftCenterY, rightCenterY]);

  const handleDrag = useCallback((local: THREE.Matrix4) => {
    const tempPos = new THREE.Vector3();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    local.decompose(tempPos, tempQuat, tempScale);

    const newHeight = Math.max(10, Math.min(300, dragStartHeight.current + tempPos.y));
    const scaleY = newHeight / dragStartHeight.current;
    const newCenterY = dragStartCenterY.current + (newHeight - dragStartHeight.current) / 2;

    const activeSign = activeGizmoSide!;
    // Gizmo is positioned at the inner-top edge, so dragging it by dx exactly maps to changing thickness by dx.
    const deltaT = -activeSign * tempPos.x;
    const newThickness = Math.max(5, Math.min(150, dragStartThickness.current + deltaT));
    const scaleX = newThickness / dragStartThickness.current;
    const actualDeltaT = newThickness - dragStartThickness.current;

    const linkJaws = useSoftJawsStore.getState().jawBlank.linkJaws;

    const updateMesh = (
      mesh: THREE.Mesh | null,
      labelGroup: THREE.Group | null,
      dragStartX: number,
      signVal: number
    ) => {
      if (!mesh) return;
      mesh.scale.y = scaleY;
      mesh.position.y = newCenterY;
      mesh.scale.x = scaleX;
      // Since the outer edge is fixed, changing thickness by actualDeltaT 
      // moves the center by actualDeltaT / 2 in the direction of the inner edge (-signVal).
      mesh.position.x = dragStartX - signVal * actualDeltaT / 2;

      if (labelGroup) {
        labelGroup.position.x = mesh.position.x;
        labelGroup.position.y = mesh.position.y;
        labelGroup.children.forEach((child) => {
          child.position.y = newHeight * 0.35;
        });
      }
    };

    if (activeGizmoSide === -1) {
      updateMesh(leftMeshRef.current, leftLabelGroupRef.current, dragStartLeftX.current, -1);
      if (linkJaws) {
        updateMesh(rightMeshRef.current, rightLabelGroupRef.current, dragStartRightX.current, 1);
      }
    } else {
      updateMesh(rightMeshRef.current, rightLabelGroupRef.current, dragStartRightX.current, 1);
      if (linkJaws) {
        updateMesh(leftMeshRef.current, leftLabelGroupRef.current, dragStartLeftX.current, -1);
      }
    }
  }, [activeGizmoSide]);

  const handleDragEnd = useCallback(() => {
    const side = activeGizmoSide === -1 ? 'left' : 'right';
    const linkJaws = useSoftJawsStore.getState().jawBlank.linkJaws;

    let finalHeight = dragStartHeight.current;
    let finalThickness = dragStartThickness.current;

    const activeMesh = activeGizmoSide === -1 ? leftMeshRef.current : rightMeshRef.current;
    if (activeMesh) {
      finalHeight = dragStartHeight.current * activeMesh.scale.y;
      finalThickness = dragStartThickness.current * activeMesh.scale.x;
    }

    if (pivotRef.current) {
      resetPivotMatrix(pivotRef.current);
    }

    const resetMesh = (
      mesh: THREE.Mesh | null,
      labelGroup: THREE.Group | null,
      startX: number,
      startCenterY: number,
      startH: number
    ) => {
      if (!mesh) return;
      mesh.scale.set(1, 1, 1);
      mesh.position.y = startCenterY;
      mesh.position.x = startX;
      if (labelGroup) {
        labelGroup.position.set(startX, startCenterY, 0);
        labelGroup.children.forEach((child) => {
          child.position.y = startH * 0.35;
        });
      }
    };

    resetMesh(leftMeshRef.current, leftLabelGroupRef.current, -leftXOff, leftCenterY, jawBlank.left.height);
    resetMesh(rightMeshRef.current, rightLabelGroupRef.current, rightXOff, rightCenterY, jawBlank.right.height);

    const updates: any = {};
    const value = {
      height: parseFloat(finalHeight.toFixed(1)),
      thickness: parseFloat(finalThickness.toFixed(1)),
    };

    if (linkJaws) {
      updates.left = value;
      updates.right = value;
    } else {
      updates[side] = value;
    }
    updates.isDragging = false;

    useSoftJawsStore.getState().updateJawBlank(updates);
    setOrbitControlsEnabled(true);
  }, [activeGizmoSide, leftCenterY, rightCenterY, leftXOff, rightXOff, jawBlank]);

  return (
    <group onPointerMissed={deactivateGizmo}>
      {JAWS.map(({ sign, label }) => {
        const side            = sign === -1 ? 'left' : 'right';
        const dims            = jawBlank[side];
        const thickness       = dims.thickness;
        const height          = dims.height;
        const face            = dims.face;
        const centerY         = sign === -1 ? leftCenterY : rightCenterY;
        const xOffset         = sign === -1 ? leftXOff : rightXOff;
        const x               = sign * xOffset;
        const halfFace        = face / 2;
        const labelEps        = 0.08;
        const holedGeo        = sign === -1 ? leftHoledGeo : rightHoledGeo;
        const meshRef         = sign === -1 ? leftMeshRef : rightMeshRef;
        const isGizmoActive   = activeGizmoSide === sign;
        const labelSize       = height * 0.09;

        return (
          <group key={sign}>
            {holedGeo ? (
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
                <boxGeometry args={[thickness, height, face]} />
                <meshStandardMaterial color={color} roughness={0.90} metalness={0.30} />
                <Edges color="#08090c" lineWidth={1} threshold={15} />
              </mesh>
            )}

            {/* Laser-etched ID label — top-outer corner of each ±Z face */}
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
              <group position={[x - sign * (thickness / 2), centerY + height / 2, 0]}>
                <PivotControls
                  ref={pivotRef}
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
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
