export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

function detectQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 'medium';

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext(
        'experimental-webgl',
      )) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL,
        ) as string;
        if (/intel/i.test(renderer) && !/iris/i.test(renderer)) return 'low';
        if (/radeon|geforce|nvidia/i.test(renderer)) return 'high';
      }
    }
  } catch {
    // ignore WebGL detection errors
  }

  const cores = navigator.hardwareConcurrency ?? 2;
  if (cores <= 2) return 'low';
  if (cores <= 4) return 'medium';
  if (cores <= 8) return 'high';
  return 'ultra';
}

const quality = detectQuality();

export const performanceSettings = {
  quality,
  shadows: quality !== 'low',
  antialias: quality !== 'low',
  pixelRatio:
    quality === 'low'
      ? 1
      : quality === 'medium'
        ? 1.5
        : window.devicePixelRatio,
  maxGeometryVertices:
    quality === 'low'
      ? 50_000
      : quality === 'medium'
        ? 200_000
        : 1_000_000,
} as const;
