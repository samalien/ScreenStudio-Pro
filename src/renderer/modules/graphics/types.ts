/**
 * Types for the professional Graphics / Photo Editor.
 * ScreenStudio Pro – Graphics Module
 */

export type GraphicsTool =
  | 'select'
  | 'move'
  | 'crop'
  | 'rotate'
  | 'brush'
  | 'eraser'
  | 'text'
  | 'shape'
  | 'sticker'
  | 'eyedropper';

export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star';

export type LayerType = 'image' | 'text' | 'shape' | 'adjustment' | 'group';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Color adjustments applied non-destructively */
export interface ColorAdjustments {
  brightness: number;   // -100 .. 100
  contrast: number;     // -100 .. 100
  saturation: number;   // -100 .. 100
  exposure: number;     // -2 .. 2 (stops)
  temperature: number;  // -100 .. 100 (cool ↔ warm)
  tint: number;         // -100 .. 100 (green ↔ magenta)
  highlights: number;   // -100 .. 100
  shadows: number;      // -100 .. 100
  whites: number;
  blacks: number;
  vibrance: number;
  hue: number;          // -180 .. 180
}

export const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  hue: 0,
};

export interface LayerTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  scaleX: number;
  scaleY: number;
  opacity: number;  // 0..1
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  color: string;
  backgroundColor: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  letterSpacing: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
}

export interface GraphicsLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  transform: LayerTransform;
  /** For image layers – object URL or data URL */
  src?: string;
  /** Original natural size */
  naturalWidth?: number;
  naturalHeight?: number;
  /** Text content */
  text?: string;
  textStyle?: TextStyle;
  /** Shape */
  shapeKind?: ShapeKind;
  shapeStyle?: ShapeStyle;
  /** Non-destructive adjustments (applied on render) */
  adjustments?: ColorAdjustments;
  /** Filter id from library */
  filterId?: string | null;
  /** Blend mode */
  blendMode?: GlobalCompositeOperation;
  /** Crop rect relative to natural size (0..1) */
  crop?: Rect | null;
  /** Order (higher = on top) */
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface GraphicsDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string; // color or 'transparent'
  layers: GraphicsLayer[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  document: GraphicsDocument;
}

export interface FilterPreset {
  id: string;
  name: string;
  category: 'basic' | 'cinematic' | 'vintage' | 'bw' | 'artistic' | 'instagram';
  /** CSS filter string or adjustment overrides */
  cssFilter?: string;
  adjustments?: Partial<ColorAdjustments>;
  thumbnail?: string;
}

export interface StickerItem {
  id: string;
  name: string;
  category: string;
  /** emoji or data URL */
  content: string;
  isEmoji?: boolean;
}

export type ExportFormat = 'png' | 'jpg' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0..1 for jpg/webp
  width?: number;
  height?: number;
  transparent?: boolean;
}
