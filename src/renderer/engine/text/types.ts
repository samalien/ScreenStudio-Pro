/**
 * Professional text / typography model for ScreenStudio Pro.
 * Supports titles, free text, subtitles overlay, animations, RTL.
 */

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextDirection = 'ltr' | 'rtl' | 'auto';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';

export type TextAnimType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'scale-up'
  | 'scale-down'
  | 'typewriter'
  | 'blur-in'
  | 'bounce'
  | 'rotate-in'
  | 'flip'
  | 'glitch'
  | 'wave'
  | 'pop'
  | 'rise';

export type TextExitAnimType = TextAnimType;

export interface TextShadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface TextStroke {
  color: string;
  width: number;
  join?: CanvasLineJoin;
}

export interface TextGradient {
  enabled: boolean;
  type: 'linear' | 'radial';
  angle: number; // degrees for linear
  stops: { offset: number; color: string }[]; // 0..1
}

export interface TextBackground {
  enabled: boolean;
  color: string;
  opacity: number;
  paddingX: number;
  paddingY: number;
  borderRadius: number;
  /** full-width bar behind text */
  fullWidth?: boolean;
}

/** Full rich text style (extends the simple textStyle on Clip) */
export interface RichTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic';
  color: string;
  align: TextAlign;
  verticalAlign: TextVerticalAlign;
  direction: TextDirection;
  letterSpacing: number; // px
  lineHeight: number; // multiplier
  wordSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  opacity: number;
  shadow?: TextShadow | null;
  stroke?: TextStroke | null;
  gradient?: TextGradient | null;
  background?: TextBackground | null;
  /** position relative to frame (-1..1 center-based or absolute px via positionMode) */
  positionX: number;
  positionY: number;
  positionMode: 'normalized' | 'pixels';
  maxWidth?: number; // 0..1 of canvas or px
  rotation?: number;
  scale?: number;
}

export const DEFAULT_RICH_TEXT_STYLE = (): RichTextStyle => ({
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 64,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '#ffffff',
  align: 'center',
  verticalAlign: 'middle',
  direction: 'auto',
  letterSpacing: 0,
  lineHeight: 1.25,
  textTransform: 'none',
  opacity: 1,
  shadow: {
    color: '#000000',
    blur: 8,
    offsetX: 0,
    offsetY: 4,
    opacity: 0.55,
  },
  stroke: null,
  gradient: null,
  background: null,
  positionX: 0,
  positionY: 0.35,
  positionMode: 'normalized',
  maxWidth: 0.85,
  rotation: 0,
  scale: 1,
});

export interface TextAnimation {
  enter: TextAnimType;
  exit: TextExitAnimType;
  enterDuration: number; // seconds
  exitDuration: number;
  enterDelay: number;
  /** for typewriter */
  typewriterCps?: number; // characters per second
  /** easing name */
  easing?: 'linear' | 'ease-out' | 'ease-in' | 'ease-in-out' | 'spring';
}

export const DEFAULT_TEXT_ANIMATION = (): TextAnimation => ({
  enter: 'fade',
  exit: 'fade',
  enterDuration: 0.45,
  exitDuration: 0.35,
  enterDelay: 0,
  typewriterCps: 18,
  easing: 'ease-out',
});

/** Preset title / text template */
export interface TextPreset {
  id: string;
  name: string;
  nameEn: string;
  category: 'title' | 'subtitle' | 'lower-third' | 'caption' | 'callout' | 'credit' | 'social' | 'arabic';
  text: string;
  style: Partial<RichTextStyle>;
  animation?: Partial<TextAnimation>;
  tags?: string[];
}

export interface FontItem {
  id: string;
  family: string;
  label: string;
  category: 'sans' | 'serif' | 'display' | 'mono' | 'hand' | 'arabic' | 'system';
  weights: (number | string)[];
  /** Google Fonts or local URL */
  url?: string;
  supportsRtl?: boolean;
  preview?: string;
}

/** Path animation (text along curve) – simplified */
export interface TextPath {
  enabled: boolean;
  /** quadratic or simple arc */
  type: 'arc' | 'wave' | 'line';
  amplitude: number;
  frequency: number;
  offset: number;
}
