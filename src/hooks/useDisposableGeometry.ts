import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeGeometry, disposeMaterial } from '../utils/memoryMonitor';

/**
 * Returns a ref whose current geometry is automatically disposed when
 * the component unmounts or the geometry reference changes.
 */
export function useDisposableGeometry<T extends THREE.BufferGeometry>(
  geometry: T | null,
): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const prev = ref.current;
    ref.current = geometry;
    return () => {
      if (prev && prev !== geometry) {
        disposeGeometry(prev);
      }
    };
  }, [geometry]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (ref.current) {
        disposeGeometry(ref.current);
        ref.current = null;
      }
    };
  }, []);

  return ref;
}

/**
 * Returns a ref whose current material is automatically disposed on unmount.
 */
export function useDisposableMaterial<T extends THREE.Material>(
  material: T | null,
): React.MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const prev = ref.current;
    ref.current = material;
    return () => {
      if (prev && prev !== material) {
        disposeMaterial(prev);
      }
    };
  }, [material]);

  useEffect(() => {
    return () => {
      if (ref.current) {
        disposeMaterial(ref.current);
        ref.current = null;
      }
    };
  }, []);

  return ref;
}
