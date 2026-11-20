/**
 * Preset filter library for the Graphics Editor.
 */

import type { FilterPreset, ColorAdjustments } from '../types';

export const FILTER_PRESETS: FilterPreset[] = [
  // Basic
  {
    id: 'none',
    name: 'Original',
    category: 'basic',
    cssFilter: 'none',
    adjustments: {},
  },
  {
    id: 'vivid',
    name: 'Vif',
    category: 'basic',
    cssFilter: 'saturate(1.4) contrast(1.1)',
    adjustments: { saturation: 35, contrast: 10, vibrance: 20 },
  },
  {
    id: 'soft',
    name: 'Doux',
    category: 'basic',
    cssFilter: 'brightness(1.05) contrast(0.92) saturate(0.9)',
    adjustments: { brightness: 5, contrast: -8, saturation: -10 },
  },
  {
    id: 'sharp',
    name: 'Net',
    category: 'basic',
    cssFilter: 'contrast(1.15) brightness(1.02)',
    adjustments: { contrast: 15, sharpness: 0 } as any,
  },

  // Cinematic
  {
    id: 'cinematic',
    name: 'Cinématique',
    category: 'cinematic',
    cssFilter: 'contrast(1.2) saturate(0.85) brightness(0.95)',
    adjustments: { contrast: 18, saturation: -12, shadows: 15, highlights: -10, temperature: -8 },
  },
  {
    id: 'teal-orange',
    name: 'Teal & Orange',
    category: 'cinematic',
    cssFilter: 'contrast(1.15) saturate(1.2) hue-rotate(-8deg)',
    adjustments: { contrast: 12, saturation: 15, temperature: 20, tint: -15 },
  },
  {
    id: 'noir',
    name: 'Film Noir',
    category: 'cinematic',
    cssFilter: 'grayscale(1) contrast(1.3) brightness(0.9)',
    adjustments: { saturation: -100, contrast: 25, brightness: -8 },
  },
  {
    id: 'fade',
    name: 'Fade',
    category: 'cinematic',
    cssFilter: 'contrast(0.85) brightness(1.08) saturate(0.8)',
    adjustments: { contrast: -12, brightness: 8, saturation: -15, shadows: 20 },
  },

  // Vintage
  {
    id: 'vintage',
    name: 'Vintage',
    category: 'vintage',
    cssFilter: 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(0.9)',
    adjustments: { temperature: 25, contrast: 8, saturation: -8, brightness: -5 },
  },
  {
    id: 'retro',
    name: 'Rétro 70s',
    category: 'vintage',
    cssFilter: 'sepia(0.25) hue-rotate(-15deg) contrast(1.05) saturate(1.1)',
    adjustments: { temperature: 30, tint: 10, contrast: 5, saturation: 10 },
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    category: 'vintage',
    cssFilter: 'sepia(0.2) contrast(1.15) brightness(1.05) saturate(0.95)',
    adjustments: { temperature: 15, contrast: 12, brightness: 5, saturation: -5 },
  },
  {
    id: 'faded-film',
    name: 'Film Fané',
    category: 'vintage',
    cssFilter: 'contrast(0.9) brightness(1.1) saturate(0.7) sepia(0.15)',
    adjustments: { contrast: -8, brightness: 8, saturation: -25, temperature: 10 },
  },

  // Black & White
  {
    id: 'bw',
    name: 'Noir & Blanc',
    category: 'bw',
    cssFilter: 'grayscale(1)',
    adjustments: { saturation: -100 },
  },
  {
    id: 'bw-contrast',
    name: 'N&B Contraste',
    category: 'bw',
    cssFilter: 'grayscale(1) contrast(1.35)',
    adjustments: { saturation: -100, contrast: 30 },
  },
  {
    id: 'bw-soft',
    name: 'N&B Doux',
    category: 'bw',
    cssFilter: 'grayscale(1) contrast(0.9) brightness(1.05)',
    adjustments: { saturation: -100, contrast: -8, brightness: 5 },
  },

  // Artistic / Instagram-like
  {
    id: 'warm',
    name: 'Chaud',
    category: 'instagram',
    cssFilter: 'sepia(0.2) saturate(1.2) brightness(1.05)',
    adjustments: { temperature: 35, saturation: 15, brightness: 5 },
  },
  {
    id: 'cool',
    name: 'Froid',
    category: 'instagram',
    cssFilter: 'hue-rotate(15deg) saturate(1.1) brightness(1.02)',
    adjustments: { temperature: -30, saturation: 10, tint: 5 },
  },
  {
    id: 'dramatic',
    name: 'Dramatique',
    category: 'artistic',
    cssFilter: 'contrast(1.4) brightness(0.9) saturate(1.15)',
    adjustments: { contrast: 35, brightness: -8, saturation: 12, shadows: -15, highlights: -10 },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    category: 'artistic',
    cssFilter: 'brightness(1.1) contrast(0.85) saturate(0.75)',
    adjustments: { brightness: 10, contrast: -12, saturation: -20, vibrance: 10 },
  },
  {
    id: 'neon',
    name: 'Néon',
    category: 'artistic',
    cssFilter: 'contrast(1.25) saturate(1.6) brightness(1.05)',
    adjustments: { contrast: 20, saturation: 50, vibrance: 30, exposure: 0.2 },
  },
  {
    id: 'moonlight',
    name: 'Clair de lune',
    category: 'artistic',
    cssFilter: 'grayscale(0.4) hue-rotate(200deg) brightness(0.85) contrast(1.15)',
    adjustments: { temperature: -40, saturation: -30, brightness: -12, contrast: 12 },
  },
];

export function getFilterById(id: string | null | undefined): FilterPreset | undefined {
  if (!id || id === 'none') return FILTER_PRESETS[0];
  return FILTER_PRESETS.find((f) => f.id === id);
}

export function getFiltersByCategory(category: FilterPreset['category']): FilterPreset[] {
  return FILTER_PRESETS.filter((f) => f.category === category);
}

export const FILTER_CATEGORIES: { id: FilterPreset['category']; label: string }[] = [
  { id: 'basic', label: 'Basiques' },
  { id: 'cinematic', label: 'Cinématique' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'bw', label: 'N&B' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'artistic', label: 'Artistique' },
];
