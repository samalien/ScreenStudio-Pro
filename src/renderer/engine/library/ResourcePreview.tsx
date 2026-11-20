/**
 * Live visual demos for every library resource kind.
 * Transitions, filters, effects, templates, fonts, stickers, audio, etc.
 * Plays in a loop on a canvas so the user sees the result before applying.
 * Uses IntersectionObserver so off-screen cards do not burn CPU.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { LibraryResource } from './types';

export type PreviewSize = 'thumb' | 'panel';

interface Props {
  resource: LibraryResource;
  size?: PreviewSize;
  /** Force pause when false */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const W_THUMB = 160;
const H_THUMB = 90;
const W_PANEL = 320;
const H_PANEL = 180;

export function ResourcePreview({ resource, size = 'thumb', active = true, className, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const [visible, setVisible] = useState(size === 'panel');

  const baseW = size === 'panel' ? W_PANEL : W_THUMB;
  const baseH = size === 'panel' ? H_PANEL : H_THUMB;

  // Pause when off-screen (grid performance)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || size === 'panel') {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting));
      },
      { root: null, rootMargin: '40px', threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active || !visible) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    canvas.width = baseW * dpr;
    canvas.height = baseH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    startRef.current = performance.now();
    const loop = (now: number) => {
      const t = (now - startRef.current) / 1000;
      drawDemo(ctx, baseW, baseH, resource, t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resource.id, resource.kind, resource.engineId, resource.color, resource.asset, resource.name, resource.category, resource.duration, baseW, baseH, active, visible]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        width: style?.width ?? (size === 'panel' ? '100%' : '100%'),
        height: style?.height ?? (size === 'panel' ? 180 : '100%'),
        borderRadius: size === 'panel' ? 10 : 8,
        overflow: 'hidden',
        background: '#0a0c10',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        width={baseW}
        height={baseH}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label={`Aperçu ${resource.name}`}
      />
    </div>
  );
}

/** Mini strip used on grid cards */
export function ResourcePreviewThumb({ resource }: { resource: LibraryResource }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden', borderRadius: 8 }}>
      <ResourcePreview resource={resource} size="thumb" style={{ width: '100%', height: '100%' }} />
      <KindBadge kind={resource.kind} />
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: 6,
        bottom: 6,
        fontSize: 9,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        background: 'rgba(0,0,0,0.65)',
        color: '#e8eaed',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      }}
    >
      {kind}
    </span>
  );
}

/* ───────────────── Drawing engines ───────────────── */

function drawDemo(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  ctx.clearRect(0, 0, w, h);
  const id = (res.engineId || res.id || '').toLowerCase();
  const kind = res.kind;

  if (kind === 'transition') {
    drawTransition(ctx, w, h, id, t, res.color);
    return;
  }
  if (kind === 'filter' || kind === 'effect') {
    drawFilterEffect(ctx, w, h, id, t, res.color, kind);
    return;
  }
  if (kind === 'animation') {
    drawTextAnimation(ctx, w, h, id, t, res.color);
    return;
  }
  if (kind === 'font') {
    drawFont(ctx, w, h, res, t);
    return;
  }
  if (kind === 'sticker' || kind === 'icon') {
    drawSticker(ctx, w, h, res, t);
    return;
  }
  if (kind === 'audio') {
    drawAudioWave(ctx, w, h, res, t);
    return;
  }
  if (kind === 'graphic') {
    drawGraphic(ctx, w, h, res, t);
    return;
  }
  drawTemplate(ctx, w, h, res, t);
}

function sceneA(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#1a3a5c');
  g.addColorStop(1, '#0d2137');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#4f8cff';
  roundRect(ctx, w * 0.15, h * 0.25, w * 0.35, h * 0.5, 8);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${Math.max(10, h * 0.12)}px Inter, system-ui, sans-serif`;
  ctx.fillText('A', w * 0.22, h * 0.55);
}

function sceneB(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#3b1d4a');
  g.addColorStop(1, '#1a0f24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f472b6';
  roundRect(ctx, w * 0.5, h * 0.25, w * 0.35, h * 0.5, 8);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = `600 ${Math.max(10, h * 0.12)}px Inter, system-ui, sans-serif`;
  ctx.fillText('B', w * 0.58, h * 0.55);
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: string,
  t: number,
  color?: string
) {
  const cycle = 2.4;
  const phase = t % cycle;
  let p = 0;
  if (phase < 0.4) p = 0;
  else if (phase < 1.2) p = (phase - 0.4) / 0.8;
  else if (phase < 1.6) p = 1;
  else p = 1 - (phase - 1.6) / 0.8;
  p = easeInOut(Math.max(0, Math.min(1, p)));

  const accent = color || '#4f8cff';

  if (id.includes('fade') || id.includes('dissolve') || id.includes('cross')) {
    sceneA(ctx, w, h);
    ctx.globalAlpha = p;
    sceneB(ctx, w, h);
    ctx.globalAlpha = 1;
  } else if (id.includes('wipe-left') || id.includes('wipe_l') || (id.includes('wipe') && id.includes('left'))) {
    sceneB(ctx, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * (1 - p), h);
    ctx.clip();
    sceneA(ctx, w, h);
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.fillRect(w * (1 - p) - 2, 0, 4, h);
  } else if (id.includes('wipe-right') || id.includes('wipe_r') || id.includes('wipe')) {
    sceneB(ctx, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(w * p, 0, w * (1 - p), h);
    ctx.clip();
    sceneA(ctx, w, h);
    ctx.restore();
    ctx.fillStyle = accent;
    ctx.fillRect(w * p - 2, 0, 4, h);
  } else if (id.includes('slide') || id.includes('push')) {
    ctx.save();
    ctx.translate(-w * p, 0);
    sceneA(ctx, w, h);
    ctx.restore();
    ctx.save();
    ctx.translate(w * (1 - p), 0);
    sceneB(ctx, w, h);
    ctx.restore();
  } else if (id.includes('zoom') || id.includes('scale')) {
    sceneA(ctx, w, h);
    ctx.save();
    const s = 0.6 + 0.4 * p;
    ctx.globalAlpha = p;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h / 2);
    sceneB(ctx, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  } else if (id.includes('circle') || id.includes('iris')) {
    sceneA(ctx, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.hypot(w, h) * 0.5 * p, 0, Math.PI * 2);
    ctx.clip();
    sceneB(ctx, w, h);
    ctx.restore();
  } else if (id.includes('blur')) {
    sceneA(ctx, w, h);
    ctx.globalAlpha = p;
    sceneB(ctx, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(255,255,255,${0.08 * Math.sin(p * Math.PI)})`;
    for (let i = 0; i < 6; i++) ctx.fillRect(0, (h / 6) * i, w, 2);
  } else if (id.includes('flash')) {
    sceneA(ctx, w, h);
    if (p > 0.35 && p < 0.65) {
      ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(p - 0.5) * 4})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (p >= 0.5) {
      ctx.globalAlpha = Math.min(1, (p - 0.5) * 2);
      sceneB(ctx, w, h);
      ctx.globalAlpha = 1;
    }
  } else {
    sceneA(ctx, w, h);
    ctx.globalAlpha = p;
    sceneB(ctx, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, h - 18, w, 18);
  ctx.fillStyle = '#fff';
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  ctx.fillText('A → B', 8, h - 6);
}

function drawFilterEffect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: string,
  t: number,
  color?: string,
  kind?: string
) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a4a6a');
  g.addColorStop(0.5, '#3d6b4f');
  g.addColorStop(1, '#8b5a2b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#e8c07a';
  ctx.beginPath();
  ctx.arc(w * 0.3, h * 0.4, h * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6ee7b7';
  roundRect(ctx, w * 0.55, h * 0.35, w * 0.3, h * 0.35, 6);
  ctx.fill();

  const pulse = 0.5 + 0.5 * Math.sin(t * 2);

  if (id.includes('bw') || id.includes('mono') || id.includes('gray')) {
    desaturate(ctx, w, h, 1);
  } else if (id.includes('sepia') || id.includes('vintage') || id.includes('retro')) {
    ctx.fillStyle = `rgba(112, 66, 20, ${0.35 + 0.1 * pulse})`;
    ctx.fillRect(0, 0, w, h);
  } else if (id.includes('warm') || id.includes('temperature')) {
    ctx.fillStyle = `rgba(255, 140, 50, ${0.2 + 0.1 * pulse})`;
    ctx.fillRect(0, 0, w, h);
  } else if (id.includes('cool') || id.includes('cold')) {
    ctx.fillStyle = `rgba(50, 120, 255, ${0.2 + 0.1 * pulse})`;
    ctx.fillRect(0, 0, w, h);
  } else if (id.includes('contrast') || id.includes('drama') || id.includes('cinematic')) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.05 * pulse})`;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.globalCompositeOperation = 'source-over';
  } else if (id.includes('teal') || id.includes('orange')) {
    ctx.fillStyle = `rgba(0, 150, 160, ${0.2})`;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.fillStyle = `rgba(255, 120, 40, ${0.2})`;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  } else if (id.includes('vivid') || id.includes('sat')) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.2 * pulse})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (id.includes('blur') || id.includes('glow') || id.includes('mosaic')) {
    ctx.fillStyle = `rgba(255,255,255,${0.12 * pulse})`;
    ctx.fillRect(0, 0, w, h);
    if (id.includes('mosaic')) {
      const cell = 8;
      for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
          if ((x + y) % (cell * 2) === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x, y, cell, cell);
          }
        }
      }
    }
  } else if (id.includes('glitch')) {
    const off = Math.sin(t * 12) * 4;
    ctx.fillStyle = 'rgba(255,0,80,0.35)';
    ctx.fillRect(off, 0, w, h * 0.33);
    ctx.fillStyle = 'rgba(0,255,200,0.25)';
    ctx.fillRect(-off, h * 0.33, w, h * 0.33);
  } else if (id.includes('vignette') || id.includes('shadow')) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.55 + 0.1 * pulse})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  } else if (kind === 'effect') {
    ctx.fillStyle = color || '#a78bfa';
    for (let i = 0; i < 8; i++) {
      const x = (Math.sin(t + i) * 0.5 + 0.5) * w * 0.8 + w * 0.1;
      const y = (Math.cos(t * 1.3 + i * 0.7) * 0.5 + 0.5) * h * 0.7 + h * 0.15;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i);
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = `rgba(79, 140, 255, ${0.15 + 0.1 * pulse})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawTextAnimation(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  id: string,
  t: number,
  color?: string
) {
  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, w, h);
  const cycle = 2;
  const p = (t % cycle) / cycle;
  let alpha = 1;
  let scale = 1;
  let dx = 0;
  let dy = 0;

  if (id.includes('fade')) {
    alpha = p < 0.3 ? p / 0.3 : p > 0.7 ? (1 - p) / 0.3 : 1;
  } else if (id.includes('pop') || id.includes('bounce')) {
    const k = p < 0.4 ? easeOutBack(p / 0.4) : 1;
    scale = k;
    alpha = p > 0.85 ? (1 - p) / 0.15 : 1;
  } else if (id.includes('slide-up') || id.includes('slide_up')) {
    dy = (1 - easeOut(Math.min(1, p / 0.35))) * 30;
    alpha = p > 0.85 ? (1 - p) / 0.15 : 1;
  } else if (id.includes('slide-left') || id.includes('slide')) {
    dx = (1 - easeOut(Math.min(1, p / 0.35))) * -40;
    alpha = p > 0.85 ? (1 - p) / 0.15 : 1;
  }

  const text =
    id.includes('type') || id.includes('writer')
      ? 'Bonjour'.slice(0, Math.max(1, Math.floor(((t % 2) / 2) * 8)))
      : 'Texte';

  ctx.save();
  ctx.translate(w / 2 + dx, h / 2 + dy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color || '#ffffff';
  ctx.font = `700 ${Math.max(14, h * 0.22)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawFont(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#161922');
  g.addColorStop(1, '#0c0e14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const family = res.asset || res.name || 'Inter';
  ctx.fillStyle = res.color || '#e8eaed';
  ctx.font = `600 ${Math.max(16, h * 0.28)}px ${family}, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bob = Math.sin(t * 2) * 2;
  ctx.fillText('Aa', w / 2, h / 2 - 6 + bob);
  ctx.font = `400 ${Math.max(9, h * 0.1)}px ${family}, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(res.name, w / 2, h / 2 + h * 0.28);
}

function drawSticker(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  ctx.fillStyle = '#12151c';
  ctx.fillRect(0, 0, w, h);
  const s = 1 + 0.08 * Math.sin(t * 3);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 1.5) * 0.08);
  ctx.font = `${Math.max(28, h * 0.45)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(res.asset || '⭐', 0, 0);
  ctx.restore();
}

function drawAudioWave(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#0f172a');
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const bars = 24;
  const accent = res.color || (res.category === 'sfx' ? '#fbbf24' : '#34d399');
  for (let i = 0; i < bars; i++) {
    const n = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + i * 0.45));
    const bh = h * 0.55 * n;
    const bw = (w - 16) / bars - 2;
    const x = 8 + i * ((w - 16) / bars);
    const y = (h - bh) / 2;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5 + 0.5 * n;
    roundRect(ctx, x, y, bw, bh, 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  ctx.fillText(res.category === 'sfx' ? 'SFX' : '♪ Music', 8, 14);
}

function drawGraphic(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, w, h);
  const c = res.color || '#4f8cff';
  const rot = t * 0.4;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rot);
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.strokeRect(-h * 0.22, -h * 0.22, h * 0.44, h * 0.44);
  ctx.rotate(-rot * 2);
  ctx.beginPath();
  ctx.arc(0, 0, h * 0.18, 0, Math.PI * 2);
  ctx.strokeStyle = '#f472b6';
  ctx.stroke();
  ctx.restore();
}

function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, res: LibraryResource, t: number) {
  const base = res.color || '#4f8cff';
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, shade(base, -40));
  g.addColorStop(1, shade(base, -70));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const vertical =
    res.category === 'tiktok' || res.category === 'reels' || res.category === 'shorts';
  if (vertical) {
    const fw = h * 0.38;
    const fh = h * 0.78;
    const fx = (w - fw) / 2;
    const fy = (h - fh) / 2;
    ctx.fillStyle = '#0a0a0a';
    roundRect(ctx, fx, fy, fw, fh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const p = (t % 2.5) / 2.5;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = Math.min(1, p * 3);
    ctx.font = `700 ${Math.max(8, fh * 0.08)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HOOK', fx + fw / 2, fy + fh * 0.35);
    ctx.globalAlpha = Math.min(1, Math.max(0, (p - 0.3) * 3));
    ctx.font = `500 ${Math.max(7, fh * 0.055)}px Inter, sans-serif`;
    ctx.fillText('Story…', fx + fw / 2, fy + fh * 0.5);
    ctx.globalAlpha = Math.min(1, Math.max(0, (p - 0.55) * 3));
    ctx.fillStyle = base;
    ctx.fillText('CTA →', fx + fw / 2, fy + fh * 0.68);
    ctx.globalAlpha = 1;
  } else {
    const p = easeOut(Math.min(1, (t % 2.2) / 0.5));
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.max(12, h * 0.16)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(res.name.slice(0, 18), w / 2, h * 0.45);
    ctx.font = `400 ${Math.max(9, h * 0.09)}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const dur = res.duration ? `${res.duration}s` : 'template';
    ctx.fillText(dur, w / 2, h * 0.62);
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

function desaturate(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  try {
    const img = ctx.getImageData(0, 0, Math.floor(w), Math.floor(h));
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      d[i] = d[i] * (1 - amount) + g * amount;
      d[i + 1] = d[i + 1] * (1 - amount) + g * amount;
      d[i + 2] = d[i + 2] * (1 - amount) + g * amount;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* ignore */
  }
}

function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function easeOut(x: number) {
  return 1 - Math.pow(1 - x, 3);
}
function easeOutBack(x: number) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
}
function shade(hex: string, amt: number) {
  const n = hex.replace('#', '');
  if (n.length < 6) return hex;
  const num = parseInt(n.slice(0, 6), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
