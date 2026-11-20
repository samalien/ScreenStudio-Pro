/**
 * Creative Library – resource catalog types.
 * Admin can extend via JSON without code changes.
 */

export type LibraryCategoryId =
  | 'video-templates'
  | 'ad-templates'
  | 'tiktok'
  | 'reels'
  | 'shorts'
  | 'presentation'
  | 'transitions'
  | 'effects'
  | 'filters'
  | 'stickers'
  | 'icons'
  | 'fonts'
  | 'music'
  | 'sfx'
  | 'animations'
  | 'graphics';

export type LicenseType = 'free' | 'premium' | 'cc0' | 'cc-by' | 'proprietary';

export type ResourceKind =
  | 'template'      // full project / timeline template
  | 'transition'
  | 'effect'
  | 'filter'
  | 'sticker'
  | 'icon'
  | 'font'
  | 'audio'
  | 'animation'
  | 'graphic';

export interface LibraryCategory {
  id: LibraryCategoryId;
  label: string;
  labelEn: string;
  icon: string; // lucide-ish name or emoji
  description?: string;
  kinds: ResourceKind[];
}

export interface LibraryResource {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category: LibraryCategoryId;
  kind: ResourceKind;
  tags: string[];
  /** free | premium | cc0… */
  license: LicenseType;
  premium: boolean;
  /** duration in seconds (templates / audio) */
  duration?: number;
  /** thumbnail data URL or path under public/library */
  thumbnail?: string;
  /** accent color for card */
  color?: string;
  /** preview media URL */
  previewUrl?: string;
  /** For templates: structure applied to timeline */
  template?: TemplatePayload;
  /** For effects / filters: id matching engine libraries */
  engineId?: string;
  /** For stickers / icons: emoji or asset path */
  asset?: string;
  /** For fonts: CSS family */
  fontFamily?: string;
  /** For audio: path or builtin id */
  audioUrl?: string;
  /** BPM / mood for music */
  mood?: string;
  bpm?: number;
  /** Author / pack */
  author?: string;
  pack?: string;
  /** ISO date */
  createdAt?: string;
  updatedAt?: string;
  downloads?: number;
  rating?: number;
}

/** Serializable timeline template applied when user clicks « Utiliser » */
export interface TemplatePayload {
  projectName?: string;
  width?: number;
  height?: number;
  fps?: number;
  /** clear existing timeline before apply */
  replace?: boolean;
  clips: TemplateClip[];
  tracks?: { id: number; label: string; kind: string }[];
}

export interface TemplateClip {
  type: 'video' | 'audio' | 'text' | 'image';
  name: string;
  start: number;
  duration: number;
  track: number;
  text?: string;
  textStyle?: Record<string, unknown>;
  richTextStyle?: Record<string, unknown>;
  textAnimation?: Record<string, unknown>;
  src?: string;
  effects?: Record<string, unknown>;
  transitionIn?: string;
  transitionOut?: string;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface LibraryCatalog {
  version: number;
  updatedAt: string;
  categories: LibraryCategory[];
  resources: LibraryResource[];
}

export interface LibraryFilters {
  query: string;
  category: LibraryCategoryId | 'all';
  kind: ResourceKind | 'all';
  license: 'all' | 'free' | 'premium';
  favoritesOnly: boolean;
  tags: string[];
  sort: 'popular' | 'newest' | 'name' | 'duration';
}
