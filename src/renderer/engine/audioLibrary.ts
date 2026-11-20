/**
 * Audio effects preset library.
 */

import type { AudioSettings } from './types';
import { defaultAudioSettings } from './types';

export interface AudioEffectPreset {
  id: string;
  name: string;
  category: 'eq' | 'voice' | 'space' | 'utility' | 'creative';
  description: string;
  audio: Partial<AudioSettings>;
}

export const AUDIO_EFFECT_PRESETS: AudioEffectPreset[] = [
  {
    id: 'eq-bass-boost',
    name: 'Bass boost',
    category: 'eq',
    description: 'Renforce les basses fréquences',
    audio: { lowGain: 0.55, midGain: 0, highGain: -0.1 },
  },
  {
    id: 'eq-voice',
    name: 'Voix claire',
    category: 'voice',
    description: 'Médiums relevés, basses attenuées',
    audio: { lowGain: -0.25, midGain: 0.4, highGain: 0.15, vocalEnhance: 0.5 },
  },
  {
    id: 'eq-bright',
    name: 'Aiguës',
    category: 'eq',
    description: 'Présence et clarté',
    audio: { highGain: 0.5, midGain: 0.1 },
  },
  {
    id: 'eq-warm',
    name: 'Chaleur',
    category: 'eq',
    description: 'Basses douces, aiguës adoucies',
    audio: { lowGain: 0.3, highGain: -0.2, midGain: 0.05 },
  },
  {
    id: 'voice-radio',
    name: 'Radio',
    category: 'voice',
    description: 'Effet voix radio (médiums forts)',
    audio: { lowGain: -0.5, midGain: 0.6, highGain: -0.15, vocalEnhance: 0.3 },
  },
  {
    id: 'voice-gate',
    name: 'Noise gate',
    category: 'utility',
    description: 'Réduit les bruits de fond faibles',
    audio: { noiseGate: 0.65 },
  },
  {
    id: 'util-normalize',
    name: 'Normaliser',
    category: 'utility',
    description: 'Normalisation de peak',
    audio: { normalize: true },
  },
  {
    id: 'space-reverb',
    name: 'Réverbération',
    category: 'space',
    description: 'Espace ambiant léger',
    audio: { reverb: 0.45 },
  },
  {
    id: 'space-echo',
    name: 'Écho',
    category: 'space',
    description: 'Delay avec feedback',
    audio: { echo: 0.4 },
  },
  {
    id: 'space-hall',
    name: 'Hall',
    category: 'space',
    description: 'Réverb + léger écho',
    audio: { reverb: 0.6, echo: 0.2 },
  },
  {
    id: 'creative-telephone',
    name: 'Téléphone',
    category: 'creative',
    description: 'Bande passante étroite',
    audio: { lowGain: -0.7, highGain: -0.5, midGain: 0.5 },
  },
  {
    id: 'creative-chipmunk',
    name: 'Aigu (pitch +)',
    category: 'creative',
    description: 'Remonte le pitch (+4 demi-tons)',
    audio: { pitch: 4 },
  },
  {
    id: 'creative-deep',
    name: 'Grave (pitch -)',
    category: 'creative',
    description: 'Descend le pitch (-4 demi-tons)',
    audio: { pitch: -4 },
  },
  {
    id: 'pan-left',
    name: 'Pan gauche',
    category: 'utility',
    description: 'Balance à gauche',
    audio: { pan: -0.85 },
  },
  {
    id: 'pan-right',
    name: 'Pan droite',
    category: 'utility',
    description: 'Balance à droite',
    audio: { pan: 0.85 },
  },
];

export function applyAudioPreset(
  current: AudioSettings | undefined,
  preset: AudioEffectPreset
): AudioSettings {
  return {
    ...defaultAudioSettings(),
    ...(current || {}),
    ...preset.audio,
    effectId: preset.id,
  };
}
