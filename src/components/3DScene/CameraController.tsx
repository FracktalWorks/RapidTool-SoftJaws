/**
 * CameraController — Fits the orthographic camera to frame all scene content
 * and handles view-orientation snapping from the header buttons.
 *
 * Lives inside the R3F Canvas so it has access to useThree().
 *
 * Triggers:
 *   1. On mount (once controls are ready) — frames the vise so users see it immediately.
 *   2. When parts are added — re-frames to include the imported workpiece.
 *   3. 'set-view-orientation' window events — snaps to front/back/left/right/top/iso.
 *
 * Fit strategy:
 *   1. Build a unified Box3: vise body + end caps + jaw blank + part extents.
 *   2. Compute zoom so the scene fills ~55% of the smaller viewport dimension.
 *   3. Move OrbitControls target to box center, update projection matrix.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSoftJawsStore } from '@/stores/softJawsStore';
import { useViseStore } from '@/stores/viseStore';
import {
  jawBaseH,
  bracketInnerX,
  viseBodyLen,
  VISE_GEOMETRY,
} from '@/features/vise-config/data/presets';

// Fraction of viewport the scene should occupy after fit (lower = more padding)
const FIT_MARGIN = 0.55;

// ─── Scene bounding box ───────────────────────────────────────────────────────

function computeSceneBox(
  viseConfig: { jawWidth: number; jawHeight: number; jawStroke: number },
  jawBlank: { face: number; height: number; thickness: number },
  parts: { boundingBox: { min: [number, number, number]; max: [number, number, number] } }[],
  clampGap: number,
): THREE.Box3 {
  const box = new THREE.Box3();

  // ViseModel proportions — pulled from the single VISE_GEOMETRY source so the
  // camera fit can never drift from the rendered body.
  const baseLength  = viseBodyLen(viseConfig);
  const baseWidth   = viseConfig.jawWidth;
  const baseHeight  = jawBaseH(viseConfig.jawHeight);
  const totalHeight = baseHeight + viseConfig.jawHeight;

  // Pad both ±X for the protruding end caps.
  const endCapPad = baseLength * VISE_GEOMETRY.CAP_LEN_FRAC;
  box.union(new THREE.Box3(
    new THREE.Vector3(-baseLength / 2 - endCapPad, 0,           -baseWidth / 2),
    new THREE.Vector3( baseLength / 2 + endCapPad, totalHeight,  baseWidth / 2),
  ));

  // Jaw blank and parts sit on the rail surface, not the ground plane
  const baseH = jawBaseH(viseConfig.jawHeight);

  const innerX     = bracketInnerX(viseConfig);
  const fixedXOff  = innerX - jawBlank.thickness / 2;
  const activePart = parts[parts.length - 1]; // most-recently imported
  const adaptiveXOff = activePart
    ? Math.min(
        fixedXOff,
        (activePart.boundingBox.max[0] - activePart.boundingBox.min[0]) / 2 + clampGap + jawBlank.thickness / 2,
      )
    : fixedXOff;
  // Independent stock — see JawBlankMesh. Camera bbox should include the
  // jaw at its actual face dimension even if it overhangs the pillar.
  const blankFace = jawBlank.face;
  box.union(new THREE.Box3(
    new THREE.Vector3(-adaptiveXOff - jawBlank.thickness / 2, baseH,                   -blankFace / 2),
    new THREE.Vector3( adaptiveXOff + jawBlank.thickness / 2, baseH + jawBlank.height,  blankFace / 2),
  ));

  // Parts: centered in X/Z, sitting on rail surface
  for (const part of parts) {
    const { min, max } = part.boundingBox;
    const sx = (max[0] - min[0]) / 2;
    const sy =  max[1] - min[1];
    const sz = (max[2] - min[2]) / 2;
    box.union(new THREE.Box3(
      new THREE.Vector3(-sx, baseH,      -sz),
      new THREE.Vector3( sx, baseH + sy,  sz),
    ));
  }

  return box;
}

// ─── Camera fit ───────────────────────────────────────────────────────────────

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

  const vpSize = gl.getSize(new THREE.Vector2());

  // Fit X and Y independently so wide/flat scenes aren't penalised.
  // Each axis: world units that must fit = scene extent / FIT_MARGIN.
  const worldW   = Math.max(size.x, size.z, 1) / FIT_MARGIN; // viewport X ↔ scene X/Z
  const worldH   = Math.max(size.y, 1)         / FIT_MARGIN; // viewport Y ↔ scene Y
  const newZoom  = Math.min(vpSize.x / worldW, vpSize.y / worldH);

  // Reposition camera to isometric offset above scene center so OrbitControls
  // starts in the correct orientation (not below the scene).
  const dist = Math.max(size.x, size.y, size.z) * 2.5;
  const isoDir = new THREE.Vector3(1, 1, 1).normalize();
  camera.position.copy(center).addScaledVector(isoDir, dist);

  if (controls && typeof controls.target?.copy === 'function') {
    controls.target.copy(center);
    controls.update();
  }

  const orthoCam = camera as THREE.OrthographicCamera;
  orthoCam.zoom = newZoom;
  orthoCam.updateProjectionMatrix();
}

// ─── View orientation snap ────────────────────────────────────────────────────

function snapToOrientation(
  orientation: string,
  camera: THREE.Camera,
  controls: any,
  sceneCenter: THREE.Vector3,
) {
  // Distance from target — for orthographic the magnitude only needs to be
  // large enough to avoid clipping; zoom controls the visible scale.
  const dist = 800;

  let offset: THREE.Vector3;
  switch (orientation) {
    case 'front':  offset = new THREE.Vector3(0,       dist * 0.1,  dist);   break;
    case 'back':   offset = new THREE.Vector3(0,       dist * 0.1, -dist);   break;
    case 'left':   offset = new THREE.Vector3(-dist,   dist * 0.1,  0);      break;
    case 'right':  offset = new THREE.Vector3( dist,   dist * 0.1,  0);      break;
    case 'top':    offset = new THREE.Vector3(0,        dist,        0.01);  break; // tiny Z avoids gimbal
    case 'iso':
    default:       offset = new THREE.Vector3(dist * 0.65, dist * 0.65, dist * 0.65); break;
  }

  camera.position.copy(sceneCenter).add(offset);

  if (controls && typeof controls.target?.copy === 'function') {
    controls.target.copy(sceneCenter);
    controls.update();
  }

  (camera as THREE.OrthographicCamera).updateProjectionMatrix();
}

// ─── CameraController ─────────────────────────────────────────────────────────

export function CameraController() {
  const { camera, gl, controls } = useThree();
  const parts      = useSoftJawsStore((s) => s.parts);
  const jawBlank   = useSoftJawsStore((s) => s.jawBlank);
  const viseConfig = useViseStore((s) => s.viseConfig);
  const clampGap   = useSoftJawsStore((s) => s.clampGap);

  const prevCountRef  = useRef<number>(parts.length);
  const hasInitFitted = useRef(false);

  // Memoise the current scene center so the orientation handler is stable
  const getSceneCenter = useCallback(() => {
    const box = computeSceneBox(viseConfig, jawBlank, parts, clampGap);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }, [viseConfig, jawBlank, parts]);

  // ── Initial fit: wait until OrbitControls are mounted ──────────────────
  useEffect(() => {
    // controls is null on the very first render (OrbitControls not yet mounted).
    // Guard here so we only run once controls is available.
    if (!controls || hasInitFitted.current) return;
    hasInitFitted.current = true;

    const t = setTimeout(() => {
      const box = computeSceneBox(viseConfig, jawBlank, parts, clampGap);
      fitCameraToBox(box, camera, gl, controls);
    }, 80);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]); // intentionally only on controls becoming available

  // ── Re-fit when new parts are imported ───────────────────────────────────
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = parts.length;

    if (parts.length === 0 || parts.length <= prevCount) return;

    const box = computeSceneBox(viseConfig, jawBlank, parts, clampGap);
    fitCameraToBox(box, camera, gl, controls);
  }, [parts, viseConfig, jawBlank, camera, gl, controls]);

  // ── Re-fit when vise dimensions change (after initial fit has run) ───────
  // Debounced so dragging a numeric input doesn't thrash the camera every tick.
  useEffect(() => {
    if (!controls || !hasInitFitted.current) return;

    const t = setTimeout(() => {
      const box = computeSceneBox(viseConfig, jawBlank, parts, clampGap);
      fitCameraToBox(box, camera, gl, controls);
    }, 150);

    return () => clearTimeout(t);
    // Intentionally keyed on vise/blank dimensions only — parts changes are
    // handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viseConfig.jawWidth, viseConfig.jawHeight, viseConfig.jawStroke,
    jawBlank.face, jawBlank.height, jawBlank.thickness,
  ]);

  // ── View orientation snapping (header buttons) ────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const orientation = (e as CustomEvent<string>).detail;
      if (!orientation) return;
      const center = getSceneCenter();
      snapToOrientation(orientation, camera, controls, center);
    };

    window.addEventListener('set-view-orientation', handler);
    return () => window.removeEventListener('set-view-orientation', handler);
  }, [camera, controls, getSceneCenter]);

  return null;
}
