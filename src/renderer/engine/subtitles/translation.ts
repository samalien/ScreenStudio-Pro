/**
 * Translation providers — pluggable.
 * Default: MyMemory free endpoint (no key, rate-limited).
 * Optional: LibreTranslate / custom endpoint via localStorage.
 */

import type { SubtitleCue, SubtitleLanguage } from './types';

export interface TranslateProgress {
  ratio: number;
  message: string;
}

export async function detectLanguage(text: string): Promise<SubtitleLanguage> {
  const sample = text.slice(0, 200);
  if (/[\u0600-\u06FF]/.test(sample)) return 'ar';
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
  if (/[\u3040-\u30ff]/.test(sample)) return 'ja';
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko';
  // MyMemory langdetect-ish via translate to en and look — heuristic fallback
  try {
    const endpoint =
      localStorage.getItem('ssp_translate_endpoint') ||
      'https://api.mymemory.translated.net/get';
    const url = `${endpoint}?q=${encodeURIComponent(sample.slice(0, 80))}&langpair=autodetect|en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const detected = data?.responseData?.detectedSourceLanguage as string | undefined;
      if (detected && ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'tr'].includes(detected)) {
        return detected as SubtitleLanguage;
      }
    }
  } catch {
    /* */
  }
  return 'fr';
}

async function translateText(
  text: string,
  from: SubtitleLanguage,
  to: SubtitleLanguage
): Promise<string> {
  if (!text.trim() || from === to) return text;
  const endpoint =
    localStorage.getItem('ssp_translate_endpoint') ||
    'https://api.mymemory.translated.net/get';

  // LibreTranslate-style
  if (endpoint.includes('libretranslate') || localStorage.getItem('ssp_translate_engine') === 'libre') {
    const res = await fetch(endpoint.replace(/\/get$/, '') + (endpoint.endsWith('/translate') ? '' : '/translate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: from === 'auto' ? 'auto' : from,
        target: to,
        format: 'text',
      }),
    });
    if (!res.ok) throw new Error(`Traduction HTTP ${res.status}`);
    const data = await res.json();
    return data.translatedText || text;
  }

  // MyMemory
  const langpair = `${from === 'auto' ? 'Autodetect' : from}|${to}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=${langpair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.responseData?.translatedText;
  if (!translated || /MYMEMORY WARNING/i.test(translated)) {
    throw new Error(translated || 'Limite de traduction atteinte — réessayez plus tard');
  }
  return translated;
}

export async function translateCues(
  cues: SubtitleCue[],
  from: SubtitleLanguage,
  to: SubtitleLanguage,
  onProgress?: (p: TranslateProgress) => void
): Promise<SubtitleCue[]> {
  const out: SubtitleCue[] = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    onProgress?.({
      ratio: i / Math.max(1, cues.length),
      message: `Traduction ${i + 1}/${cues.length}`,
    });
    let text = c.text;
    // Skip placeholders
    if (text && !/^\[Segment \d+\]$/.test(text)) {
      try {
        text = await translateText(text, from === 'auto' ? c.language : from, to);
      } catch (err) {
        console.warn('translate cue failed', err);
        // keep original
      }
    }
    out.push({
      ...c,
      id: `cue-${Math.random().toString(36).slice(2, 10)}`,
      text,
      language: to,
    });
    // polite rate limit for free API
    await new Promise((r) => setTimeout(r, 120));
  }
  onProgress?.({ ratio: 1, message: 'Terminé' });
  return out;
}
