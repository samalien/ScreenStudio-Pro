/**
 * Pluggable Speech-to-Text providers.
 * - webspeech: live mic (Chromium)
 * - segments: energy-based speech regions from audio (placeholders / manual fill)
 * - whisper-api / openai: remote (configured via settings)
 */

import type { SubtitleCue, SubtitleLanguage } from './types';

export interface STTProgress {
  ratio: number;
  message: string;
}

export interface STTResult {
  cues: Omit<SubtitleCue, 'id'>[];
  language: SubtitleLanguage;
  provider: string;
}

export interface STTProvider {
  id: string;
  label: string;
  /** true if needs network */
  remote: boolean;
  transcribe(opts: {
    audioUrl?: string;
    language: SubtitleLanguage;
    onProgress?: (p: STTProgress) => void;
    /** live mic mode */
    live?: boolean;
    signal?: AbortSignal;
  }): Promise<STTResult>;
}

function uid() {
  return `cue-${Math.random().toString(36).slice(2, 10)}`;
}

export function withIds(cues: Omit<SubtitleCue, 'id'>[]): SubtitleCue[] {
  return cues.map((c) => ({ ...c, id: uid() }));
}

/** Split plain transcript into timed cues (even distribution or by punctuation) */
export function transcriptToCues(
  text: string,
  duration: number,
  language: SubtitleLanguage
): Omit<SubtitleCue, 'id'>[] {
  const cleaned = text.replace(/\r/g, '').trim();
  if (!cleaned || duration <= 0) return [];

  // Prefer sentence boundaries
  let parts = cleaned
    .split(/(?<=[.!?؟。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 1 && cleaned.length > 80) {
    // Split long lines by words into ~12-word chunks
    const words = cleaned.split(/\s+/);
    parts = [];
    for (let i = 0; i < words.length; i += 12) {
      parts.push(words.slice(i, i + 12).join(' '));
    }
  }

  const totalChars = parts.reduce((a, p) => a + p.length, 0) || 1;
  let t = 0;
  return parts.map((p) => {
    const span = Math.max(1.2, (p.length / totalChars) * duration);
    const start = t;
    const end = Math.min(duration, t + span);
    t = end;
    return { start, end, text: p, language };
  });
}

/** Web Speech API — live microphone recognition */
export const webSpeechProvider: STTProvider = {
  id: 'webspeech',
  label: 'Web Speech (micro)',
  remote: false,
  async transcribe({ language, onProgress, signal, live }) {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      throw new Error(
        'Web Speech API non disponible dans ce runtime. Utilisez un autre moteur ou saisissez le texte.'
      );
    }

    const langMap: Record<string, string> = {
      fr: 'fr-FR',
      en: 'en-US',
      ar: 'ar-SA',
      es: 'es-ES',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-PT',
      tr: 'tr-TR',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      auto: 'fr-FR',
    };

    return new Promise((resolve, reject) => {
      const recognition = new SR();
      recognition.lang = langMap[language] || 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      const lines: { text: string; t: number }[] = [];
      const t0 = performance.now();
      let lastFinal = '';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0]?.transcript?.trim();
          if (!transcript) continue;
          if (res.isFinal) {
            lines.push({ text: transcript, t: (performance.now() - t0) / 1000 });
            lastFinal = transcript;
            onProgress?.({
              ratio: Math.min(0.95, lines.length / 20),
              message: transcript.slice(0, 60),
            });
          } else {
            onProgress?.({ ratio: 0.3, message: transcript.slice(0, 60) });
          }
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'aborted') return;
        reject(new Error(`Web Speech: ${e.error || 'erreur'}`));
      };

      recognition.onend = () => {
        if (!lines.length && lastFinal) {
          lines.push({ text: lastFinal, t: (performance.now() - t0) / 1000 });
        }
        const cues = lines.map((l, i) => {
          const start = i === 0 ? 0 : lines[i - 1].t;
          const end = l.t + 0.8;
          return {
            start,
            end: Math.max(end, start + 1),
            text: l.text,
            language: language === 'auto' ? 'fr' : language,
          };
        });
        resolve({
          cues,
          language: language === 'auto' ? 'fr' : language,
          provider: 'webspeech',
        });
      };

      signal?.addEventListener('abort', () => {
        try {
          recognition.stop();
        } catch {
          /* */
        }
      });

      onProgress?.({ ratio: 0.05, message: 'Écoute du micro…' });
      recognition.start();

      // Auto-stop after 60s if live not continuous managed by UI
      if (!live) {
        setTimeout(() => {
          try {
            recognition.stop();
          } catch {
            /* */
          }
        }, 60000);
      }

      // Expose stop via signal only — UI should abort
    });
  },
};

/**
 * Build speech-like segments from audio energy (VAD simple).
 * Text left empty for manual edit or later STT fill.
 */
export async function segmentAudioByEnergy(
  audioUrl: string,
  language: SubtitleLanguage,
  onProgress?: (p: STTProgress) => void
): Promise<STTResult> {
  onProgress?.({ ratio: 0.1, message: 'Décodage audio…' });
  const res = await fetch(audioUrl);
  const arr = await res.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buf = await ctx.decodeAudioData(arr.slice(0));
  await ctx.close();

  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const win = Math.floor(0.03 * sr); // 30ms
  const hop = win;
  const energies: number[] = [];
  for (let i = 0; i + win < data.length; i += hop) {
    let e = 0;
    for (let j = 0; j < win; j++) e += data[i + j] * data[i + j];
    energies.push(Math.sqrt(e / win));
  }
  const sorted = [...energies].sort((a, b) => a - b);
  const thresh = sorted[Math.floor(sorted.length * 0.6)] * 1.4 + 0.005;

  onProgress?.({ ratio: 0.5, message: 'Détection de parole…' });

  const segments: { start: number; end: number }[] = [];
  let inSpeech = false;
  let segStart = 0;
  const minDur = 0.6;
  const maxDur = 6;

  for (let i = 0; i < energies.length; i++) {
    const t = (i * hop) / sr;
    const speech = energies[i] > thresh;
    if (speech && !inSpeech) {
      inSpeech = true;
      segStart = t;
    } else if (!speech && inSpeech) {
      inSpeech = false;
      if (t - segStart >= minDur) segments.push({ start: segStart, end: t });
    } else if (inSpeech && t - segStart >= maxDur) {
      segments.push({ start: segStart, end: t });
      segStart = t;
    }
  }
  if (inSpeech) {
    const t = buf.duration;
    if (t - segStart >= minDur) segments.push({ start: segStart, end: t });
  }

  // Merge close gaps
  const merged: { start: number; end: number }[] = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && s.start - last.end < 0.35) last.end = s.end;
    else merged.push({ ...s });
  }

  onProgress?.({ ratio: 1, message: `${merged.length} segments` });

  return {
    provider: 'energy-vad',
    language: language === 'auto' ? 'fr' : language,
    cues: merged.map((s, i) => ({
      start: s.start,
      end: s.end,
      text: `[Segment ${i + 1}]`,
      language: language === 'auto' ? 'fr' : language,
    })),
  };
}

export const energyVADProvider: STTProvider = {
  id: 'energy-vad',
  label: 'Détection de parole (segments)',
  remote: false,
  async transcribe({ audioUrl, language, onProgress }) {
    if (!audioUrl) throw new Error('URL audio requise pour la détection de segments');
    return segmentAudioByEnergy(audioUrl, language, onProgress);
  },
};

/**
 * Remote Whisper-compatible endpoint (OpenAI or local server).
 * Expects settings in localStorage: ssp_stt_endpoint, ssp_stt_api_key
 */
export const whisperApiProvider: STTProvider = {
  id: 'whisper-api',
  label: 'Whisper API (remote)',
  remote: true,
  async transcribe({ audioUrl, language, onProgress, signal }) {
    if (!audioUrl) throw new Error('Fichier audio requis');
    const endpoint =
      localStorage.getItem('ssp_stt_endpoint') ||
      'https://api.openai.com/v1/audio/transcriptions';
    const apiKey = localStorage.getItem('ssp_stt_api_key') || '';
    if (!apiKey && endpoint.includes('openai.com')) {
      throw new Error(
        'Clé API manquante. Définissez ssp_stt_api_key dans les réglages (localStorage) ou saisissez le texte manuellement.'
      );
    }

    onProgress?.({ ratio: 0.1, message: 'Téléchargement audio…' });
    const blob = await fetch(audioUrl).then((r) => r.blob());
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    if (language && language !== 'auto') form.append('language', language);
    form.append('response_format', 'verbose_json');

    onProgress?.({ ratio: 0.3, message: 'Transcription Whisper…' });
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      body: form,
      signal,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Whisper API ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    onProgress?.({ ratio: 1, message: 'OK' });

    const lang = (data.language as SubtitleLanguage) || language || 'en';
    if (Array.isArray(data.segments) && data.segments.length) {
      return {
        provider: 'whisper-api',
        language: lang,
        cues: data.segments.map((s: any) => ({
          start: s.start ?? 0,
          end: s.end ?? (s.start || 0) + 2,
          text: (s.text || '').trim(),
          language: lang,
        })),
      };
    }
    const text = (data.text || '').trim();
    const duration = data.duration || 60;
    return {
      provider: 'whisper-api',
      language: lang,
      cues: transcriptToCues(text, duration, lang),
    };
  },
};

export const STT_PROVIDERS: STTProvider[] = [
  energyVADProvider,
  webSpeechProvider,
  whisperApiProvider,
];

export function getSTTProvider(id: string): STTProvider | undefined {
  return STT_PROVIDERS.find((p) => p.id === id);
}
