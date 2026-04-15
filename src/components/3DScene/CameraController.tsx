/**
 * CameraController — Fits the orthographic camera to frame all scene content.
 *
 * Lives inside the R3F Canvas so it has access to useThree().
 *
 * Two trigger conditions:
 *   1. On initial mount — frames the vise so users have immediate 3D context.
 *   2. When parts increase — re-frames to include imported workpieces.
 *
 * Fit strategy:
 *   1. Build a unified Box3 from vise bounds + jaw blank + centered part bounds.
 *   2. Compute a zoom factor so the scene fills ~65% of the smaller viewport dimension.
 *   3. Move the OrbitControls target to the box center, update projection matrix.
 */

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';

// Fraction of the viewport the scene should occupy after fit
const FIT_MARGIN = 0.65;

// ─── Helper: compute scene bounding box ──────────────────────────────────────

function computeSceneBox(
  viseConfig: { jawWidth: number; jawHeight: number; jawStroke: number },
  jawBlank: { width: number; height: number; depth: number },
  parts: { boundingBox: { min: [number, number, number]; max: [number, number, number] } }[],
): THREE.Box3 {
  const box = new THREE.Box3();

  // Vise body bounds (procedural vise sits on Y=0, centered X/Z)
  const baseLength = viseConfig.jawStroke + viseConfig.jawWidth * 0.6;
  const baseWidth  = viseConfig.jawWidth;
  const totalH     = viseConfig.jawHeight * 0.5 + viseConfig.jawHeight; // base + jaw face

  box.union(new THREE.Box3(
    new THREE.Vector3(-baseLength / 2, 0,       -baseWidth / 2),
    new THREE.Vector3( baseLength / 2, totalH,   baseWidth / 2),
  ));

  // Jaw blank: centered in X/Z, sitting on Y = 0
  const hw = jawBlank.width  / 2;
  const hd = jawBlank.depth  / 2;
  box.union(new THREE.Box3(
    new THREE.Vector3(-hw, 0,               -hd),
    new THREE.Vector3( hw, jawBlank.height,  hd),
  ));

  // Parts: each is rendered centered at the origin
  for (const part of parts) {
    const { min, max } = part.boundingBox;
    const sx = max[0] - min[0];
    const sy = max[1] - min[1];
    const sz = max[2] - min[2];
    box.union(new THREE.Box3(
      new THREE.Vector3(-sx / 2, -sy / 2, -sz / 2),
      new THREE.Vector3( sx / 2,  sy / 2,  sz / 2),
    ));
  }

  return box;
}

// ─── Helper: apply fit to camera ─────────────────────────────────────────────

function fitCameraToBox(
  box: THREE.Box3,
  camera: THREE.Camera,
  gl: THREE.WebGLRenderer,
  controls: any,
) {
  const center = new THREE.Vector3();
  const size   = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const vpSize = gl.getSize(new THREE.Vector2());
  const aspect = vpSize.x / vpSize.y;

  const worldUnitsH = maxDim / FIT_MARGIN;
  const worldUnitsW = worldUnitsH * aspect;
  const newZoom = Math.min(vpSize.x / worldUnitsW, vpSize.y / worldUnitsH);

  (camera as THREE.OrthographicCamera).zoom = newZoom;
  camera.updateProjectionMatrix();

  if (controls && typeof controls.target?.copy === 'function') {
    controls.target.copy(center);
    controls.update();
  }
}

// ─── CameraController ────────────────────────────────────────────────────────

export function CameraController() {
  const { camera, gl, controls } = useThree();
  const parts      = useSoftJawsStore((s) => s.parts);
  const jawBlank   = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig = useSoftJawsStore((s) => s.viseConfig);

  const prevCountRef   = useRef<number>(parts.length);
  const hasInitFitted  = useRef(false);

  // ── Initial fit: frame the vise on mount ──────────────────────────────
  useEffect(() => {
    if (hasInitFitted.current) return;
    hasInitFitted.current = true;

    // Small delay to ensure OrbitControls are ready
    const t = setTimeout(() => {
      const box = computeSceneBox(viseConfig, jawBlank, parts);
      fitCameraToBox(box, camera, gl, controls as any);
    }, 100);

    return () => clearTimeout(t);
  }, [camera, gl, controls, viseConfig, jawBlank, parts]);

  // ── Re-fit when new parts are imported ────────────────────────────────
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = parts.length;

    if (parts.length === 0 || parts.length <= prevCount) return;

    const box = computeSceneBox(viseConfig, jawBlank, parts);
    fitCameraToBox(box, camera, gl, controls as any);
  }, [parts, viseConfig, jawBlank, camera, gl, controls]);

  return null;
}
