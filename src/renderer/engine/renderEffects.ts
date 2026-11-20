/**
 * Canvas pixel pipeline for color grade, filters, glitch, vignette, masks, etc.
 * Shared by live preview (TimelineEngine) and export (exportTimeline).
 */

import type { ClipEffects, Region } from './types';

function clamp(v: number, min = 0, max = 255) {
  return v < min ? min : v > max ? max : v;
}

/** Full color grade pass on ImageData */
export function applyColorGrade(data: Uint8ClampedArray, fx: ClipEffects) {
  const brightness = (fx.brightness || 0) * 255 + (fx.exposure || 0) * 40;
  const contrast = (fx.contrast || 0) + 1;
  const saturation = (fx.saturation || 0) + 1;
  const temperature = fx.temperature || 0;
  const tint = fx.tint || 0;
  const shadows = fx.shadows || 0;
  const highlights = fx.highlights || 0;

  const hasWork =
    brightness ||
    contrast !== 1 ||
    saturation !== 1 ||
    temperature ||
    tint ||
    shadows ||
    highlights;
  if (!hasWork) return;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure / brightness
    r += brightness;
    g += brightness;
    b += brightness;

    // Contrast around mid gray
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Temperature (blue↔yellow) & tint (green↔magenta)
    r += temperature * 25 - tint * 10;
    g += tint * 20;
    b -= temperature * 25 + tint * 10;

    // Saturation
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    // Simple shadows / highlights lift
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum < 0.5 && shadows) {
      const t = (0.5 - lum) * 2 * shadows * 40;
      r += t;
      g += t;
      b += t;
    }
    if (lum > 0.5 && highlights) {
      const t = (lum - 0.5) * 2 * highlights * 40;
      r += t;
      g += t;
      b += t;
    }

    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
}

export function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (!amount) return;
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * (0.35 - amount * 0.15),
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, amount * 0.85)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export function applyMosaic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  regions: Region[]
) {
  if (!regions?.length) return;
  const block = 14;
  for (const region of regions) {
    const rx = Math.floor(region.x * width);
    const ry = Math.floor(region.y * height);
    const rw = Math.floor(region.w * width);
    const rh = Math.floor(region.h * height);
    for (let y = ry; y < ry + rh; y += block) {
      for (let x = rx; x < rx + rw; x += block) {
        const bw = Math.min(block, rx + rw - x);
        const bh = Math.min(block, ry + rh - y);
        try {
          const sample = ctx.getImageData(x, y, 1, 1).data;
          ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
          ctx.fillRect(x, y, bw, bh);
        } catch {
          /* ignore */
        }
      }
    }
  }
}

/** RGB channel shift + scanline glitch */
export function applyGlitch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  timeSec = 0
) {
  if (intensity <= 0) return;
  try {
    const img = ctx.getImageData(0, 0, width, height);
    const d = img.data;
    const shift = Math.floor(intensity * 12 + Math.sin(timeSec * 8) * intensity * 6);
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < height; y++) {
      const lineJitter =
        Math.random() < intensity * 0.08 ? Math.floor((Math.random() - 0.5) * intensity * 40) : 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const sxR = Math.min(width - 1, Math.max(0, x + shift + lineJitter));
        const sxB = Math.min(width - 1, Math.max(0, x - shift + lineJitter));
        const iR = (y * width + sxR) * 4;
        const iB = (y * width + sxB) * 4;
        d[i] = copy[iR];
        d[i + 2] = copy[iB + 2];
        // scanlines
        if (y % 3 === 0) {
          d[i] *= 1 - intensity * 0.15;
          d[i + 1] *= 1 - intensity * 0.15;
          d[i + 2] *= 1 - intensity * 0.15;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* tainted canvas */
  }
}

/** Horizontal wave distortion */
export function applyDistortion(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  timeSec = 0
) {
  if (intensity <= 0) return;
  try {
    const src = ctx.getImageData(0, 0, width, height);
    const out = ctx.createImageData(width, height);
    const s = src.data;
    const d = out.data;
    const amp = intensity * 18;
    const freq = 0.025 + intensity * 0.02;
    for (let y = 0; y < height; y++) {
      const offset = Math.floor(Math.sin(y * freq + timeSec * 3) * amp);
      for (let x = 0; x < width; x++) {
        const sx = Math.min(width - 1, Math.max(0, x + offset));
        const si = (y * width + sx) * 4;
        const di = (y * width + x) * 4;
        d[di] = s[si];
        d[di + 1] = s[si + 1];
        d[di + 2] = s[si + 2];
        d[di + 3] = s[si + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  } catch {
    /* */
  }
}

/** Simple sharpen convolution */
export function applySharpen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) return;
  try {
    const img = ctx.getImageData(0, 0, width, height);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;
    const a = amount * 0.6;
    const center = 1 + 4 * a;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v =
            src[i + c] * center -
            src[((y - 1) * width + x) * 4 + c] * a -
            src[((y + 1) * width + x) * 4 + c] * a -
            src[(y * width + (x - 1)) * 4 + c] * a -
            src[(y * width + (x + 1)) * 4 + c] * a;
          d[i + c] = clamp(v);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* */
  }
}

/** Edge enhance / outline */
export function applyEdge(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) return;
  try {
    const img = ctx.getImageData(0, 0, width, height);
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        let sum = 0;
        for (let c = 0; c < 3; c++) {
          const gx =
            -src[((y - 1) * width + (x - 1)) * 4 + c] +
            src[((y - 1) * width + (x + 1)) * 4 + c] -
            2 * src[(y * width + (x - 1)) * 4 + c] +
            2 * src[(y * width + (x + 1)) * 4 + c] -
            src[((y + 1) * width + (x - 1)) * 4 + c] +
            src[((y + 1) * width + (x + 1)) * 4 + c];
          const gy =
            -src[((y - 1) * width + (x - 1)) * 4 + c] -
            2 * src[((y - 1) * width + x) * 4 + c] -
            src[((y - 1) * width + (x + 1)) * 4 + c] +
            src[((y + 1) * width + (x - 1)) * 4 + c] +
            2 * src[((y + 1) * width + x) * 4 + c] +
            src[((y + 1) * width + (x + 1)) * 4 + c];
          sum += Math.sqrt(gx * gx + gy * gy);
        }
        const edge = clamp(sum / 3);
        const mix = amount;
        d[i] = clamp(src[i] * (1 - mix) + edge * mix);
        d[i + 1] = clamp(src[i + 1] * (1 - mix) + edge * mix);
        d[i + 2] = clamp(src[i + 2] * (1 - mix) + edge * mix);
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* */
  }
}

export function applyGlow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = amount * 0.35;
  ctx.filter = `blur(${4 + amount * 12}px)`;
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

export function applyMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fx: ClipEffects
) {
  if (!fx.maskEnabled || fx.maskType === 'none') return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  const feather = fx.maskFeather || 0.1;
  if (fx.maskType === 'circle') {
    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * (0.35 - feather * 0.2),
      width / 2,
      height / 2,
      Math.min(width, height) * 0.5
    );
    g.addColorStop(0, '#fff');
    g.addColorStop(1, '#0000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  } else if (fx.maskType === 'rect') {
    const m = width * 0.08;
    ctx.fillStyle = '#fff';
    ctx.fillRect(m, m, width - m * 2, height - m * 2);
  }
  ctx.restore();
  if (fx.maskInvert) {
    // not fully inverted without extra buffer — approximate by darkening outside already handled
  }
}

/**
 * Run the full post-process stack on the current canvas content.
 */
export function applyPostFx(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fx: ClipEffects,
  timeSec = 0
) {
  // Pixel color grade
  const needsPixels =
    fx.brightness ||
    fx.contrast ||
    fx.saturation ||
    fx.exposure ||
    fx.temperature ||
    fx.tint ||
    fx.shadows ||
    fx.highlights ||
    fx.glitch ||
    fx.distortion ||
    fx.sharpen ||
    fx.edge;

  if (needsPixels) {
    try {
      const img = ctx.getImageData(0, 0, width, height);
      applyColorGrade(img.data, fx);
      ctx.putImageData(img, 0, 0);
    } catch {
      /* */
    }
  }

  if (fx.sharpen) applySharpen(ctx, width, height, fx.sharpen);
  if (fx.edge) applyEdge(ctx, width, height, fx.edge);
  if (fx.glitch) applyGlitch(ctx, width, height, fx.glitch, timeSec);
  if (fx.distortion) applyDistortion(ctx, width, height, fx.distortion, timeSec);
  if (fx.mosaicRegions?.length) applyMosaic(ctx, width, height, fx.mosaicRegions);
  if (fx.glow) applyGlow(ctx, width, height, fx.glow);
  if (fx.vignette) applyVignette(ctx, width, height, fx.vignette);
  if (fx.maskEnabled) applyMask(ctx, width, height, fx);
}
