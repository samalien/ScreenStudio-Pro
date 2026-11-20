/**
 * Core data model for the professional multi-track editing engine.
 * Includes full visual effects, color grade, and animation keyframes.
 */

export type ClipType = 'video' | 'audio' | 'text' | 'image';
export type TransitionType =
  | 'none'
  | 'fade'
  | 'crossfade'
  | 'dissolve'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'zoom-in'
  | 'zoom-out'
  | 'wipe'
  | 'flash';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-cubic' | 'ease-out-cubic';

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Color grade + transform + stylized effects applied per clip */
export interface ClipEffects {
  // Color
  brightness: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  exposure: number; // -1..1
  temperature: number; // -1..1 (cool..warm)
  tint: number; // -1..1 (green..magenta)
  vignette: number; // 0..1
  // Curves (simple lift/gamma/gain style, 0 = neutral)
  shadows: number; // -1..1
  highlights: number; // -1..1
  // Transform
  blur: number; // px
  opacity: number; // 0..1
  scale: number;
  rotation: number; // degrees
  crop: Region;
  positionX: number; // -1..1
  positionY: number;
  // Stylized
  mosaicRegions: Region[];
  filterId: string | null; // preset filter id
  glitch: number; // 0..1 intensity
  distortion: number; // 0..1
  glow: number; // 0..1
  sharpen: number; // 0..1
  edge: number; // 0..1 outline strength
  shadow: number; // 0..1 drop shadow
  // Mask (normalized ellipse or rect)
  maskEnabled: boolean;
  maskType: 'none' | 'circle' | 'rect' | 'gradient';
  maskFeather: number; // 0..1
  maskInvert: boolean;
}

export type AnimatableProp =
  | keyof ClipEffects
  | 'volume'
  | 'speed'
  | 'fadeIn'
  | 'fadeOut';

export interface Keyframe {
  id: string;
  time: number; // relative to clip start (seconds)
  property: AnimatableProp;
  value: number;
  easing: EasingType;
}


/** Per-clip audio processing parameters (Web Audio graph) */
export interface AudioSettings {
  pan: number; // -1 left .. 1 right
  lowGain: number; // dB-ish -1..1 mapped to EQ
  midGain: number;
  highGain: number;
  noiseGate: number; // 0..1 threshold strength
  normalize: boolean;
  pitch: number; // semitones -12..12 (playbackRate approx for speed-linked)
  detune: number; // cents
  effectId: string | null; // audio effect preset
  reverb: number; // 0..1
  echo: number; // 0..1
  vocalEnhance: number; // 0..1
}

export const defaultAudioSettings = (): AudioSettings => ({
  pan: 0,
  lowGain: 0,
  midGain: 0,
  highGain: 0,
  noiseGate: 0,
  normalize: false,
  pitch: 0,
  detune: 0,
  effectId: null,
  reverb: 0,
  echo: 0,
  vocalEnhance: 0,
});

export interface Clip {
  id: string;
  type: ClipType;
  name: string;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd?: number;
  src: string;
  sourceDuration: number;
  filePath?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fps?: number;
  text?: string;
  /** Legacy simple style (kept for compatibility) */
  textStyle?: {
    fontSize: number;
    color: string;
    fontFamily: string;
    backgroundColor?: string;
    // extended optional fields (rich)
    fontWeight?: number | string;
    fontStyle?: 'normal' | 'italic';
    align?: 'left' | 'center' | 'right';
    letterSpacing?: number;
    lineHeight?: number;
    direction?: 'ltr' | 'rtl' | 'auto';
    opacity?: number;
    positionX?: number;
    positionY?: number;
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    gradientEnabled?: boolean;
  };
  /** Rich text style (preferred when present) */
  richTextStyle?: import('./text/types').RichTextStyle;
  /** Text enter/exit animation */
  textAnimation?: import('./text/types').TextAnimation;
  track: number;
  volume: number;
  speed: number;
  reverse: boolean;
  fadeIn: number;
  fadeOut: number;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  effects: ClipEffects;
  keyframes: Keyframe[];
  locked: boolean;
  muted: boolean;
  thumbnail?: string;
  /** Waveform peaks 0..1 for timeline drawing */
  waveform?: number[];
  audio?: AudioSettings;
}

export interface Track {
  id: number;
  label: string;
  kind: 'video' | 'audio' | 'text' | 'overlay';
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  height: number;
}

export const defaultEffects = (): ClipEffects => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  shadows: 0,
  highlights: 0,
  blur: 0,
  opacity: 1,
  scale: 1,
  rotation: 0,
  crop: { x: 0, y: 0, w: 1, h: 1 },
  positionX: 0,
  positionY: 0,
  mosaicRegions: [],
  filterId: null,
  glitch: 0,
  distortion: 0,
  glow: 0,
  sharpen: 0,
  edge: 0,
  shadow: 0,
  maskEnabled: false,
  maskType: 'none',
  maskFeather: 0.15,
  maskInvert: false,
});

export const DEFAULT_TRACKS: Track[] = [
  { id: 0, label: 'V1', kind: 'video', locked: false, hidden: false, muted: false, height: 48 },
  { id: 1, label: 'V2', kind: 'video', locked: false, hidden: false, muted: false, height: 48 },
  { id: 5, label: 'V3', kind: 'overlay', locked: false, hidden: false, muted: false, height: 40 },
  { id: 2, label: 'A1', kind: 'audio', locked: false, hidden: false, muted: false, height: 40 },
  { id: 4, label: 'A2', kind: 'audio', locked: false, hidden: false, muted: false, height: 40 },
  { id: 3, label: 'T1', kind: 'text', locked: false, hidden: false, muted: false, height: 36 },
];

export interface ProjectSnapshot {
  version: string;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  clips: Clip[];
  tracks: Track[];
  currentTime: number;
  settings: {
    width: number;
    height: number;
    fps: number;
    backgroundColor: string;
  };
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}
