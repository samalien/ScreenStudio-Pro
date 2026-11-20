/**
 * Organized visual effects & filter preset library.
 * Each preset maps to ClipEffects partials applied on top of defaults.
 */

import type { ClipEffects } from './types';
import { defaultEffects } from './types';

export type EffectCategory =
  | 'filters'
  | 'color'
  | 'blur'
  | 'stylize'
  | 'light'
  | 'distort'
  | 'mask'
  | 'motion'
  | 'transition';

export interface EffectPreset {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  /** Preview swatch gradient or solid */
  preview: string;
  /** Partial effects merged onto clip */
  effects: Partial<ClipEffects>;
  /** Optional intro animation helper (applied as keyframes by UI) */
  animIn?: { opacity?: number; scale?: number; positionY?: number; duration: number };
  animOut?: { opacity?: number; scale?: number; positionY?: number; duration: number };
}

export const EFFECT_CATEGORIES: { id: EffectCategory; label: string }[] = [
  { id: 'filters', label: 'Filtres' },
  { id: 'color', label: 'Couleur' },
  { id: 'blur', label: 'Flou' },
  { id: 'stylize', label: 'Stylisation' },
  { id: 'light', label: 'Lumière' },
  { id: 'distort', label: 'Distorsion' },
  { id: 'mask', label: 'Masques' },
  { id: 'motion', label: 'Animation' },
  { id: 'transition', label: 'Transitions' },
];

export const EFFECT_PRESETS: EffectPreset[] = [
  // —— Filters ——
  {
    id: 'filter-cinematic',
    name: 'Cinématique',
    category: 'filters',
    description: 'Contraste élevé, désaturation légère, vignette',
    preview: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)',
    effects: {
      filterId: 'filter-cinematic',
      contrast: 0.18,
      saturation: -0.15,
      brightness: -0.04,
      temperature: 0.05,
      vignette: 0.45,
      shadows: -0.1,
      highlights: 0.08,
    },
  },
  {
    id: 'filter-vintage',
    name: 'Vintage',
    category: 'filters',
    description: 'Tons sépia chauds, grain soft, vignette',
    preview: 'linear-gradient(135deg,#c4a574,#8b6914,#5c4033)',
    effects: {
      filterId: 'filter-vintage',
      temperature: 0.35,
      saturation: -0.25,
      contrast: 0.1,
      brightness: 0.05,
      vignette: 0.5,
      tint: 0.08,
    },
  },
  {
    id: 'filter-bw',
    name: 'Noir et blanc',
    category: 'filters',
    description: 'Désaturation totale, contraste moyen',
    preview: 'linear-gradient(135deg,#111,#666,#eee)',
    effects: {
      filterId: 'filter-bw',
      saturation: -1,
      contrast: 0.15,
      brightness: 0.02,
    },
  },
  {
    id: 'filter-retro',
    name: 'Rétro',
    category: 'filters',
    description: 'Look années 80, magenta / cyan',
    preview: 'linear-gradient(135deg,#ff00aa,#00e5ff,#1a0033)',
    effects: {
      filterId: 'filter-retro',
      saturation: 0.25,
      contrast: 0.2,
      temperature: -0.1,
      tint: 0.15,
      vignette: 0.3,
    },
  },
  {
    id: 'filter-warm',
    name: 'Chaud',
    category: 'filters',
    description: 'Température chaude, soleil couchant',
    preview: 'linear-gradient(135deg,#ff9a56,#ff6b35,#c23a2b)',
    effects: {
      filterId: 'filter-warm',
      temperature: 0.4,
      saturation: 0.1,
      brightness: 0.05,
      exposure: 0.05,
    },
  },
  {
    id: 'filter-cold',
    name: 'Froid',
    category: 'filters',
    description: 'Température froide, ambiance bleutée',
    preview: 'linear-gradient(135deg,#a8d8ea,#4a90a4,#1e3a5f)',
    effects: {
      filterId: 'filter-cold',
      temperature: -0.4,
      saturation: -0.05,
      tint: -0.05,
      contrast: 0.05,
    },
  },
  {
    id: 'filter-portrait',
    name: 'Portrait',
    category: 'filters',
    description: 'Peau douce, luminosité douce, flou léger',
    preview: 'linear-gradient(135deg,#fce4d6,#e8b4b8,#c97b84)',
    effects: {
      filterId: 'filter-portrait',
      brightness: 0.08,
      contrast: -0.05,
      saturation: 0.05,
      temperature: 0.12,
      blur: 0.5,
      shadows: 0.1,
    },
  },
  {
    id: 'filter-landscape',
    name: 'Paysage',
    category: 'filters',
    description: 'Ciels vibrants, contraste nature',
    preview: 'linear-gradient(135deg,#87ceeb,#228b22,#1a5f2a)',
    effects: {
      filterId: 'filter-landscape',
      saturation: 0.2,
      contrast: 0.15,
      exposure: 0.05,
      highlights: 0.1,
      shadows: -0.05,
    },
  },
  {
    id: 'filter-fade',
    name: 'Fade film',
    category: 'filters',
    description: 'Noirs relevés style film délavé',
    preview: 'linear-gradient(135deg,#3d3d3d,#8a8a8a,#d4d4d4)',
    effects: {
      filterId: 'filter-fade',
      contrast: -0.15,
      shadows: 0.25,
      saturation: -0.1,
      brightness: 0.05,
    },
  },
  {
    id: 'filter-vivid',
    name: 'Vif',
    category: 'filters',
    description: 'Couleurs saturées, punch',
    preview: 'linear-gradient(135deg,#ff006e,#8338ec,#3a86ff)',
    effects: {
      filterId: 'filter-vivid',
      saturation: 0.35,
      contrast: 0.12,
      sharpen: 0.3,
    },
  },

  // —— Color tools (partial, for library cards) ——
  {
    id: 'color-boost-shadows',
    name: 'Ouvrir les ombres',
    category: 'color',
    description: 'Remonte les zones sombres',
    preview: 'linear-gradient(135deg,#111,#444,#888)',
    effects: { shadows: 0.35, brightness: 0.05 },
  },
  {
    id: 'color-crush-blacks',
    name: 'Noirs profonds',
    category: 'color',
    description: 'Écrase les noirs',
    preview: 'linear-gradient(135deg,#000,#222,#555)',
    effects: { shadows: -0.4, contrast: 0.1 },
  },
  {
    id: 'color-teal-orange',
    name: 'Teal & Orange',
    category: 'color',
    description: 'Look blockbuster',
    preview: 'linear-gradient(135deg,#008080,#ff7f50)',
    effects: { temperature: 0.15, tint: -0.1, saturation: 0.1, contrast: 0.12, vignette: 0.25 },
  },

  // —— Blur ——
  {
    id: 'blur-soft',
    name: 'Flou doux',
    category: 'blur',
    description: 'Flou gaussien léger',
    preview: 'linear-gradient(135deg,#555,#999)',
    effects: { blur: 4 },
  },
  {
    id: 'blur-strong',
    name: 'Flou fort',
    category: 'blur',
    description: 'Flou d’arrière-plan',
    preview: 'linear-gradient(135deg,#333,#777)',
    effects: { blur: 12 },
  },
  {
    id: 'blur-motion',
    name: 'Flou de mouvement',
    category: 'blur',
    description: 'Suggestion de motion blur',
    preview: 'linear-gradient(90deg,#222,#aaa,#222)',
    effects: { blur: 6, opacity: 0.95 },
  },

  // —— Stylize ——
  {
    id: 'style-glitch',
    name: 'Glitch',
    category: 'stylize',
    description: 'Décalage RGB / scanlines',
    preview: 'linear-gradient(90deg,#ff0040,#00ffcc,#0040ff)',
    effects: { glitch: 0.55, contrast: 0.15, saturation: 0.2 },
  },
  {
    id: 'style-edge',
    name: 'Contours',
    category: 'stylize',
    description: 'Détection de contours',
    preview: 'linear-gradient(135deg,#000,#fff,#000)',
    effects: { edge: 0.7, contrast: 0.2, saturation: -0.5 },
  },
  {
    id: 'style-sharpen',
    name: 'Netteté',
    category: 'stylize',
    description: 'Accentuation des détails',
    preview: 'linear-gradient(135deg,#444,#ccc)',
    effects: { sharpen: 0.6, contrast: 0.08 },
  },
  {
    id: 'style-shadow',
    name: 'Ombre portée',
    category: 'stylize',
    description: 'Ombre sous l’élément',
    preview: 'linear-gradient(135deg,#1a1a1a,#4a4a4a)',
    effects: { shadow: 0.6 },
  },

  // —— Light ——
  {
    id: 'light-glow',
    name: 'Lueur',
    category: 'light',
    description: 'Glow soft autour des hautes lumières',
    preview: 'radial-gradient(circle,#fff8,#4f8cff44,#0000)',
    effects: { glow: 0.5, exposure: 0.08, brightness: 0.05 },
  },
  {
    id: 'light-bloom',
    name: 'Bloom',
    category: 'light',
    description: 'Bloom intense',
    preview: 'radial-gradient(circle,#fffa,#f0b42966,#0000)',
    effects: { glow: 0.85, exposure: 0.15, blur: 1 },
  },
  {
    id: 'light-vignette',
    name: 'Vignette',
    category: 'light',
    description: 'Assombrit les bords',
    preview: 'radial-gradient(circle,#666,#111)',
    effects: { vignette: 0.65 },
  },

  // —— Distort ——
  {
    id: 'distort-wave',
    name: 'Distorsion',
    category: 'distort',
    description: 'Ondulation de l’image',
    preview: 'linear-gradient(45deg,#2a2a4a,#4a2a6a)',
    effects: { distortion: 0.45 },
  },
  {
    id: 'distort-glitch-heavy',
    name: 'Glitch fort',
    category: 'distort',
    description: 'Artefacts numériques forts',
    preview: 'linear-gradient(90deg,#f0f,#0ff,#f00)',
    effects: { glitch: 0.9, distortion: 0.3, saturation: 0.3 },
  },

  // —— Masks ——
  {
    id: 'mask-circle',
    name: 'Masque circulaire',
    category: 'mask',
    description: 'Vignette circulaire avec feather',
    preview: 'radial-gradient(circle,#fff,#000)',
    effects: { maskEnabled: true, maskType: 'circle', maskFeather: 0.2 },
  },
  {
    id: 'mask-rect',
    name: 'Masque rectangulaire',
    category: 'mask',
    description: 'Cadre rectangulaire',
    preview: 'linear-gradient(#fff 20%,#000 20%,#000 80%,#fff 80%)',
    effects: { maskEnabled: true, maskType: 'rect', maskFeather: 0.1 },
  },

  // —— Motion / animation helpers ——
  {
    id: 'anim-fade-in',
    name: 'Entrée fondu',
    category: 'motion',
    description: 'Opacité 0→1 sur 0,6s',
    preview: 'linear-gradient(90deg,#0000,#fff)',
    effects: {},
    animIn: { opacity: 0, duration: 0.6 },
  },
  {
    id: 'anim-scale-in',
    name: 'Entrée zoom',
    category: 'motion',
    description: 'Scale 0,7→1 avec ease-out',
    preview: 'radial-gradient(circle,#4f8cff,#0000)',
    effects: {},
    animIn: { scale: 0.7, duration: 0.7 },
  },
  {
    id: 'anim-slide-up',
    name: 'Entrée bas→haut',
    category: 'motion',
    description: 'Glissement vertical',
    preview: 'linear-gradient(0deg,#4f8cff,#0000)',
    effects: {},
    animIn: { positionY: 0.4, opacity: 0, duration: 0.6 },
  },
  {
    id: 'anim-fade-out',
    name: 'Sortie fondu',
    category: 'motion',
    description: 'Opacité →0 en fin de clip',
    preview: 'linear-gradient(90deg,#fff,#0000)',
    effects: {},
    animOut: { opacity: 0, duration: 0.6 },
  },
];

export function getPresetById(id: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((p) => p.id === id);
}

export function applyPresetToEffects(
  current: ClipEffects,
  preset: EffectPreset
): ClipEffects {
  return {
    ...current,
    ...preset.effects,
    filterId: preset.effects.filterId ?? preset.id,
  };
}

export function resetEffects(): ClipEffects {
  return defaultEffects();
}

/** Categories that show as filter chips with live preview swatches */
export function presetsByCategory(cat: EffectCategory): EffectPreset[] {
  return EFFECT_PRESETS.filter((p) => p.category === cat);
}
