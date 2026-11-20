/**
 * Shared media types used by both main and renderer processes.
 * ScreenStudio Pro – Architecture v0.6
 */

export type MediaKind = 'video' | 'audio' | 'image' | 'subtitle' | 'project';

export type CodecVideo = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1' | 'prores';
export type CodecAudio = 'aac' | 'mp3' | 'opus' | 'pcm' | 'flac';
export type Container = 'mp4' | 'webm' | 'mov' | 'mkv' | 'wav' | 'mp3';

export interface MediaMetadata {
  id: string;
  kind: MediaKind;
  name: string;
  path: string;
  sizeBytes: number;
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  createdAt: number;
  updatedAt: number;
  thumbnailPath?: string;
  hash?: string; // for deduplication / cache
}

export interface ExportPreset {
  id: string;
  name: string;
  container: Container;
  videoCodec: CodecVideo;
  audioCodec: CodecAudio;
  width: number;
  height: number;
  fps: number;
  videoBitrate: number; // bps
  audioBitrate: number;
  crf?: number;
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ColorGrade {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature?: number;
  tint?: number;
}

export interface ClipEffects {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  opacity: number;
  scale: number;
  mosaicRegions: Region[];
  colorGrade?: ColorGrade;
  speed?: number;
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'crossfade'
  | 'dissolve'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe'
  | 'flash';

export type ClipType = 'video' | 'audio' | 'text' | 'image' | 'subtitle';

export interface Clip {
  id: string;
  type: ClipType;
  name: string;
  start: number;
  duration: number;
  trimStart: number;
  src: string;
  sourceDuration: number;
  text?: string;
  textStyle?: {
    fontSize: number;
    color: string;
    fontFamily: string;
    backgroundColor?: string;
  };
  track: number;
  volume: number;
  speed: number;
  fadeIn: number;
  fadeOut: number;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  effects: ClipEffects;
}

export interface ProjectDocument {
  version: string;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  clips: Clip[];
  tracks?: unknown[];
  mediaLibrary: MediaMetadata[];
  settings: {
    width: number;
    height: number;
    fps: number;
    backgroundColor: string;
  };
}
