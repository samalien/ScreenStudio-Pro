/**
 * Export presets, resolutions, codecs, size estimation.
 */

export type VideoContainer = 'mp4' | 'webm' | 'mov' | 'gif';
export type AudioContainer = 'mp3' | 'wav' | 'aac' | 'ogg';
export type ImageContainer = 'png' | 'jpg' | 'webp';
export type ExportMode = 'full' | 'range' | 'audio' | 'frame';

export interface ResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const RESOLUTIONS: ResolutionPreset[] = [
  { id: '480p', label: '480p (SD)', width: 854, height: 480 },
  { id: '720p', label: '720p (HD)', width: 1280, height: 720 },
  { id: '1080p', label: '1080p (Full HD)', width: 1920, height: 1080 },
  { id: '1440p', label: '1440p (2K)', width: 2560, height: 1440 },
  { id: '4K', label: '2160p (4K)', width: 3840, height: 2160 },
  { id: 'vertical-1080', label: '1080×1920 (9:16)', width: 1080, height: 1920 },
  { id: 'square-1080', label: '1080×1080 (1:1)', width: 1080, height: 1080 },
];

export const FPS_OPTIONS = [24, 25, 30, 48, 50, 60];

export const QUALITY_PRESETS = [
  { id: 'low', label: 'Basse', videoBitrate: 2_000_000, audioBitrate: 96_000, crf: 28 },
  { id: 'medium', label: 'Moyenne', videoBitrate: 5_000_000, audioBitrate: 128_000, crf: 23 },
  { id: 'high', label: 'Haute', videoBitrate: 10_000_000, audioBitrate: 192_000, crf: 18 },
  { id: 'ultra', label: 'Ultra', videoBitrate: 20_000_000, audioBitrate: 320_000, crf: 15 },
] as const;

export interface ExportSettings {
  mode: ExportMode;
  container: VideoContainer | AudioContainer | ImageContainer;
  resolutionId: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  audioSampleRate: number;
  qualityId: string;
  /** include audio track */
  includeAudio: boolean;
  /** time range (seconds) for mode=range */
  rangeStart: number;
  rangeEnd: number;
  /** frame time for mode=frame */
  frameTime: number;
  fileName: string;
  /** prefer system ffmpeg when available */
  useFFmpeg: boolean;
}

export function defaultExportSettings(): ExportSettings {
  return {
    mode: 'full',
    container: 'webm',
    resolutionId: '1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 8_000_000,
    audioBitrate: 192_000,
    audioSampleRate: 48000,
    qualityId: 'high',
    includeAudio: true,
    rangeStart: 0,
    rangeEnd: 0,
    frameTime: 0,
    fileName: '',
    useFFmpeg: true,
  };
}

/** Rough size estimation in bytes */
export function estimateExportSize(
  durationSec: number,
  settings: ExportSettings
): { bytes: number; label: string } {
  if (settings.mode === 'frame' || settings.container === 'png' || settings.container === 'jpg' || settings.container === 'webp') {
    const px = settings.width * settings.height;
    const bpp = settings.container === 'png' ? 3 : 0.5;
    const bytes = Math.round(px * bpp);
    return { bytes, label: formatBytes(bytes) };
  }
  if (settings.mode === 'audio' || settings.container === 'mp3' || settings.container === 'wav' || settings.container === 'aac' || settings.container === 'ogg') {
    const rate = settings.container === 'wav' ? settings.audioSampleRate * 16 * 2 / 8 : settings.audioBitrate / 8;
    const bytes = Math.round(rate * durationSec);
    return { bytes, label: formatBytes(bytes) };
  }
  // video
  const v = settings.videoBitrate / 8;
  const a = settings.includeAudio ? settings.audioBitrate / 8 : 0;
  // GIF is less efficient
  const mul = settings.container === 'gif' ? 2.5 : 1.15;
  const bytes = Math.round((v + a) * durationSec * mul);
  return { bytes, label: formatBytes(bytes) };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

export function extensionFor(container: string): string {
  if (container === 'jpeg') return 'jpg';
  return container;
}

export function mimeFor(container: string): string {
  switch (container) {
    case 'mp4':
    case 'mov':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'gif':
      return 'image/gif';
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'ogg':
      return 'audio/ogg';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/** MediaRecorder mime candidates by container */
export function recorderMimeCandidates(container: string): string[] {
  switch (container) {
    case 'mp4':
    case 'mov':
      return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    case 'webm':
      return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    case 'gif':
      // MediaRecorder can't do GIF – we export webm then note conversion, or frame sequence
      return ['video/webm;codecs=vp8'];
    default:
      return ['video/webm;codecs=vp9,opus', 'video/webm'];
  }
}

export function pickSupportedMime(candidates: string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}
