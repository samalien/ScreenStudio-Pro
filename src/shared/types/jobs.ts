/**
 * Asynchronous job / queue types.
 */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export type JobType =
  | 'export'
  | 'transcode'
  | 'thumbnail'
  | 'waveform'
  | 'ai-subtitle'
  | 'ai-bg-remove'
  | 'ai-enhance'
  | 'audio-denoise'
  | 'project-save'
  | 'project-load'
  | 'media-import'
  | 'cache-cleanup';

export interface JobProgress {
  ratio: number; // 0..1
  message?: string;
  currentFrame?: number;
  totalFrames?: number;
  etaSeconds?: number;
}

export interface JobResult {
  success: boolean;
  outputPath?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  logs?: string[];
}

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  progress: JobProgress;
  payload: Record<string, unknown>;
  result?: JobResult;
  priority: number; // higher = sooner
  retries: number;
  maxRetries: number;
}
