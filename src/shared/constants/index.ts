/**
 * Application-wide constants.
 */

export const APP_NAME = 'ScreenStudio Pro';
export const APP_ID = 'com.screenstudio.pro';
export const PROJECT_VERSION = '0.6.0';
export const PROJECT_FILE_EXT = '.ssproj';
export const PROJECT_MIME = 'application/x-screenstudio-project';

/** Default export presets ready for FFmpeg */
export const DEFAULT_EXPORT_PRESETS = [
  {
    id: 'web-1080p',
    name: 'Web 1080p (H.264)',
    container: 'mp4' as const,
    videoCodec: 'h264' as const,
    audioCodec: 'aac' as const,
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 8_000_000,
    audioBitrate: 192_000,
    crf: 23,
    preset: 'medium' as const,
  },
  {
    id: 'web-720p',
    name: 'Web 720p (H.264)',
    container: 'mp4' as const,
    videoCodec: 'h264' as const,
    audioCodec: 'aac' as const,
    width: 1280,
    height: 720,
    fps: 30,
    videoBitrate: 4_000_000,
    audioBitrate: 128_000,
    crf: 23,
    preset: 'medium' as const,
  },
  {
    id: '4k-high',
    name: '4K High Quality',
    container: 'mp4' as const,
    videoCodec: 'h264' as const,
    audioCodec: 'aac' as const,
    width: 3840,
    height: 2160,
    fps: 30,
    videoBitrate: 35_000_000,
    audioBitrate: 256_000,
    crf: 18,
    preset: 'slow' as const,
  },
  {
    id: 'webm-vp9',
    name: 'WebM VP9',
    container: 'webm' as const,
    videoCodec: 'vp9' as const,
    audioCodec: 'opus' as const,
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: 6_000_000,
    audioBitrate: 128_000,
  },
];

export const TRACK_LABELS = [
  { id: 0, label: 'V1', kind: 'video' },
  { id: 1, label: 'V2', kind: 'video' },
  { id: 2, label: 'A1', kind: 'audio' },
  { id: 4, label: 'A2', kind: 'audio' },
  { id: 3, label: 'T1', kind: 'text' },
] as const;

export const MAX_RECENT_PROJECTS = 20;
export const DEFAULT_CACHE_TTL_SEC = 7 * 24 * 3600; // 7 days
export const JOB_MAX_RETRIES = 2;
