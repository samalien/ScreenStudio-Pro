/**
 * FFmpeg service – tries system binary, falls back to stub behaviour.
 * API stable for IPC / JobQueue consumers.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { FFmpegService, FFmpegOptions } from '../../../shared/interfaces/services';
import type { MediaMetadata, ExportPreset } from '../../../shared/types/media';
import { rootLogger } from '../logging/Logger';
import { getStorage } from '../storage/LocalStorageProvider';

const log = rootLogger.child('FFmpeg');

const CANDIDATE_BINARIES = [
  process.env.FFMPEG_PATH,
  'ffmpeg',
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
].filter(Boolean) as string[];

async function whichFfmpeg(): Promise<string | null> {
  for (const bin of CANDIDATE_BINARIES) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const p = spawn(bin, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        p.stdout?.on('data', (d) => (out += d.toString()));
        p.on('error', () => resolve(false));
        p.on('close', (code) => resolve(code === 0 && /ffmpeg/i.test(out)));
        setTimeout(() => {
          try { p.kill(); } catch { /* */ }
          resolve(false);
        }, 3000);
      });
      if (ok) return bin;
    } catch {
      /* continue */
    }
  }
  return null;
}

export class SystemFFmpegService implements FFmpegService {
  private binary: string | null = null;
  private version: string | null = null;
  private probed = false;

  async ensureProbed() {
    if (this.probed) return;
    this.probed = true;
    this.binary = await whichFfmpeg();
    if (this.binary) {
      try {
        const v = await new Promise<string>((resolve) => {
          const p = spawn(this.binary!, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
          let out = '';
          p.stdout?.on('data', (d) => (out += d.toString()));
          p.on('close', () => {
            const m = out.match(/ffmpeg version ([^\s]+)/i);
            resolve(m?.[1] || 'unknown');
          });
          p.on('error', () => resolve('unknown'));
        });
        this.version = v;
        log.info('FFmpeg binary found', { binary: this.binary, version: v });
      } catch {
        this.version = 'unknown';
      }
    } else {
      log.warn('No system FFmpeg binary found – composition-only export path');
    }
  }

  async isAvailable(): Promise<boolean> {
    await this.ensureProbed();
    return !!this.binary;
  }

  async getVersion(): Promise<string | null> {
    await this.ensureProbed();
    return this.version;
  }

  setAvailable(version: string) {
    this.version = version;
    this.binary = this.binary || 'ffmpeg';
    this.probed = true;
  }

  async run(options: FFmpegOptions): Promise<{ success: boolean; stderr: string; durationMs: number }> {
    await this.ensureProbed();
    const start = Date.now();
    if (!this.binary) {
      if (options.onProgress) {
        for (let i = 0; i <= 5; i++) {
          options.onProgress({ ratio: i / 5 });
          await new Promise((r) => setTimeout(r, 20));
        }
      }
      return {
        success: false,
        stderr: 'FFmpeg binary not available. Install ffmpeg system-wide or use WebM/Canvas export.',
        durationMs: Date.now() - start,
      };
    }

    const args: string[] = ['-y'];
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    for (const inp of inputs) {
      args.push('-i', inp);
    }
    if (options.args?.length) args.push(...options.args);
    args.push(options.output);

    return new Promise((resolve) => {
      const p = spawn(this.binary!, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      p.stderr?.on('data', (d) => {
        const s = d.toString();
        stderr += s;
        if (options.onProgress) {
          const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (m) {
            const sec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3]);
            options.onProgress({ ratio: Math.min(0.99, sec / 120), timeSec: sec });
          }
        }
      });
      const timer = options.timeoutMs
        ? setTimeout(() => {
            try { p.kill('SIGKILL'); } catch { /* */ }
          }, options.timeoutMs)
        : null;
      p.on('close', (code) => {
        if (timer) clearTimeout(timer);
        if (options.onProgress) options.onProgress({ ratio: 1 });
        resolve({
          success: code === 0,
          stderr,
          durationMs: Date.now() - start,
        });
      });
      p.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({ success: false, stderr: String(err), durationMs: Date.now() - start });
      });
    });
  }

  async probe(filePath: string): Promise<MediaMetadata | null> {
    if (!(await getStorage().exists(filePath))) return null;
    const stat = await fs.promises.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const kind = ['.mp4', '.webm', '.mov', '.mkv', '.gif'].includes(ext)
      ? 'video'
      : ['.mp3', '.wav', '.aac', '.ogg', '.flac'].includes(ext)
        ? 'audio'
        : ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)
          ? 'image'
          : 'video';

    const meta: MediaMetadata = {
      id: path.basename(filePath),
      kind: kind as MediaMetadata['kind'],
      name: path.basename(filePath),
      path: filePath,
      sizeBytes: stat.size,
      createdAt: stat.birthtimeMs || Date.now(),
      updatedAt: stat.mtimeMs || Date.now(),
    };

    if (this.binary && (kind === 'video' || kind === 'audio')) {
      try {
        await this.ensureProbed();
        const out = await new Promise<string>((resolve) => {
          const p = spawn(this.binary!, ['-i', filePath, '-hide_banner'], { stdio: ['ignore', 'pipe', 'pipe'] });
          let err = '';
          p.stderr?.on('data', (d) => (err += d.toString()));
          p.on('close', () => resolve(err));
          p.on('error', () => resolve(''));
        });
        const dur = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (dur) {
          meta.durationSec =
            parseInt(dur[1], 10) * 3600 + parseInt(dur[2], 10) * 60 + parseFloat(dur[3]);
        }
        const res = out.match(/(\d{2,5})x(\d{2,5})/);
        if (res) {
          meta.width = parseInt(res[1], 10);
          meta.height = parseInt(res[2], 10);
        }
        const fps = out.match(/(\d+(?:\.\d+)?)\s*fps/);
        if (fps) meta.fps = parseFloat(fps[1]);
      } catch {
        /* ignore */
      }
    }
    return meta;
  }

  async extractThumbnail(videoPath: string, outputPath: string, atSec = 1): Promise<boolean> {
    const r = await this.run({
      input: videoPath,
      output: outputPath,
      args: ['-ss', String(atSec), '-vframes', '1', '-q:v', '2'],
    });
    return r.success;
  }

  async generateWaveform(audioPath: string, outputPath: string, _samples = 200): Promise<boolean> {
    const r = await this.run({
      input: audioPath,
      output: outputPath,
      args: ['-filter_complex', 'showwavespic=s=640x120', '-frames:v', '1'],
    });
    return r.success;
  }

  async transcode(
    input: string,
    output: string,
    preset: ExportPreset,
    onProgress?: (r: number) => void
  ): Promise<boolean> {
    const vcodec =
      preset.videoCodec === 'h264'
        ? 'libx264'
        : preset.videoCodec === 'vp9'
          ? 'libvpx-vp9'
          : preset.videoCodec === 'vp8'
            ? 'libvpx'
            : 'libx264';
    const acodec =
      preset.audioCodec === 'aac'
        ? 'aac'
        : preset.audioCodec === 'opus'
          ? 'libopus'
          : preset.audioCodec === 'mp3'
            ? 'libmp3lame'
            : 'aac';
    const args = [
      '-c:v', vcodec,
      '-b:v', String(preset.videoBitrate),
      '-r', String(preset.fps),
      '-s', `${preset.width}x${preset.height}`,
      '-c:a', acodec,
      '-b:a', String(preset.audioBitrate),
    ];
    if (preset.crf != null) args.push('-crf', String(preset.crf));
    if (preset.preset) args.push('-preset', preset.preset);
    const r = await this.run({
      input,
      output,
      args,
      onProgress: onProgress ? (p) => onProgress(p.ratio) : undefined,
    });
    return r.success;
  }

  async concat(inputs: string[], output: string, onProgress?: (r: number) => void): Promise<boolean> {
    const listPath = path.join(getStorage().getTempPath(), `concat-${Date.now()}.txt`);
    await fs.promises.mkdir(path.dirname(listPath), { recursive: true });
    await fs.promises.writeFile(
      listPath,
      inputs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    );
    const r = await this.run({
      input: listPath,
      output,
      args: ['-f', 'concat', '-safe', '0', '-c', 'copy'],
      onProgress: onProgress ? (p) => onProgress(p.ratio) : undefined,
    });
    try { await fs.promises.unlink(listPath); } catch { /* */ }
    return r.success;
  }
}

/** Back-compat alias */
export class StubFFmpegService extends SystemFFmpegService {}

let instance: SystemFFmpegService | null = null;

export function getFFmpeg(): SystemFFmpegService {
  if (!instance) instance = new SystemFFmpegService();
  return instance;
}
