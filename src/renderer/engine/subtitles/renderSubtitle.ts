/**
 * Draw a subtitle cue onto a canvas context (preview + export burn-in).
 * Full Arabic RTL + diacritics support via canvas textDirection / font stack.
 */

import type { SubtitleCue, SubtitleStyle, SubtitleTrack } from './types';
import { resolveDirection, defaultSubtitleStyle } from './types';

export function activeCuesAt(track: SubtitleTrack, time: number): SubtitleCue[] {
  if (!track.visible) return [];
  return track.cues.filter((c) => time >= c.start && time < c.end);
}

export function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  track: SubtitleTrack,
  time: number,
  scale = 1 // relative to 1080p
) {
  const cues = activeCuesAt(track, time);
  if (!cues.length) return;

  const base = track.style || defaultSubtitleStyle();

  for (const cue of cues) {
    const style: SubtitleStyle = { ...base, ...(cue.style || {}) };
    const dir = resolveDirection(style, cue.text, cue.language);
    const fontSize = Math.max(14, style.fontSize * scale * (height / 1080));
    const weight = style.bold ? 700 : 400;
    const italic = style.italic ? 'italic' : 'normal';
    ctx.save();
    ctx.font = `${italic} ${weight} ${fontSize}px ${style.fontFamily}`;
    ctx.textAlign = style.align === 'left' ? 'left' : style.align === 'right' ? 'right' : 'center';
    ctx.direction = dir;
    ctx.textBaseline = 'middle';

    // Animation opacity
    let opacity = 1;
    const fadeDur = 0.25;
    if (style.animation === 'fade' || style.animation === 'pop') {
      const into = time - cue.start;
      const outof = cue.end - time;
      if (into < fadeDur) opacity = into / fadeDur;
      if (outof < fadeDur) opacity = Math.min(opacity, outof / fadeDur);
    }
    if (style.animation === 'pop') {
      const into = Math.min(1, (time - cue.start) / 0.2);
      const popScale = 0.92 + 0.08 * into;
      ctx.translate(width / 2, height * style.positionY);
      ctx.scale(popScale, popScale);
      ctx.translate(-width / 2, -height * style.positionY);
    }
    if (style.animation === 'slide-up') {
      const into = Math.min(1, (time - cue.start) / 0.3);
      const dy = (1 - into) * 24;
      ctx.translate(0, dy);
    }

    const lines = cue.text.split('\n');
    const lineHeight = fontSize * 1.35;
    const totalH = lines.length * lineHeight;
    const y0 = height * style.positionY - totalH / 2 + lineHeight / 2;

    let x = width / 2;
    if (style.align === 'left') x = width * 0.08;
    if (style.align === 'right') x = width * 0.92;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = y0 + i * lineHeight;
      const metrics = ctx.measureText(line);
      const tw = metrics.width;
      const padX = 16 * scale;
      const padY = 8 * scale;

      let bx = x - tw / 2 - padX;
      if (style.align === 'left') bx = x - padX;
      if (style.align === 'right') bx = x - tw - padX;

      // Background pill
      if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        ctx.globalAlpha = opacity;
        ctx.fillStyle = style.backgroundColor;
        const bw = tw + padX * 2;
        const bh = lineHeight * 0.92;
        roundRect(ctx, bx, y - bh / 2, bw, bh, 6 * scale);
        ctx.fill();
      }

      ctx.globalAlpha = opacity;

      // Outline / shadow
      if (style.shadow) {
        ctx.shadowColor = style.shadowColor;
        ctx.shadowBlur = 6 * scale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2 * scale;
      }
      if (style.outline && style.outlineWidth > 0) {
        ctx.lineWidth = style.outlineWidth * scale * 2;
        ctx.strokeStyle = style.outlineColor;
        ctx.strokeText(line, x, y);
      }
      ctx.fillStyle = style.color;
      ctx.fillText(line, x, y);
      ctx.shadowColor = 'transparent';
    }

    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
