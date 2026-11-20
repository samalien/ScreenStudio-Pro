/**
 * AI provider abstraction.
 * Default = local stubs. Real providers (OpenAI Whisper, Replicate, etc.)
 * can be plugged in without changing callers.
 */

import type { AIService, AISubtitleResult, AIProviderId } from '../../../shared/interfaces/services';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('AI');

export class LocalStubAIService implements AIService {
  readonly providerId: AIProviderId = 'local';

  isConfigured(): boolean {
    return true; // always "configured" as stub
  }

  async transcribe(_audioOrVideoPath: string, _language?: string): Promise<AISubtitleResult> {
    log.info('transcribe called (stub)');
    return {
      segments: [],
      fullText: '',
      language: 'und',
    };
  }

  async removeBackground(_imageOrVideoPath: string, _outputPath: string): Promise<boolean> {
    log.info('removeBackground called (stub)');
    return false;
  }

  async enhance(
    _inputPath: string,
    _outputPath: string,
    type: 'upscale' | 'denoise' | 'colorize'
  ): Promise<boolean> {
    log.info('enhance called (stub)', { type });
    return false;
  }

  async generateTitleSuggestions(transcript: string): Promise<string[]> {
    if (!transcript.trim()) return ['Untitled Project'];
    const words = transcript.split(/\s+/).slice(0, 6).join(' ');
    return [`${words}…`, `Demo – ${words}`, `Tutorial: ${words}`];
  }
}

let instance: AIService | null = null;

export function getAIService(): AIService {
  if (!instance) instance = new LocalStubAIService();
  return instance;
}

/** Allow swapping provider at runtime (e.g. after user enters API key) */
export function setAIService(svc: AIService) {
  instance = svc;
  log.info('AI provider switched', { provider: svc.providerId });
}
