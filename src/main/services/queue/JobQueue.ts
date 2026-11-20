/**
 * In-memory job queue with progress events.
 * Ready to be replaced by BullMQ / better-queue / a worker process later.
 */

import { v4 as uuidv4 } from 'uuid';
import type { JobQueue } from '../../../shared/interfaces/services';
import type { Job, JobProgress, JobResult, JobType, JobStatus } from '../../../shared/types/jobs';
import { JOB_MAX_RETRIES } from '../../../shared/constants';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Queue');

type ProgressCb = (p: JobProgress) => void;
type CompleteCb = (r: JobResult) => void;

export class InMemoryJobQueue implements JobQueue {
  private jobs = new Map<string, Job>();
  private progressListeners = new Map<string, Set<ProgressCb>>();
  private completeListeners = new Map<string, Set<CompleteCb>>();
  private running = false;
  private processors = new Map<JobType, (job: Job, update: (p: JobProgress) => void) => Promise<JobResult>>();

  registerProcessor(
    type: JobType,
    fn: (job: Job, update: (p: JobProgress) => void) => Promise<JobResult>
  ) {
    this.processors.set(type, fn);
    log.info('Processor registered', { type });
  }

  async enqueue(
    type: JobType,
    payload: Record<string, unknown>,
    priority = 0
  ): Promise<string> {
    const id = uuidv4();
    const job: Job = {
      id,
      type,
      status: 'queued',
      createdAt: Date.now(),
      progress: { ratio: 0 },
      payload,
      priority,
      retries: 0,
      maxRetries: JOB_MAX_RETRIES,
    };
    this.jobs.set(id, job);
    log.info('Job enqueued', { id, type, priority });
    this.pump();
    return id;
  }

  async get(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async list(status?: JobStatus): Promise<Job[]> {
    const all = Array.from(this.jobs.values());
    if (!status) return all.sort((a, b) => b.createdAt - a.createdAt);
    return all.filter((j) => j.status === status).sort((a, b) => b.createdAt - a.createdAt);
  }

  async cancel(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'queued' || job.status === 'running') {
      job.status = 'cancelled';
      job.finishedAt = Date.now();
      this.emitComplete(id, { success: false, error: 'Cancelled by user' });
      return true;
    }
    return false;
  }

  onProgress(id: string, cb: ProgressCb): () => void {
    if (!this.progressListeners.has(id)) this.progressListeners.set(id, new Set());
    this.progressListeners.get(id)!.add(cb);
    return () => this.progressListeners.get(id)?.delete(cb);
  }

  onComplete(id: string, cb: CompleteCb): () => void {
    if (!this.completeListeners.has(id)) this.completeListeners.set(id, new Set());
    this.completeListeners.get(id)!.add(cb);
    return () => this.completeListeners.get(id)?.delete(cb);
  }

  private emitProgress(id: string, p: JobProgress) {
    const job = this.jobs.get(id);
    if (job) job.progress = p;
    this.progressListeners.get(id)?.forEach((cb) => {
      try {
        cb(p);
      } catch {
        /* ignore */
      }
    });
  }

  private emitComplete(id: string, result: JobResult) {
    const job = this.jobs.get(id);
    if (job) {
      job.result = result;
      job.status = result.success ? 'completed' : job.status === 'cancelled' ? 'cancelled' : 'failed';
      job.finishedAt = Date.now();
    }
    this.completeListeners.get(id)?.forEach((cb) => {
      try {
        cb(result);
      } catch {
        /* ignore */
      }
    });
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const next = Array.from(this.jobs.values())
          .filter((j) => j.status === 'queued')
          .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];
        if (!next) break;

        const processor = this.processors.get(next.type);
        if (!processor) {
          next.status = 'failed';
          next.result = { success: false, error: `No processor for ${next.type}` };
          next.finishedAt = Date.now();
          this.emitComplete(next.id, next.result);
          continue;
        }

        next.status = 'running';
        next.startedAt = Date.now();
        log.info('Job started', { id: next.id, type: next.type });

        try {
          const result = await processor(next, (p) => this.emitProgress(next.id, p));
          if (next.status === 'cancelled') continue;
          this.emitComplete(next.id, result);
          log.info('Job finished', { id: next.id, success: result.success });
        } catch (err: any) {
          next.retries += 1;
          if (next.retries <= next.maxRetries) {
            next.status = 'queued';
            log.warn('Job retry', { id: next.id, retries: next.retries });
          } else {
            this.emitComplete(next.id, {
              success: false,
              error: String(err?.message || err),
            });
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}

let instance: InMemoryJobQueue | null = null;

export function getJobQueue(): InMemoryJobQueue {
  if (!instance) instance = new InMemoryJobQueue();
  return instance;
}
