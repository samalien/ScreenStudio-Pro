/**
 * Real media import pipeline.
 * Uses browser Media APIs for metadata + canvas thumbnails.
 * Supports video (mp4, webm, mov when browser allows), audio, images.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Clip, ClipType } from './types';
import { defaultEffects } from './types';

export interface ImportedMedia {
  id: string;
  kind: ClipType;
  name: string;
  src: string; // blob: URL
  filePath?: string;
  mimeType: string;
  sizeBytes: number;
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  thumbnail?: string;
  waveform?: number[]; // normalized peaks for audio
}

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.ogv'];
const AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a', '.opus'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function kindFromFile(file: File): ClipType | null {
  const ext = extOf(file.name);
  if (file.type.startsWith('video/') || VIDEO_EXTS.includes(ext)) return 'video';
  if (file.type.startsWith('audio/') || AUDIO_EXTS.includes(ext)) return 'audio';
  if (file.type.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image';
  // fallback by extension for containers browsers mislabel
  if (VIDEO_EXTS.includes(ext)) return 'video';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (IMAGE_EXTS.includes(ext)) return 'image';
  return null;
}

function loadVideoMeta(url: string): Promise<{
  duration: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const timer = setTimeout(() => {
      cleanup();
      resolve({ duration: 0, width: 0, height: 0 });
    }, 12000);
    const cleanup = () => {
      clearTimeout(timer);
      v.onloadedmetadata = null;
      v.onerror = null;
      v.src = '';
    };
    v.onloadedmetadata = () => {
      const duration = isFinite(v.duration) ? v.duration : 0;
      const width = v.videoWidth || 0;
      const height = v.videoHeight || 0;
      cleanup();
      resolve({ duration, width, height });
    };
    v.onerror = () => {
      cleanup();
      reject(new Error('Impossible de lire la vidéo'));
    };
    v.src = url;
  });
}

function loadAudioMeta(url: string): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    const timer = setTimeout(() => {
      a.src = '';
      resolve(0);
    }, 10000);
    a.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = isFinite(a.duration) ? a.duration : 0;
      a.src = '';
      resolve(d);
    };
    a.onerror = () => {
      clearTimeout(timer);
      resolve(0);
    };
    a.src = url;
  });
}

/** Generate a thumbnail from video at given time */
export async function generateVideoThumbnail(
  src: string,
  atSec = 0.5,
  maxWidth = 320
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    const done = (url?: string) => {
      v.src = '';
      resolve(url);
    };
    const timer = setTimeout(() => done(undefined), 15000);
    v.onloadeddata = async () => {
      try {
        const t = Math.min(Math.max(0, atSec), Math.max(0, (v.duration || 1) - 0.05));
        v.currentTime = t;
      } catch {
        clearTimeout(timer);
        done(undefined);
      }
    };
    v.onseeked = () => {
      try {
        const w = v.videoWidth || 320;
        const h = v.videoHeight || 180;
        const scale = maxWidth / w;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          clearTimeout(timer);
          done(undefined);
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        done(canvas.toDataURL('image/jpeg', 0.72));
      } catch {
        clearTimeout(timer);
        done(undefined);
      }
    };
    v.onerror = () => {
      clearTimeout(timer);
      done(undefined);
    };
    v.src = src;
  });
}

export async function generateImageThumbnail(
  src: string,
  maxWidth = 320
): Promise<{ thumbnail: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        thumbnail: canvas.toDataURL('image/jpeg', 0.8),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Simple peak waveform for audio clips (for timeline display) */
export async function generateWaveformPeaks(
  src: string,
  samples = 128
): Promise<number[]> {
  try {
    const res = await fetch(src);
    const buf = await res.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const channel = audio.getChannelData(0);
    const block = Math.floor(channel.length / samples) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      let max = 0;
      const start = i * block;
      for (let j = 0; j < block && start + j < channel.length; j++) {
        max = Math.max(max, Math.abs(channel[start + j]));
      }
      peaks.push(max);
    }
    await ctx.close();
    return peaks;
  } catch {
    return Array(samples).fill(0.2);
  }
}

export async function importFile(file: File): Promise<ImportedMedia> {
  const kind = kindFromFile(file);
  if (!kind) {
    throw new Error(`Format non supporté: ${file.name}`);
  }

  const src = URL.createObjectURL(file);
  const id = uuidv4();
  const base: ImportedMedia = {
    id,
    kind,
    name: file.name,
    src,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    duration: 0,
  };

  if (kind === 'video') {
    try {
      const meta = await loadVideoMeta(src);
      base.duration = meta.duration || 5;
      base.width = meta.width;
      base.height = meta.height;
      base.thumbnail = await generateVideoThumbnail(src, Math.min(1, base.duration * 0.1));
    } catch (err) {
      URL.revokeObjectURL(src);
      throw err;
    }
  } else if (kind === 'audio') {
    base.duration = (await loadAudioMeta(src)) || 30;
    base.waveform = await generateWaveformPeaks(src, 64);
  } else if (kind === 'image') {
    const thumb = await generateImageThumbnail(src);
    base.duration = 5; // default still duration
    if (thumb) {
      base.thumbnail = thumb.thumbnail;
      base.width = thumb.width;
      base.height = thumb.height;
    }
  }

  return base;
}

export async function importFiles(files: FileList | File[]): Promise<ImportedMedia[]> {
  const list = Array.from(files);
  const results: ImportedMedia[] = [];
  for (const file of list) {
    try {
      results.push(await importFile(file));
    } catch (err) {
      console.error('Import failed', file.name, err);
    }
  }
  return results;
}

/** Convert imported media to a timeline clip */
export function mediaToClip(
  media: ImportedMedia,
  start: number,
  track: number
): Omit<Clip, 'id'> & { id?: string } {
  return {
    type: media.kind,
    name: media.name,
    start,
    duration: media.duration || 5,
    trimStart: 0,
    src: media.src,
    sourceDuration: media.duration || 5,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    track,
    volume: media.kind === 'audio' ? 0.8 : 1,
    speed: 1,
    reverse: false,
    fadeIn: 0,
    fadeOut: 0,
    transitionIn: 'none',
    transitionOut: 'none',
    effects: defaultEffects(),
    keyframes: [],
    locked: false,
    muted: false,
    thumbnail: media.thumbnail,
  };
}

export function openFilePicker(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => {
      resolve(Array.from(input.files || []));
    };
    input.click();
  });
}

export const ACCEPT_ALL_MEDIA =
  'video/*,audio/*,image/*,.mp4,.mov,.mkv,.avi,.webm,.mp3,.wav,.aac,.flac,.png,.jpg,.jpeg,.webp';
