/**
 * Frame-by-frame export using the same effects pipeline as live preview.
 */

import type { Clip, ClipEffects } from '../stores/projectStore';
import { defaultEffects } from '../engine/types';
import { sourceTimeAt, resolvedEffects } from '../engine/playback';
import { applyPostFx } from '../engine/renderEffects';
import { mixTimelineAudio, getAudioContext, resumeAudio } from '../engine/audioEngine';
import { drawSubtitles } from '../engine/subtitles/renderSubtitle';
import type { SubtitleTrack } from '../engine/subtitles/types';
import { drawRichText, evalTextAnimation, legacyToRich } from '../engine/text/renderText';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond: number;
  onProgress?: (ratio: number) => void;
  subtitleTracks?: SubtitleTrack[];
  /** Optional time range (seconds) */
  rangeStart?: number;
  rangeEnd?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Preferred mime type (MediaRecorder) */
  mimeType?: string;
  includeAudio?: boolean;
}

export async function exportTimeline(
  clips: Clip[],
  duration: number,
  options: ExportOptions
): Promise<Blob> {
  const {
    width,
    height,
    fps,
    videoBitsPerSecond,
    onProgress,
    subtitleTracks = [],
    rangeStart = 0,
    rangeEnd,
    signal,
    mimeType: preferredMime,
    includeAudio = true,
  } = options;
  if (duration <= 0 || clips.length === 0) throw new Error('Aucun contenu à exporter.');
  const t0 = Math.max(0, rangeStart);
  const t1 = Math.min(duration, rangeEnd ?? duration);
  if (t1 - t0 <= 0.01) throw new Error('Plage d’export invalide.');
  const exportDuration = t1 - t0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const videoClips = clips.filter((c) => (c.type === 'video' || c.type === 'image') && c.src);
  const textClips = clips.filter((c) => c.type === 'text');
  const videoElements = new Map<string, HTMLVideoElement | HTMLImageElement>();

  await Promise.all(
    videoClips.map(async (clip) => {
      if (clip.type === 'image') {
        const img = new Image();
        img.src = clip.src;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 5000);
        });
        videoElements.set(clip.id, img);
        return;
      }
      const v = document.createElement('video');
      v.src = clip.src;
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      await new Promise<void>((resolve) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => resolve();
        setTimeout(resolve, 5000);
      });
      videoElements.set(clip.id, v);
    })
  );

  // Mix audio tracks offline then attach to capture stream
  await resumeAudio();
  let mixedAudio: AudioBuffer | null = null;
  if (includeAudio) {
    mixedAudio = await mixTimelineAudio(clips, duration, 48000);
  }
  const canvasStream = canvas.captureStream(fps);
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  let audioSource: AudioBufferSourceNode | null = null;
  if (mixedAudio && includeAudio) {
    const actx = getAudioContext();
    const dest = actx.createMediaStreamDestination();
    audioSource = actx.createBufferSource();
    // If range, offset into the buffer
    audioSource.buffer = mixedAudio;
    audioSource.connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  }
  const stream = new MediaStream(tracks);

  let mimeType = preferredMime || 'video/webm';
  if (!preferredMime || !MediaRecorder.isTypeSupported(preferredMime)) {
    mimeType = 'video/webm';
    for (const m of [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]) {
      if (MediaRecorder.isTypeSupported(m)) {
        mimeType = m;
        break;
      }
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      videoElements.forEach((el) => {
        if (el instanceof HTMLVideoElement) {
          el.pause();
          el.src = '';
        }
      });
      try { audioSource?.stop(); } catch { /* */ }
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => reject(new Error('Erreur MediaRecorder'));
  });

  if (signal) {
    signal.addEventListener('abort', () => {
      try { recorder.stop(); } catch { /* */ }
      try { audioSource?.stop(); } catch { /* */ }
    });
  }

  recorder.start(100);
  if (audioSource) {
    try {
      // start at range offset if buffer is full-timeline
      audioSource.start(0, t0);
    } catch { /* */ }
  }
  const frameDuration = 1 / fps;
  const totalFrames = Math.ceil(exportDuration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) {
      try { recorder.stop(); } catch { /* */ }
      throw new DOMException('Export annulé', 'AbortError');
    }
    const t = t0 + frame * frameDuration;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const activeVideos = videoClips
      .filter((c) => t >= c.start && t < c.start + c.duration)
      .sort((a, b) => a.track - b.track);

    for (const clip of activeVideos) {
      const el = videoElements.get(clip.id);
      if (!el) continue;

      if (el instanceof HTMLVideoElement) {
        const localT = sourceTimeAt(clip, t);
        if (localT >= 0 && Math.abs(el.currentTime - localT) > 0.05) {
          el.currentTime = Math.max(0, Math.min(localT, el.duration || localT));
          await new Promise<void>((r) => {
            const onSeek = () => {
              el.removeEventListener('seeked', onSeek);
              r();
            };
            el.addEventListener('seeked', onSeek);
            setTimeout(r, 40);
          });
        }
      }

      const fx = resolvedEffects(clip, t);
      const crop = fx.crop || { x: 0, y: 0, w: 1, h: 1 };
      let fadeMul = 1;
      const rel = t - clip.start;
      if (clip.fadeIn > 0 && rel < clip.fadeIn) fadeMul = rel / clip.fadeIn;
      if (clip.fadeOut > 0 && rel > clip.duration - clip.fadeOut) {
        fadeMul = Math.min(fadeMul, (clip.duration - rel) / clip.fadeOut);
      }

      const vw =
        el instanceof HTMLVideoElement ? el.videoWidth || width : (el as HTMLImageElement).naturalWidth || width;
      const vh =
        el instanceof HTMLVideoElement
          ? el.videoHeight || height
          : (el as HTMLImageElement).naturalHeight || height;

      const sx = crop.x * vw;
      const sy = crop.y * vh;
      const sw = Math.max(1, crop.w * vw);
      const sh = Math.max(1, crop.h * vh);
      const scale = (fx.scale || 1) * Math.min(width / sw, height / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (width - dw) / 2 + (fx.positionX || 0) * width * 0.5;
      const dy = (height - dh) / 2 + (fx.positionY || 0) * height * 0.5;

      // Drop shadow
      if (fx.shadow) {
        ctx.save();
        ctx.globalAlpha = fx.shadow * 0.5 * fadeMul;
        ctx.fillStyle = '#000';
        ctx.filter = `blur(${8 + fx.shadow * 12}px)`;
        ctx.fillRect(dx + 6, dy + 8, dw, dh);
        ctx.filter = 'none';
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = (fx.opacity ?? 1) * fadeMul;
      if (fx.rotation) {
        ctx.translate(dx + dw / 2, dy + dh / 2);
        ctx.rotate((fx.rotation * Math.PI) / 180);
        ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
      }
      if (fx.blur > 0) ctx.filter = `blur(${fx.blur}px)`;
      ctx.drawImage(el as CanvasImageSource, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.filter = 'none';
      ctx.restore();

      applyPostFx(ctx, width, height, fx, t);
    }

    for (const clip of textClips.filter((c) => t >= c.start && t < c.start + c.duration)) {
      const rel = t - clip.start;
      const rich =
        (clip as any).richTextStyle ||
        legacyToRich(clip.textStyle as any);
      const fx = resolvedEffects(clip, t);
      if (fx.positionX) rich.positionX = (rich.positionX || 0) + fx.positionX;
      if (fx.positionY) rich.positionY = (rich.positionY || 0) + fx.positionY;
      rich.opacity = (rich.opacity ?? 1) * (fx.opacity ?? 1);
      const anim = evalTextAnimation(
        rel,
        clip.duration,
        (clip as any).textAnimation,
        (clip.text || '').length
      );
      let fadeMul = 1;
      if (clip.fadeIn > 0 && rel < clip.fadeIn) fadeMul = rel / clip.fadeIn;
      if (clip.fadeOut > 0 && rel > clip.duration - clip.fadeOut) {
        fadeMul = Math.min(fadeMul, (clip.duration - rel) / clip.fadeOut);
      }
      anim.opacityMul *= fadeMul;
      drawRichText(ctx, clip.text || '', rich, width, height, anim);
    }

    for (const st of subtitleTracks) {
      if (st.visible) drawSubtitles(ctx, width, height, st, t, 1);
    }

    onProgress?.(frame / totalFrames);
    await new Promise((r) => setTimeout(r, Math.min(8, 1000 / fps)));
  }

  recorder.stop();
  return done;
}

export const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '2K': { width: 2560, height: 1440 },
  '4K': { width: 3840, height: 2160 },
  'vertical-1080': { width: 1080, height: 1920 },
  'square-1080': { width: 1080, height: 1080 },
};

/** Export a single frame as image blob */
export async function exportFrame(
  clips: Clip[],
  timeSec: number,
  options: { width: number; height: number; format?: 'png' | 'jpeg' | 'webp'; quality?: number; subtitleTracks?: SubtitleTrack[] }
): Promise<Blob> {
  const { width, height, format = 'png', quality = 0.92, subtitleTracks = [] } = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const videoClips = clips.filter((c) => (c.type === 'video' || c.type === 'image') && c.src);
  const textClips = clips.filter((c) => c.type === 'text');

  for (const clip of videoClips) {
    if (timeSec < clip.start || timeSec >= clip.start + clip.duration) continue;
    const el = document.createElement(clip.type === 'image' ? 'img' : 'video') as HTMLVideoElement & HTMLImageElement;
    el.src = clip.src;
    await new Promise<void>((resolve) => {
      el.onload = () => resolve();
      (el as HTMLVideoElement).onloadeddata = () => resolve();
      el.onerror = () => resolve();
      setTimeout(resolve, 3000);
    });
    if (clip.type === 'video') {
      const localT = sourceTimeAt(clip, timeSec);
      try {
        (el as HTMLVideoElement).currentTime = localT;
        await new Promise((r) => setTimeout(r, 50));
      } catch { /* */ }
    }
    const fx = resolvedEffects(clip, timeSec);
    const vw = (el as HTMLVideoElement).videoWidth || (el as HTMLImageElement).naturalWidth || width;
    const vh = (el as HTMLVideoElement).videoHeight || (el as HTMLImageElement).naturalHeight || height;
    const scale = (fx.scale || 1) * Math.min(width / vw, height / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (width - dw) / 2 + (fx.positionX || 0) * width * 0.5;
    const dy = (height - dh) / 2 + (fx.positionY || 0) * height * 0.5;
    ctx.save();
    ctx.globalAlpha = fx.opacity ?? 1;
    ctx.drawImage(el, dx, dy, dw, dh);
    ctx.restore();
    applyPostFx(ctx, width, height, fx, timeSec);
  }

  for (const clip of textClips.filter((c) => timeSec >= c.start && timeSec < c.start + c.duration)) {
    const rel = timeSec - clip.start;
    const rich = (clip as any).richTextStyle || legacyToRich(clip.textStyle as any);
    const anim = evalTextAnimation(rel, clip.duration, (clip as any).textAnimation, (clip.text || '').length);
    drawRichText(ctx, clip.text || '', rich, width, height, anim);
  }

  for (const st of subtitleTracks) {
    if (st.visible) drawSubtitles(ctx, width, height, st, timeSec, 1);
  }

  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), mime, quality);
  });
}
