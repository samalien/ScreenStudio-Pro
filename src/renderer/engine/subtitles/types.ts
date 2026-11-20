/**
 * Subtitle / caption data model — project-persisted.
 */

export type SubtitleLanguage =
  | 'fr'
  | 'en'
  | 'ar'
  | 'es'
  | 'de'
  | 'it'
  | 'pt'
  | 'tr'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'auto';

export type SubtitleAnimation =
  | 'none'
  | 'fade'
  | 'pop'
  | 'slide-up'
  | 'typewriter';

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number; // px at 1080p reference
  color: string;
  backgroundColor: string; // rgba
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  /** vertical position 0=top 1=bottom */
  positionY: number;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  shadow: boolean;
  shadowColor: string;
  animation: SubtitleAnimation;
  /** RTL override — auto detects for ar */
  direction: 'auto' | 'ltr' | 'rtl';
}

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
  /** Source language of this cue text */
  language: SubtitleLanguage;
  /** Optional per-cue style overrides */
  style?: Partial<SubtitleStyle>;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: SubtitleLanguage;
  cues: SubtitleCue[];
  style: SubtitleStyle;
  visible: boolean;
}

export const defaultSubtitleStyle = (): SubtitleStyle => ({
  fontFamily: 'Inter, "Noto Naskh Arabic", "Segoe UI", sans-serif',
  fontSize: 42,
  color: '#FFFFFF',
  backgroundColor: 'rgba(0,0,0,0.55)',
  bold: true,
  italic: false,
  align: 'center',
  positionY: 0.88,
  outline: true,
  outlineColor: '#000000',
  outlineWidth: 2,
  shadow: true,
  shadowColor: 'rgba(0,0,0,0.6)',
  animation: 'fade',
  direction: 'auto',
});

export const LANGUAGE_LABELS: Record<SubtitleLanguage, string> = {
  auto: 'Auto-détecter',
  fr: 'Français',
  en: 'English',
  ar: 'العربية',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  tr: 'Türkçe',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
};

/** Heuristic RTL */
export function isRtlLanguage(lang: SubtitleLanguage | string): boolean {
  return lang === 'ar' || lang === 'he' || lang === 'fa' || lang === 'ur';
}

export function detectRtlText(text: string): boolean {
  // Arabic / Hebrew block
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(
    text
  );
}

export function resolveDirection(
  style: SubtitleStyle,
  text: string,
  lang: SubtitleLanguage
): 'ltr' | 'rtl' {
  if (style.direction === 'rtl' || style.direction === 'ltr') return style.direction;
  if (isRtlLanguage(lang) || detectRtlText(text)) return 'rtl';
  return 'ltr';
}
