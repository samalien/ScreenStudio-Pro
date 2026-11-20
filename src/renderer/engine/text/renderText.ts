/**
 * Canvas text rendering with rich styles, animations, RTL support.
 * Used by TimelineEngine preview and exportTimeline.
 */

import type {
  RichTextStyle,
  TextAnimation,
  TextAnimType,
  TextShadow,
  TextStroke,
  TextGradient,
  TextBackground,
} from './types';
import { DEFAULT_RICH_TEXT_STYLE, DEFAULT_TEXT_ANIMATION } from './types';
import { resolveDirection, containsRtlScript } from './fonts';

export interface TextRenderState {
  /** 0 = fully hidden / not started, 1 = fully visible */
  enterProgress: number;
  exitProgress: number; // 0 = not exiting, 1 = fully exited
  /** for typewriter */
  visibleChars?: number;
  /** opacity multiplier from animation */
  opacityMul: number;
  /** scale multiplier */
  scaleMul: number;
  /** translation in px */
  tx: number;
  ty: number;
  rotation: number;
  blur: number;
}

function ease(t: number, kind: string = 'ease-out'): number {
  t = Math.max(0, Math.min(1, t));
  switch (kind) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'spring':
      return 1 - Math.cos(t * Math.PI * 0.5) * Math.exp(-t * 4);
    case 'ease-out':
    default:
      return 1 - (1 - t) * (1 - t);
  }
}

/**
 * Compute animation state for a text clip at local time `t` (0..duration).
 */
export function evalTextAnimation(
  t: number,
  duration: number,
  anim: TextAnimation = DEFAULT_TEXT_ANIMATION(),
  textLength = 0
): TextRenderState {
  const state: TextRenderState = {
    enterProgress: 1,
    exitProgress: 0,
    opacityMul: 1,
    scaleMul: 1,
    tx: 0,
    ty: 0,
    rotation: 0,
    blur: 0,
  };

  const enterDur = Math.max(0.01, anim.enterDuration);
  const exitDur = Math.max(0.01, anim.exitDuration);
  const enterStart = anim.enterDelay || 0;
  const exitStart = Math.max(enterStart + enterDur, duration - exitDur);

  // Enter
  if (t < enterStart) {
    state.enterProgress = 0;
    applyAnim(state, anim.enter, 0, true);
  } else if (t < enterStart + enterDur) {
    const p = ease((t - enterStart) / enterDur, anim.easing);
    state.enterProgress = p;
    applyAnim(state, anim.enter, p, true);
  } else {
    state.enterProgress = 1;
  }

  // Exit
  if (t >= exitStart && duration > exitDur + 0.05) {
    const p = ease((t - exitStart) / exitDur, anim.easing);
    state.exitProgress = p;
    applyAnim(state, anim.exit, 1 - p, false);
  }

  // Typewriter
  if (anim.enter === 'typewriter' && textLength > 0) {
    const cps = anim.typewriterCps || 18;
    const chars = Math.floor(Math.max(0, t - enterStart) * cps);
    state.visibleChars = Math.min(textLength, chars);
  }

  return state;
}

function applyAnim(state: TextRenderState, type: TextAnimType, p: number, isEnter: boolean) {
  // p = 0 (start) → 1 (end of enter / full visible)
  switch (type) {
    case 'none':
      break;
    case 'fade':
      state.opacityMul *= p;
      break;
    case 'slide-up':
      state.ty += (1 - p) * (isEnter ? 60 : -60);
      state.opacityMul *= 0.3 + 0.7 * p;
      break;
    case 'slide-down':
      state.ty += (1 - p) * (isEnter ? -60 : 60);
      state.opacityMul *= 0.3 + 0.7 * p;
      break;
    case 'slide-left':
      state.tx += (1 - p) * (isEnter ? 80 : -80);
      state.opacityMul *= 0.3 + 0.7 * p;
      break;
    case 'slide-right':
      state.tx += (1 - p) * (isEnter ? -80 : 80);
      state.opacityMul *= 0.3 + 0.7 * p;
      break;
    case 'scale':
    case 'scale-up':
      state.scaleMul *= 0.4 + 0.6 * p;
      state.opacityMul *= p;
      break;
    case 'scale-down':
      state.scaleMul *= 1.4 - 0.4 * p;
      state.opacityMul *= p;
      break;
    case 'pop':
      state.scaleMul *= p < 0.7 ? 0.5 + (p / 0.7) * 0.7 : 1.2 - ((p - 0.7) / 0.3) * 0.2;
      state.opacityMul *= Math.min(1, p * 1.5);
      break;
    case 'bounce':
      state.ty += Math.sin(p * Math.PI) * -30 * (1 - p);
      state.scaleMul *= 0.7 + 0.3 * p;
      state.opacityMul *= p;
      break;
    case 'rotate-in':
      state.rotation += (1 - p) * (isEnter ? -25 : 25);
      state.opacityMul *= p;
      state.scaleMul *= 0.6 + 0.4 * p;
      break;
    case 'flip':
      state.scaleMul *= Math.max(0.01, Math.abs(Math.cos((1 - p) * Math.PI * 0.5)));
      state.opacityMul *= p;
      break;
    case 'blur-in':
      state.blur = (1 - p) * 12;
      state.opacityMul *= p;
      break;
    case 'glitch':
      state.tx += (Math.random() - 0.5) * (1 - p) * 20;
      state.ty += (Math.random() - 0.5) * (1 - p) * 8;
      state.opacityMul *= 0.5 + 0.5 * p;
      break;
    case 'wave':
    case 'rise':
      state.ty += (1 - p) * 40;
      state.opacityMul *= p;
      break;
    case 'typewriter':
      state.opacityMul *= 1;
      break;
    default:
      state.opacityMul *= p;
  }
}

/**
 * Draw rich text onto a canvas context.
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: Partial<RichTextStyle> | undefined,
  canvasW: number,
  canvasH: number,
  animState?: TextRenderState
): void {
  if (!text) return;
  const s: RichTextStyle = { ...DEFAULT_RICH_TEXT_STYLE(), ...style };
  const anim = animState || {
    enterProgress: 1,
    exitProgress: 0,
    opacityMul: 1,
    scaleMul: 1,
    tx: 0,
    ty: 0,
    rotation: 0,
    blur: 0,
  };

  if (anim.opacityMul <= 0.01) return;

  // Typewriter truncate
  let displayText = text;
  if (anim.visibleChars != null) {
    displayText = text.slice(0, anim.visibleChars);
  }

  // Transform
  if (s.textTransform === 'uppercase') displayText = displayText.toUpperCase();
  else if (s.textTransform === 'lowercase') displayText = displayText.toLowerCase();
  else if (s.textTransform === 'capitalize') {
    displayText = displayText.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const dir = resolveDirection(displayText, s.direction);
  const isRtl = dir === 'rtl';

  // Position
  let cx: number;
  let cy: number;
  if (s.positionMode === 'pixels') {
    cx = s.positionX;
    cy = s.positionY;
  } else {
    cx = canvasW / 2 + s.positionX * (canvasW / 2);
    cy = canvasH / 2 + s.positionY * (canvasH / 2);
  }
  cx += anim.tx;
  cy += anim.ty;

  const maxW = s.maxWidth
    ? s.maxWidth <= 1
      ? s.maxWidth * canvasW
      : s.maxWidth
    : canvasW * 0.9;

  ctx.save();
  ctx.translate(cx, cy);
  const totalRot = (s.rotation || 0) + anim.rotation;
  if (totalRot) ctx.rotate((totalRot * Math.PI) / 180);
  const sc = (s.scale || 1) * anim.scaleMul;
  if (sc !== 1) ctx.scale(sc, sc);
  ctx.globalAlpha = s.opacity * anim.opacityMul;

  if (anim.blur > 0.5) {
    ctx.filter = `blur(${anim.blur}px)`;
  }

  // Font
  const weight = s.fontWeight || 700;
  const fstyle = s.fontStyle === 'italic' ? 'italic ' : '';
  ctx.font = `${fstyle}${weight} ${s.fontSize}px ${s.fontFamily}`;
  ctx.direction = isRtl ? 'rtl' : 'ltr';
  ctx.textAlign = s.align === 'justify' ? 'left' : s.align;
  ctx.textBaseline = 'middle';

  // Word wrap
  const lines = wrapText(ctx, displayText, maxW, isRtl);
  const lineH = s.fontSize * s.lineHeight;
  const blockH = lines.length * lineH;

  let startY = 0;
  if (s.verticalAlign === 'middle') startY = -blockH / 2 + lineH / 2;
  else if (s.verticalAlign === 'bottom') startY = -blockH + lineH / 2;
  else startY = lineH / 2;

  // Background
  if (s.background?.enabled) {
    drawTextBackground(ctx, lines, s, startY, lineH, maxW, isRtl);
  }

  // Draw each line
  lines.forEach((line, i) => {
    const y = startY + i * lineH;
    let x = 0;
    if (s.align === 'center') x = 0;
    else if (s.align === 'left') x = isRtl ? maxW / 2 : -maxW / 2;
    else if (s.align === 'right') x = isRtl ? -maxW / 2 : maxW / 2;

    // Letter spacing via manual draw if needed
    if (s.letterSpacing && Math.abs(s.letterSpacing) > 0.1) {
      drawSpacedText(ctx, line, x, y, s, isRtl);
    } else {
      // Stroke
      if (s.stroke && s.stroke.width > 0) {
        ctx.strokeStyle = s.stroke.color;
        ctx.lineWidth = s.stroke.width * 2;
        ctx.lineJoin = s.stroke.join || 'round';
        ctx.strokeText(line, x, y);
      }
      // Shadow
      if (s.shadow && s.shadow.opacity > 0) {
        applyShadow(ctx, s.shadow);
      }
      // Fill (solid or gradient)
      if (s.gradient?.enabled && s.gradient.stops.length >= 2) {
        ctx.fillStyle = createGradient(ctx, s.gradient, maxW, s.fontSize);
      } else {
        ctx.fillStyle = s.color;
      }
      ctx.fillText(line, x, y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  });

  ctx.filter = 'none';
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  _isRtl: boolean
): string[] {
  // Simple word wrap (works reasonably for Arabic with spaces)
  const paragraphs = text.split(/\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const words = para.split(/(\s+)/);
    let current = '';
    for (const w of words) {
      const test = current + w;
      if (ctx.measureText(test).width > maxWidth && current.trim()) {
        lines.push(current.trimEnd());
        current = w.trimStart();
      } else {
        current = test;
      }
    }
    if (current) lines.push(current.trimEnd());
  }
  return lines.length ? lines : [''];
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  s: RichTextStyle,
  isRtl: boolean
) {
  const chars = Array.from(line); // handles surrogate pairs / some Arabic
  const totalExtra = s.letterSpacing * Math.max(0, chars.length - 1);
  let startX = x;
  if (s.align === 'center') startX = x - totalExtra / 2;
  else if (s.align === 'right') startX = isRtl ? x : x - totalExtra;
  else if (s.align === 'left') startX = isRtl ? x + totalExtra : x;

  if (s.stroke && s.stroke.width > 0) {
    ctx.strokeStyle = s.stroke.color;
    ctx.lineWidth = s.stroke.width * 2;
    ctx.lineJoin = 'round';
  }
  if (s.shadow && s.shadow.opacity > 0) applyShadow(ctx, s.shadow);
  ctx.fillStyle = s.color;

  let cx = startX;
  const dir = isRtl ? -1 : 1;
  // For RTL with letter-spacing we still draw left-to-right in array order;
  // browser handles shaping when using fillText on whole string preferably.
  // Fallback: draw whole string without spacing if RTL + spacing complex.
  if (isRtl) {
    if (s.stroke && s.stroke.width > 0) ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
    ctx.shadowColor = 'transparent';
    return;
  }
  for (const ch of chars) {
    if (s.stroke && s.stroke.width > 0) ctx.strokeText(ch, cx, y);
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + s.letterSpacing;
  }
  ctx.shadowColor = 'transparent';
}

function applyShadow(ctx: CanvasRenderingContext2D, shadow: TextShadow) {
  ctx.shadowColor = hexToRgba(shadow.color, shadow.opacity);
  ctx.shadowBlur = shadow.blur;
  ctx.shadowOffsetX = shadow.offsetX;
  ctx.shadowOffsetY = shadow.offsetY;
}

function createGradient(
  ctx: CanvasRenderingContext2D,
  g: TextGradient,
  w: number,
  h: number
): CanvasGradient {
  let grad: CanvasGradient;
  if (g.type === 'radial') {
    grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
  } else {
    const rad = ((g.angle || 0) * Math.PI) / 180;
    const x2 = Math.cos(rad) * w * 0.5;
    const y2 = Math.sin(rad) * h * 0.5;
    grad = ctx.createLinearGradient(-x2, -y2, x2, y2);
  }
  g.stops.forEach((st) => grad.addColorStop(st.offset, st.color));
  return grad;
}

function drawTextBackground(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  s: RichTextStyle,
  startY: number,
  lineH: number,
  maxW: number,
  isRtl: boolean
) {
  const bg = s.background!;
  ctx.save();
  ctx.globalAlpha *= bg.opacity;
  ctx.fillStyle = bg.color;

  if (bg.fullWidth) {
    const top = startY - lineH / 2 - bg.paddingY;
    const height = lines.length * lineH + bg.paddingY * 2;
    roundRect(ctx, -maxW / 2 - bg.paddingX, top, maxW + bg.paddingX * 2, height, bg.borderRadius);
    ctx.fill();
  } else {
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line);
      const w = metrics.width + bg.paddingX * 2;
      const h = lineH + bg.paddingY * 2;
      let x = -w / 2;
      if (s.align === 'left') x = isRtl ? maxW / 2 - w : -maxW / 2;
      if (s.align === 'right') x = isRtl ? -maxW / 2 : maxW / 2 - w;
      const y = startY + i * lineH - lineH / 2 - bg.paddingY;
      roundRect(ctx, x, y, w, h, bg.borderRadius);
      ctx.fill();
    });
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Convert legacy simple textStyle (from Clip) to RichTextStyle.
 */
export function legacyToRich(
  legacy?: {
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    backgroundColor?: string;
  } | null
): RichTextStyle {
  const base = DEFAULT_RICH_TEXT_STYLE();
  if (!legacy) return base;
  return {
    ...base,
    fontSize: legacy.fontSize ?? base.fontSize,
    color: legacy.color ?? base.color,
    fontFamily: legacy.fontFamily ?? base.fontFamily,
    background:
      legacy.backgroundColor && legacy.backgroundColor !== 'transparent'
        ? {
            enabled: true,
            color: legacy.backgroundColor,
            opacity: 0.75,
            paddingX: 16,
            paddingY: 8,
            borderRadius: 6,
          }
        : null,
  };
}
