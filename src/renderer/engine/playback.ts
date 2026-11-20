/**
 * Playback helpers: source time, keyframe evaluation with easing.
 */

import type { Clip, ClipEffects, EasingType, Keyframe } from './types';
import { defaultEffects } from './types';

export function sourceTimeAt(clip: Clip, timelineTime: number): number {
  const rel = timelineTime - clip.start;
  if (rel < 0 || rel >= clip.duration) return -1;
  const speed = Math.abs(clip.speed || 1);
  if (clip.reverse) {
    const span = clip.sourceDuration - clip.trimStart;
    return clip.trimStart + Math.max(0, span - rel * speed);
  }
  return clip.trimStart + rel * speed;
}

export function activeClipsAt(clips: Clip[], time: number, hiddenTracks: Set<number>): Clip[] {
  return clips
    .filter(
      (c) =>
        !hiddenTracks.has(c.track) && time >= c.start && time < c.start + c.duration
    )
    .sort((a, b) => a.track - b.track);
}

function ease(t: number, type: EasingType = 'linear'): number {
  t = Math.max(0, Math.min(1, t));
  switch (type) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return t * (2 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'ease-in-cubic':
      return t * t * t;
    case 'ease-out-cubic': {
      const u = 1 - t;
      return 1 - u * u * u;
    }
    default:
      return t;
  }
}

export function evalKeyframe(
  clip: Clip,
  property: string,
  relTime: number,
  fallback: number
): number {
  const kfs = (clip.keyframes || [])
    .filter((k) => k.property === property)
    .sort((a, b) => a.time - b.time);
  if (!kfs.length) return fallback;
  if (relTime <= kfs[0].time) return kfs[0].value;
  if (relTime >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (relTime >= a.time && relTime <= b.time) {
      const raw = (relTime - a.time) / (b.time - a.time || 1);
      const t = ease(raw, b.easing || a.easing || 'linear');
      return a.value + (b.value - a.value) * t;
    }
  }
  return fallback;
}

export function resolvedEffects(clip: Clip, timelineTime: number): ClipEffects {
  const rel = timelineTime - clip.start;
  const fx = clip.effects || defaultEffects();
  const num = (prop: keyof ClipEffects, fallback: number) =>
    evalKeyframe(clip, prop, rel, (fx[prop] as number) ?? fallback);

  return {
    ...fx,
    brightness: num('brightness', fx.brightness),
    contrast: num('contrast', fx.contrast),
    saturation: num('saturation', fx.saturation),
    exposure: num('exposure', fx.exposure ?? 0),
    temperature: num('temperature', fx.temperature ?? 0),
    tint: num('tint', fx.tint ?? 0),
    vignette: num('vignette', fx.vignette ?? 0),
    shadows: num('shadows', fx.shadows ?? 0),
    highlights: num('highlights', fx.highlights ?? 0),
    blur: num('blur', fx.blur),
    opacity: num('opacity', fx.opacity),
    scale: num('scale', fx.scale),
    rotation: num('rotation', fx.rotation),
    positionX: num('positionX', fx.positionX),
    positionY: num('positionY', fx.positionY),
    glitch: num('glitch', fx.glitch ?? 0),
    distortion: num('distortion', fx.distortion ?? 0),
    glow: num('glow', fx.glow ?? 0),
    sharpen: num('sharpen', fx.sharpen ?? 0),
    edge: num('edge', fx.edge ?? 0),
    shadow: num('shadow', fx.shadow ?? 0),
  };
}

export function buildMotionKeyframes(
  clipDuration: number,
  animIn?: { opacity?: number; scale?: number; positionY?: number; duration: number },
  animOut?: { opacity?: number; scale?: number; positionY?: number; duration: number }
): Keyframe[] {
  const kfs: Keyframe[] = [];
  const id = () => `kf-${Math.random().toString(36).slice(2, 9)}`;

  if (animIn) {
    const d = Math.min(animIn.duration, clipDuration / 2);
    if (animIn.opacity !== undefined) {
      kfs.push({ id: id(), time: 0, property: 'opacity', value: animIn.opacity, easing: 'ease-out' });
      kfs.push({ id: id(), time: d, property: 'opacity', value: 1, easing: 'ease-out' });
    }
    if (animIn.scale !== undefined) {
      kfs.push({ id: id(), time: 0, property: 'scale', value: animIn.scale, easing: 'ease-out-cubic' });
      kfs.push({ id: id(), time: d, property: 'scale', value: 1, easing: 'ease-out-cubic' });
    }
    if (animIn.positionY !== undefined) {
      kfs.push({
        id: id(),
        time: 0,
        property: 'positionY',
        value: animIn.positionY,
        easing: 'ease-out',
      });
      kfs.push({ id: id(), time: d, property: 'positionY', value: 0, easing: 'ease-out' });
    }
  }
  if (animOut) {
    const d = Math.min(animOut.duration, clipDuration / 2);
    const t0 = Math.max(0, clipDuration - d);
    if (animOut.opacity !== undefined) {
      kfs.push({ id: id(), time: t0, property: 'opacity', value: 1, easing: 'ease-in' });
      kfs.push({
        id: id(),
        time: clipDuration,
        property: 'opacity',
        value: animOut.opacity,
        easing: 'ease-in',
      });
    }
    if (animOut.scale !== undefined) {
      kfs.push({ id: id(), time: t0, property: 'scale', value: 1, easing: 'ease-in-cubic' });
      kfs.push({
        id: id(),
        time: clipDuration,
        property: 'scale',
        value: animOut.scale,
        easing: 'ease-in-cubic',
      });
    }
  }
  return kfs;
}
