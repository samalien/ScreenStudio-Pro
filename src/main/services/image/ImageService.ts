/**
 * Image processing service (stubs).
 * Can later use sharp / jimp / FFmpeg.
 */

import type { ImageService } from '../../../shared/interfaces/services';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Image');

export class DefaultImageService implements ImageService {
  async resize(input: string, output: string, width: number, height: number): Promise<boolean> {
    log.info('resize', { input, width, height });
    return false;
  }

  async convert(input: string, output: string, format: 'png' | 'jpg' | 'webp'): Promise<boolean> {
    log.info('convert', { input, format });
    return false;
  }

  async generateThumbnail(input: string, output: string, size: number): Promise<boolean> {
    log.info('generateThumbnail', { input, size });
    return false;
  }

  async applyOverlay(
    base: string,
    overlay: string,
    output: string,
    x: number,
    y: number
  ): Promise<boolean> {
    log.info('applyOverlay', { base, overlay, x, y });
    return false;
  }
}

let instance: DefaultImageService | null = null;

export function getImageService(): DefaultImageService {
  if (!instance) instance = new DefaultImageService();
  return instance;
}
