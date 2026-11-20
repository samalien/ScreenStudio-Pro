/**
 * Unified generative AI types — providers, jobs, credits, results.
 * No feature claims success without a real connected provider response.
 */

export type AICapability =
  | 'text-to-image'
  | 'image-to-image'
  | 'image-variation'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-speech'
  | 'speech-to-text'
  | 'avatar'
  | 'lip-sync'
  | 'bg-remove'
  | 'object-remove'
  | 'upscale'
  | 'denoise'
  | 'auto-edit'
  | 'scene-detect'
  | 'script'
  | 'titles'
  | 'description'
  | 'hashtags'
  | 'long-to-shorts';

export type AIJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'needs_config';

export type AIProviderId =
  | 'openai'
  | 'stability'
  | 'replicate'
  | 'elevenlabs'
  | 'anthropic'
  | 'local'
  | 'browser';

export interface AIProviderConfig {
  id: AIProviderId;
  label: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  /** model defaults per capability */
  models: Partial<Record<AICapability, string>>;
  /** estimated USD per unit for UI cost hints */
  costHints: Partial<Record<AICapability, number>>;
  capabilities: AICapability[];
}

export interface AIJobInput {
  capability: AICapability;
  prompt?: string;
  negativePrompt?: string;
  sourceUrl?: string; // image/video/audio
  language?: string;
  voiceId?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  style?: string;
  extra?: Record<string, unknown>;
}

export interface AIJobResult {
  type: 'image' | 'video' | 'audio' | 'text' | 'json';
  url?: string;
  blob?: Blob;
  text?: string;
  json?: unknown;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface AIJob {
  id: string;
  providerId: AIProviderId;
  capability: AICapability;
  status: AIJobStatus;
  input: AIJobInput;
  progress: number;
  message: string;
  error?: string;
  result?: AIJobResult;
  createdAt: number;
  updatedAt: number;
  estimatedCost?: number;
}

export interface AIProvider {
  id: AIProviderId;
  label: string;
  capabilities: AICapability[];
  isConfigured(config: AIProviderConfig): boolean;
  run(
    job: AIJob,
    config: AIProviderConfig,
    onProgress: (ratio: number, message: string) => void,
    signal?: AbortSignal
  ): Promise<AIJobResult>;
}

export const CAPABILITY_LABELS: Record<AICapability, string> = {
  'text-to-image': 'Texte → image',
  'image-to-image': 'Image → image',
  'image-variation': 'Variations d’image',
  'text-to-video': 'Texte → vidéo',
  'image-to-video': 'Image → vidéo',
  'text-to-speech': 'Texte → voix',
  'speech-to-text': 'Parole → texte',
  avatar: 'Avatar virtuel',
  'lip-sync': 'Sync labiale',
  'bg-remove': 'Suppression d’arrière-plan',
  'object-remove': 'Suppression d’objet',
  upscale: 'Amélioration qualité',
  denoise: 'Réduction de bruit',
  'auto-edit': 'Montage automatique',
  'scene-detect': 'Détection de scènes',
  script: 'Génération de script',
  titles: 'Titres',
  description: 'Description',
  hashtags: 'Hashtags',
  'long-to-shorts': 'Long → clips courts',
};

export const CAPABILITY_GROUPS: { id: string; label: string; items: AICapability[] }[] = [
  {
    id: 'video',
    label: 'Vidéo',
    items: ['text-to-video', 'image-to-video', 'auto-edit', 'scene-detect', 'long-to-shorts'],
  },
  {
    id: 'image',
    label: 'Image',
    items: ['text-to-image', 'image-to-image', 'image-variation', 'bg-remove', 'object-remove', 'upscale'],
  },
  {
    id: 'avatar',
    label: 'Avatars',
    items: ['avatar', 'lip-sync'],
  },
  {
    id: 'voice',
    label: 'Voix',
    items: ['text-to-speech', 'speech-to-text'],
  },
  {
    id: 'text',
    label: 'Texte & automatisation',
    items: ['script', 'titles', 'description', 'hashtags', 'denoise'],
  },
];
