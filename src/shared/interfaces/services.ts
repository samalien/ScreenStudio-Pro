/**
 * Service contracts (interfaces) – dependency inversion.
 * Implementations live in main process; renderer only talks via IPC.
 */

import type { MediaMetadata, ExportPreset, ProjectDocument, Clip } from '../types/media';
import type { Job, JobProgress, JobResult, JobType } from '../types/jobs';

/* ------------------------------------------------------------------ */
/*  Logging                                                            */
/* ------------------------------------------------------------------ */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(context: string): Logger;
}

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

export interface StorageProvider {
  readonly name: string;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<Buffer>;
  writeFile(path: string, data: Buffer | string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  getSize(path: string): Promise<number>;
  getAppDataPath(): string;
  getProjectsPath(): string;
  getCachePath(): string;
  getTempPath(): string;
  getMediaPath(): string;
}

export interface CloudStorageProvider extends StorageProvider {
  upload(localPath: string, remoteKey: string, onProgress?: (r: number) => void): Promise<string>;
  download(remoteKey: string, localPath: string, onProgress?: (r: number) => void): Promise<void>;
  getSignedUrl(remoteKey: string, expiresInSec?: number): Promise<string>;
}

/* ------------------------------------------------------------------ */
/*  FFmpeg / Media processing                                          */
/* ------------------------------------------------------------------ */

export interface FFmpegOptions {
  input: string | string[];
  output: string;
  args?: string[];
  overwrite?: boolean;
  onProgress?: (progress: { ratio: number; timeSec?: number; speed?: number }) => void;
  timeoutMs?: number;
}

export interface FFmpegService {
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string | null>;
  run(options: FFmpegOptions): Promise<{ success: boolean; stderr: string; durationMs: number }>;
  probe(filePath: string): Promise<MediaMetadata | null>;
  extractThumbnail(videoPath: string, outputPath: string, atSec?: number): Promise<boolean>;
  generateWaveform(audioPath: string, outputPath: string, samples?: number): Promise<boolean>;
  transcode(input: string, output: string, preset: ExportPreset, onProgress?: (r: number) => void): Promise<boolean>;
  concat(inputs: string[], output: string, onProgress?: (r: number) => void): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */

export interface AudioService {
  denoise(input: string, output: string, strength?: number): Promise<boolean>;
  normalize(input: string, output: string, targetLufs?: number): Promise<boolean>;
  extractAudio(videoPath: string, outputPath: string): Promise<boolean>;
  mix(inputs: { path: string; volume: number }[], output: string): Promise<boolean>;
  detectSilence(input: string, thresholdDb?: number): Promise<{ start: number; end: number }[]>;
}

/* ------------------------------------------------------------------ */
/*  Image                                                              */
/* ------------------------------------------------------------------ */

export interface ImageService {
  resize(input: string, output: string, width: number, height: number): Promise<boolean>;
  convert(input: string, output: string, format: 'png' | 'jpg' | 'webp'): Promise<boolean>;
  generateThumbnail(input: string, output: string, size: number): Promise<boolean>;
  applyOverlay(base: string, overlay: string, output: string, x: number, y: number): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/*  AI Providers                                                       */
/* ------------------------------------------------------------------ */

export type AIProviderId = 'local' | 'openai' | 'anthropic' | 'replicate' | 'custom';

export interface AISubtitleResult {
  segments: { start: number; end: number; text: string }[];
  language?: string;
  fullText: string;
}

export interface AIService {
  readonly providerId: AIProviderId;
  isConfigured(): boolean;
  transcribe(audioOrVideoPath: string, language?: string): Promise<AISubtitleResult>;
  removeBackground(imageOrVideoPath: string, outputPath: string): Promise<boolean>;
  enhance(inputPath: string, outputPath: string, type: 'upscale' | 'denoise' | 'colorize'): Promise<boolean>;
  generateTitleSuggestions(transcript: string): Promise<string[]>;
}

/* ------------------------------------------------------------------ */
/*  Job Queue                                                          */
/* ------------------------------------------------------------------ */

export interface JobQueue {
  enqueue(type: JobType, payload: Record<string, unknown>, priority?: number): Promise<string>;
  get(id: string): Promise<Job | null>;
  list(status?: Job['status']): Promise<Job[]>;
  cancel(id: string): Promise<boolean>;
  onProgress(id: string, cb: (p: JobProgress) => void): () => void;
  onComplete(id: string, cb: (result: JobResult) => void): () => void;
}

/* ------------------------------------------------------------------ */
/*  Project                                                            */
/* ------------------------------------------------------------------ */

export interface ProjectService {
  create(name: string): Promise<ProjectDocument>;
  save(project: ProjectDocument, filePath?: string): Promise<string>;
  load(filePath: string): Promise<ProjectDocument>;
  listRecent(limit?: number): Promise<{ id: string; name: string; path: string; updatedAt: number }[]>;
  delete(filePath: string): Promise<boolean>;
  exportMediaManifest(project: ProjectDocument): Promise<string[]>;
}

/* ------------------------------------------------------------------ */
/*  Cache                                                              */
/* ------------------------------------------------------------------ */

export interface CacheService {
  get(key: string): Promise<Buffer | null>;
  set(key: string, value: Buffer, ttlSec?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getOrCompute(key: string, compute: () => Promise<Buffer>, ttlSec?: number): Promise<Buffer>;
}

/* ------------------------------------------------------------------ */
/*  Security / Auth (future SaaS & licensing)                          */
/* ------------------------------------------------------------------ */

export interface LicenseInfo {
  valid: boolean;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  expiresAt?: number;
  features: string[];
  machineId: string;
}

export interface SecurityService {
  getMachineId(): Promise<string>;
  validateLicense(key?: string): Promise<LicenseInfo>;
  checkFeature(feature: string): Promise<boolean>;
  sanitizePath(userPath: string): string;
  isPathAllowed(filePath: string): boolean;
}
