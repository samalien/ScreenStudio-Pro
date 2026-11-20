/**
 * Non-destructive color adjustments applied via canvas pixel or CSS filter.
 * Pure functions – no side effects.
 */

import type { ColorAdjustments } from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';

/** Clamp helper */
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Convert adjustments object into a CSS filter string (fast path for live preview).
 * Approximation – good enough for interactive UI. Final export can use pixel path.
 */
export function adjustmentsToCssFilter(adj: ColorAdjustments): string {
  const parts: string[] = [];

  // Exposure ≈ brightness + contrast boost
  const brightness = 1 + adj.brightness / 100 + adj.exposure * 0.25;
  const contrast = 1 + adj.contrast / 100 + Math.abs(adj.exposure) * 0.05;
  const saturate = 1 + adj.saturation / 100 + adj.vibrance / 200;
  const hue = adj.hue;

  parts.push(`brightness(${clamp(brightness, 0.1, 3).toFixed(3)})`);
  parts.push(`contrast(${clamp(contrast, 0.1, 3).toFixed(3)})`);
  parts.push(`saturate(${clamp(saturate, 0, 3).toFixed(3)})`);
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);

  // Temperature approximation via sepia + hue
  if (adj.temperature !== 0) {
    const t = adj.temperature / 100;
    if (t > 0) {
      // warmer
      parts.push(`sepia(${(t * 0.35).toFixed(3)})`);
      parts.push(`hue-rotate(${(-t * 15).toFixed(1)}deg)`);
    } else {
      // cooler
      parts.push(`hue-rotate(${(-t * 25).toFixed(1)}deg)`);
      parts.push(`saturate(${(1 + Math.abs(t) * 0.15).toFixed(3)})`);
    }
  }

  // Tint (green/magenta) – approximate with hue
  if (adj.tint !== 0) {
    parts.push(`hue-rotate(${(adj.tint * 0.4).toFixed(1)}deg)`);
  }

  return parts.join(' ');
}

/**
 * Apply adjustments on ImageData (pixel-perfect, used for final export / high quality).
 * Operates in-place on the ImageData.
 */
export function applyAdjustmentsToImageData(
  imageData: ImageData,
  adj: ColorAdjustments
): void {
  const data = imageData.data;
  const len = data.length;

  const brightness = adj.brightness / 100;
  const contrast = adj.contrast / 100;
  const saturation = adj.saturation / 100;
  const exposure = adj.exposure;
  const temperature = adj.temperature / 100;
  const tint = adj.tint / 100;
  const hue = (adj.hue * Math.PI) / 180;
  const vibrance = adj.vibrance / 100;
  const highlights = adj.highlights / 100;
  const shadows = adj.shadows / 100;

  // Precompute contrast factor
  const contrastFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure (multiplicative)
    const expMul = Math.pow(2, exposure);
    r *= expMul;
    g *= expMul;
    b *= expMul;

    // Brightness
    r += brightness * 255;
    g += brightness * 255;
    b += brightness * 255;

    // Contrast
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // Temperature (warm = more red/yellow, cool = more blue)
    if (temperature !== 0) {
      r += temperature * 30;
      b -= temperature * 30;
    }

    // Tint (green ↔ magenta)
    if (tint !== 0) {
      g += tint * 20;
      r -= tint * 10;
      b -= tint * 10;
    }

    // Saturation + Vibrance
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = 1 + saturation;
    const vib = 1 + vibrance * (1 - Math.abs(saturation)); // vibrance protects already saturated
    r = gray + (r - gray) * sat * vib;
    g = gray + (g - gray) * sat * vib;
    b = gray + (b - gray) * sat * vib;

    // Simple hue rotate (approx)
    if (hue !== 0) {
      const cos = Math.cos(hue);
      const sin = Math.sin(hue);
      const nr = r * (cos + (1 - cos) / 3) + g * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3) + b * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3);
      const ng = r * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3) + g * (cos + (1 - cos) / 3) + b * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3);
      const nb = r * ((1 - cos) / 3 - Math.sqrt(3) * sin / 3) + g * ((1 - cos) / 3 + Math.sqrt(3) * sin / 3) + b * (cos + (1 - cos) / 3);
      r = nr;
      g = ng;
      b = nb;
    }

    // Highlights / Shadows (very light curve)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 180 && highlights !== 0) {
      const f = 1 + highlights * 0.4;
      r = 180 + (r - 180) * f;
      g = 180 + (g - 180) * f;
      b = 180 + (b - 180) * f;
    } else if (lum < 70 && shadows !== 0) {
      const f = 1 + shadows * 0.4;
      r *= f;
      g *= f;
      b *= f;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
    // alpha untouched
  }
}

/** Merge two adjustment objects (for filter + user adjustments) */
export function mergeAdjustments(
  base: ColorAdjustments,
  over: Partial<ColorAdjustments>
): ColorAdjustments {
  return { ...base, ...over };
}

export function resetAdjustments(): ColorAdjustments {
  return { ...DEFAULT_ADJUSTMENTS };
}
