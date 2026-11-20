/**
 * Audio processing service (stubs + future FFmpeg filters).
 */

import type { AudioService } from '../../../shared/interfaces/services';
import { getFFmpeg } from '../ffmpeg/FFmpegService';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Audio');

export class DefaultAudioService implements AudioService {
  async denoise(input: string, output: string, strength = 0.5): Promise<boolean> {
    log.info('denoise requested', { input, strength });
    // Future: ffmpeg -af afftdn=nr=... or rnnoise
    const ffmpeg = getFFmpeg();
    if (!(await ffmpeg.isAvailable())) return false;
    return false;
  }

  async normalize(input: string, output: string, targetLufs = -14): Promise<boolean> {
    log.info('normalize requested', { input, targetLufs });
    return false;
  }

  async extractAudio(videoPath: string, outputPath: string): Promise<boolean> {
    log.info('extractAudio', { videoPath, outputPath });
    const ffmpeg = getFFmpeg();
    if (!(await ffmpeg.isAvailable())) return false;
    const result = await ffmpeg.run({
      input: videoPath,
      output: outputPath,
      args: ['-vn', '-acodec', 'copy'],
    });
    return result.success;
  }

  async mix(
    inputs: { path: string; volume: number }[],
    output: string
  ): Promise<boolean> {
    log.info('mix', { tracks: inputs.length, output });
    return false;
  }

  async detectSilence(
    input: string,
    thresholdDb = -40
  ): Promise<{ start: number; end: number }[]> {
    log.info('detectSilence', { input, thresholdDb });
    return [];
  }
}

let instance: DefaultAudioService | null = null;

export function getAudioService(): DefaultAudioService {
  if (!instance) instance = new DefaultAudioService();
  return instance;
}
