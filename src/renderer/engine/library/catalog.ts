/**
 * Default creative catalog.
 * Admin can override / extend by placing a JSON file and loading it at runtime
 * (see libraryStore.loadExternalCatalog).
 */

import type { LibraryCatalog, LibraryCategory, LibraryResource } from './types';

export const LIBRARY_CATEGORIES: LibraryCategory[] = [
  { id: 'video-templates', label: 'Modèles vidéo', labelEn: 'Video templates', icon: 'Film', kinds: ['template'] },
  { id: 'ad-templates', label: 'Publicité', labelEn: 'Ad templates', icon: 'Megaphone', kinds: ['template'] },
  { id: 'tiktok', label: 'TikTok', labelEn: 'TikTok', icon: 'Smartphone', kinds: ['template'] },
  { id: 'reels', label: 'Instagram Reels', labelEn: 'Reels', icon: 'Instagram', kinds: ['template'] },
  { id: 'shorts', label: 'YouTube Shorts', labelEn: 'Shorts', icon: 'Youtube', kinds: ['template'] },
  { id: 'presentation', label: 'Présentation', labelEn: 'Presentation', icon: 'Presentation', kinds: ['template'] },
  { id: 'transitions', label: 'Transitions', labelEn: 'Transitions', icon: 'Shuffle', kinds: ['transition'] },
  { id: 'effects', label: 'Effets visuels', labelEn: 'Visual effects', icon: 'Sparkles', kinds: ['effect'] },
  { id: 'filters', label: 'Filtres', labelEn: 'Filters', icon: 'Palette', kinds: ['filter'] },
  { id: 'stickers', label: 'Stickers', labelEn: 'Stickers', icon: 'Sticker', kinds: ['sticker'] },
  { id: 'icons', label: 'Icônes', labelEn: 'Icons', icon: 'Shapes', kinds: ['icon'] },
  { id: 'fonts', label: 'Polices', labelEn: 'Fonts', icon: 'Type', kinds: ['font'] },
  { id: 'music', label: 'Musiques', labelEn: 'Music', icon: 'Music', kinds: ['audio'] },
  { id: 'sfx', label: 'Effets sonores', labelEn: 'SFX', icon: 'Volume2', kinds: ['audio'] },
  { id: 'animations', label: 'Animations', labelEn: 'Animations', icon: 'Wand2', kinds: ['animation'] },
  { id: 'graphics', label: 'Éléments graphiques', labelEn: 'Graphics', icon: 'PenTool', kinds: ['graphic'] },
];

const T = (
  partial: Omit<LibraryResource, 'tags' | 'license' | 'premium'> & {
    tags?: string[];
    license?: LibraryResource['license'];
    premium?: boolean;
  }
): LibraryResource => ({
  premium: false,
  license: 'free',
  ...partial,
  tags: partial.tags ?? [],
});

export const DEFAULT_RESOURCES: LibraryResource[] = [
  // ——— Video templates ———
  T({
    id: 'tpl-intro-tech',
    name: 'Intro Tech',
    nameEn: 'Tech Intro',
    description: 'Titre animé + fondu pour tutoriels tech',
    category: 'video-templates',
    kind: 'template',
    tags: ['intro', 'tech', 'tutoriel'],
    duration: 5,
    color: '#4f8cff',
    license: 'free',
    template: {
      projectName: 'Intro Tech',
      replace: false,
      clips: [
        {
          type: 'text',
          name: 'Titre',
          start: 0.3,
          duration: 3.5,
          track: 3,
          text: 'TUTORIEL TECH',
          textStyle: { fontSize: 64, color: '#ffffff', fontFamily: 'Montserrat, sans-serif', fontWeight: 800 },
          textAnimation: { enter: 'scale-up', exit: 'fade', enterDuration: 0.5, exitDuration: 0.4 },
          fadeIn: 0.2,
          fadeOut: 0.3,
        },
        {
          type: 'text',
          name: 'Sous-titre',
          start: 1.2,
          duration: 2.8,
          track: 3,
          text: 'ScreenStudio Pro',
          textStyle: { fontSize: 32, color: '#4f8cff', fontFamily: 'Inter, sans-serif' },
          textAnimation: { enter: 'slide-up', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 },
        },
      ],
    },
  }),
  T({
    id: 'tpl-outro-cta',
    name: 'Outro CTA',
    nameEn: 'Outro CTA',
    description: 'Appel à l’action + réseaux sociaux',
    category: 'video-templates',
    kind: 'template',
    tags: ['outro', 'cta', 'social'],
    duration: 4,
    color: '#a78bfa',
    template: {
      projectName: 'Outro CTA',
      replace: false,
      clips: [
        {
          type: 'text',
          name: 'CTA',
          start: 0.2,
          duration: 3.5,
          track: 3,
          text: 'ABONNEZ-VOUS',
          textStyle: { fontSize: 56, color: '#ffffff', fontFamily: 'Oswald, sans-serif', letterSpacing: 4 },
          textAnimation: { enter: 'pop', exit: 'fade', enterDuration: 0.45, exitDuration: 0.3 },
        },
        {
          type: 'text',
          name: 'Social',
          start: 1.5,
          duration: 2.2,
          track: 3,
          text: '👍 Like  ·  🔔 Notifs  ·  💬 Comment',
          textStyle: { fontSize: 28, color: '#c8cdd5', fontFamily: 'Inter, sans-serif' },
          textAnimation: { enter: 'fade', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 },
        },
      ],
    },
  }),
  T({
    id: 'tpl-lower-third-pro',
    name: 'Lower third Pro',
    nameEn: 'Pro Lower Third',
    description: 'Bandeau bas d’écran élégant',
    category: 'video-templates',
    kind: 'template',
    tags: ['titre', 'lower-third', 'interview'],
    duration: 4,
    color: '#22d3ee',
    template: {
      replace: false,
      clips: [
        {
          type: 'text',
          name: 'Lower third',
          start: 0.2,
          duration: 3.5,
          track: 3,
          text: 'Alex Martin  ·  Expert produit',
          richTextStyle: {
            fontFamily: 'Inter, sans-serif',
            fontSize: 34,
            fontWeight: 600,
            color: '#ffffff',
            align: 'left',
            positionX: -0.32,
            positionY: 0.38,
            positionMode: 'normalized',
            background: { enabled: true, color: '#4f8cff', opacity: 0.92, paddingX: 24, paddingY: 12, borderRadius: 6 },
            opacity: 1,
            letterSpacing: 0,
            lineHeight: 1.2,
            direction: 'ltr',
            verticalAlign: 'middle',
            fontStyle: 'normal',
          },
          textAnimation: { enter: 'slide-left', exit: 'slide-left', enterDuration: 0.4, exitDuration: 0.35 },
        },
      ],
    },
  }),

  // ——— Ad templates ———
  T({
    id: 'ad-product-15s',
    name: 'Pub produit 15s',
    nameEn: 'Product Ad 15s',
    description: 'Hook + bénéfice + CTA pour pubs courtes',
    category: 'ad-templates',
    kind: 'template',
    tags: ['ads', 'product', '15s'],
    duration: 15,
    color: '#f472b6',
    premium: false,
    template: {
      projectName: 'Pub produit',
      replace: true,
      clips: [
        { type: 'text', name: 'Hook', start: 0.2, duration: 3, track: 3, text: 'Vous perdez du temps ?', textStyle: { fontSize: 48, color: '#fff', fontFamily: 'Montserrat, sans-serif' }, textAnimation: { enter: 'fade', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 } },
        { type: 'text', name: 'Benefit', start: 4, duration: 5, track: 3, text: 'Automatisez en 1 clic', textStyle: { fontSize: 52, color: '#4f8cff', fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }, textAnimation: { enter: 'scale-up', exit: 'fade', enterDuration: 0.45, exitDuration: 0.3 } },
        { type: 'text', name: 'CTA', start: 10, duration: 4.5, track: 3, text: 'Essayez gratuitement →', textStyle: { fontSize: 40, color: '#f0b429', fontFamily: 'Inter, sans-serif' }, textAnimation: { enter: 'slide-up', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 } },
      ],
    },
  }),
  T({
    id: 'ad-sale-banner',
    name: 'Bannière promo',
    nameEn: 'Sale Banner',
    description: 'Promo flash style soldes',
    category: 'ad-templates',
    kind: 'template',
    tags: ['sale', 'promo', 'banner'],
    duration: 6,
    color: '#f04438',
    premium: true,
    license: 'premium',
    template: {
      replace: false,
      clips: [
        { type: 'text', name: 'Sale', start: 0.2, duration: 5, track: 3, text: '−50% AUJOURD’HUI', textStyle: { fontSize: 56, color: '#fff', fontFamily: 'Oswald, sans-serif', letterSpacing: 2 }, textAnimation: { enter: 'bounce', exit: 'fade', enterDuration: 0.5, exitDuration: 0.3 } },
      ],
    },
  }),

  // ——— TikTok / Reels / Shorts ———
  T({
    id: 'tt-hook-vertical',
    name: 'TikTok Hook vertical',
    nameEn: 'TikTok Vertical Hook',
    description: 'Format 9:16, texte impact + CTA',
    category: 'tiktok',
    kind: 'template',
    tags: ['tiktok', 'vertical', 'hook', '9:16'],
    duration: 8,
    color: '#fe2c55',
    template: {
      projectName: 'TikTok Hook',
      width: 1080,
      height: 1920,
      replace: true,
      clips: [
        { type: 'text', name: 'Hook', start: 0.15, duration: 2.5, track: 3, text: 'STOP ✋', textStyle: { fontSize: 72, color: '#fff', fontFamily: 'Oswald, sans-serif' }, textAnimation: { enter: 'pop', exit: 'fade', enterDuration: 0.35, exitDuration: 0.25 } },
        { type: 'text', name: 'Body', start: 2.5, duration: 3.5, track: 3, text: 'Voici l’astuce que personne ne montre', textStyle: { fontSize: 36, color: '#fff', fontFamily: 'Inter, sans-serif' }, textAnimation: { enter: 'slide-up', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 } },
        { type: 'text', name: 'CTA', start: 6, duration: 1.8, track: 3, text: 'Suis pour la suite 🔥', textStyle: { fontSize: 32, color: '#fe2c55', fontFamily: 'Inter, sans-serif', fontWeight: 700 }, textAnimation: { enter: 'fade', exit: 'fade', enterDuration: 0.3, exitDuration: 0.2 } },
      ],
    },
  }),
  T({
    id: 'reels-aesthetic',
    name: 'Reels Aesthetic',
    nameEn: 'Aesthetic Reels',
    description: 'Titres doux style lifestyle',
    category: 'reels',
    kind: 'template',
    tags: ['reels', 'instagram', 'aesthetic', '9:16'],
    duration: 7,
    color: '#e1306c',
    template: {
      projectName: 'Reels Aesthetic',
      width: 1080,
      height: 1920,
      replace: true,
      clips: [
        { type: 'text', name: 'Title', start: 0.5, duration: 5, track: 3, text: 'slow mornings', textStyle: { fontSize: 48, color: '#f8f1e3', fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic' }, textAnimation: { enter: 'fade', exit: 'fade', enterDuration: 0.8, exitDuration: 0.5 } },
      ],
    },
  }),
  T({
    id: 'shorts-edu',
    name: 'Shorts éducatif',
    nameEn: 'Educational Short',
    description: 'Chapitres numérotés + punchline',
    category: 'shorts',
    kind: 'template',
    tags: ['shorts', 'youtube', 'edu', '9:16'],
    duration: 10,
    color: '#ff0000',
    template: {
      projectName: 'Shorts Edu',
      width: 1080,
      height: 1920,
      replace: true,
      clips: [
        { type: 'text', name: 'N1', start: 0.2, duration: 2.5, track: 3, text: '1. Le problème', textStyle: { fontSize: 44, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700 }, textAnimation: { enter: 'slide-left', exit: 'fade', enterDuration: 0.35, exitDuration: 0.25 } },
        { type: 'text', name: 'N2', start: 3, duration: 2.5, track: 3, text: '2. La solution', textStyle: { fontSize: 44, color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700 }, textAnimation: { enter: 'slide-left', exit: 'fade', enterDuration: 0.35, exitDuration: 0.25 } },
        { type: 'text', name: 'N3', start: 6, duration: 3.5, track: 3, text: '3. Passez à l’action', textStyle: { fontSize: 44, color: '#4f8cff', fontFamily: 'Inter, sans-serif', fontWeight: 800 }, textAnimation: { enter: 'scale-up', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 } },
      ],
    },
  }),

  // ——— Presentation ———
  T({
    id: 'pres-chapter',
    name: 'Chapitre présentation',
    nameEn: 'Presentation Chapter',
    description: 'Séparateur de section pro',
    category: 'presentation',
    kind: 'template',
    tags: ['chapter', 'presentation', 'slide'],
    duration: 3,
    color: '#3ecf8e',
    template: {
      replace: false,
      clips: [
        { type: 'text', name: 'Chapter', start: 0.2, duration: 2.5, track: 3, text: 'CHAPITRE 01', textStyle: { fontSize: 28, color: '#3ecf8e', fontFamily: 'Inter, sans-serif', letterSpacing: 6 }, textAnimation: { enter: 'fade', exit: 'fade', enterDuration: 0.4, exitDuration: 0.3 } },
        { type: 'text', name: 'Title', start: 0.5, duration: 2.2, track: 3, text: 'Le contexte', textStyle: { fontSize: 56, color: '#fff', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }, textAnimation: { enter: 'slide-up', exit: 'fade', enterDuration: 0.45, exitDuration: 0.3 } },
      ],
    },
  }),

  // ——— Transitions ———
  T({ id: 'tr-fade', name: 'Fondu', nameEn: 'Fade', category: 'transitions', kind: 'transition', tags: ['fade', 'basic'], engineId: 'fade', color: '#6b7380', description: 'Fondu enchaîné classique' }),
  T({ id: 'tr-crossfade', name: 'Fondu croisé', nameEn: 'Crossfade', category: 'transitions', kind: 'transition', tags: ['crossfade'], engineId: 'crossfade', color: '#6b7380' }),
  T({ id: 'tr-slide-left', name: 'Glissement gauche', nameEn: 'Slide left', category: 'transitions', kind: 'transition', tags: ['slide'], engineId: 'slide-left', color: '#4f8cff' }),
  T({ id: 'tr-slide-right', name: 'Glissement droite', nameEn: 'Slide right', category: 'transitions', kind: 'transition', tags: ['slide'], engineId: 'slide-right', color: '#4f8cff' }),
  T({ id: 'tr-zoom-in', name: 'Zoom avant', nameEn: 'Zoom in', category: 'transitions', kind: 'transition', tags: ['zoom'], engineId: 'zoom-in', color: '#a78bfa' }),
  T({ id: 'tr-wipe', name: 'Wipe', nameEn: 'Wipe', category: 'transitions', kind: 'transition', tags: ['wipe'], engineId: 'wipe', color: '#22d3ee', premium: true, license: 'premium' }),
  T({ id: 'tr-flash', name: 'Flash', nameEn: 'Flash', category: 'transitions', kind: 'transition', tags: ['flash'], engineId: 'flash', color: '#f0b429' }),

  // ——— Effects ———
  T({ id: 'fx-blur', name: 'Flou', nameEn: 'Blur', category: 'effects', kind: 'effect', tags: ['blur'], engineId: 'blur', color: '#6b7380' }),
  T({ id: 'fx-glow', name: 'Glow', nameEn: 'Glow', category: 'effects', kind: 'effect', tags: ['glow', 'light'], engineId: 'glow', color: '#f0b429' }),
  T({ id: 'fx-glitch', name: 'Glitch', nameEn: 'Glitch', category: 'effects', kind: 'effect', tags: ['glitch', 'distortion'], engineId: 'glitch', color: '#f472b6' }),
  T({ id: 'fx-vignette', name: 'Vignette', nameEn: 'Vignette', category: 'effects', kind: 'effect', tags: ['vignette'], engineId: 'vignette', color: '#6b7380' }),
  T({ id: 'fx-mosaic', name: 'Mosaïque / flou visage', nameEn: 'Mosaic', category: 'effects', kind: 'effect', tags: ['privacy', 'mosaic'], engineId: 'mosaic', color: '#3ecf8e' }),
  T({ id: 'fx-shadow', name: 'Ombre portée', nameEn: 'Drop shadow', category: 'effects', kind: 'effect', tags: ['shadow'], engineId: 'shadow', color: '#6b7380' }),

  // ——— Filters ———
  T({ id: 'flt-cinematic', name: 'Cinématique', nameEn: 'Cinematic', category: 'filters', kind: 'filter', tags: ['cinematic', 'grade'], engineId: 'cinematic', color: '#4f8cff' }),
  T({ id: 'flt-vintage', name: 'Vintage', nameEn: 'Vintage', category: 'filters', kind: 'filter', tags: ['vintage', 'film'], engineId: 'vintage', color: '#f0b429' }),
  T({ id: 'flt-bw', name: 'Noir & Blanc', nameEn: 'B&W', category: 'filters', kind: 'filter', tags: ['bw', 'mono'], engineId: 'bw', color: '#9aa3b2' }),
  T({ id: 'flt-teal-orange', name: 'Teal & Orange', nameEn: 'Teal Orange', category: 'filters', kind: 'filter', tags: ['cinematic', 'color'], engineId: 'teal-orange', color: '#22d3ee' }),
  T({ id: 'flt-vivid', name: 'Vif', nameEn: 'Vivid', category: 'filters', kind: 'filter', tags: ['vivid', 'sat'], engineId: 'vivid', color: '#f472b6' }),
  T({ id: 'flt-cold', name: 'Froid', nameEn: 'Cool', category: 'filters', kind: 'filter', tags: ['cool', 'temperature'], engineId: 'cool', color: '#4f8cff' }),
  T({ id: 'flt-warm', name: 'Chaud', nameEn: 'Warm', category: 'filters', kind: 'filter', tags: ['warm'], engineId: 'warm', color: '#f0b429' }),

  // ——— Stickers ———
  T({ id: 'stk-fire', name: 'Feu', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '🔥', color: '#f04438' }),
  T({ id: 'stk-star', name: 'Étoile', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '⭐', color: '#f0b429' }),
  T({ id: 'stk-heart', name: 'Cœur', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '❤️', color: '#f472b6' }),
  T({ id: 'stk-clap', name: 'Clap', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '👏', color: '#f0b429' }),
  T({ id: 'stk-rocket', name: 'Fusée', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '🚀', color: '#4f8cff' }),
  T({ id: 'stk-check', name: 'Validé', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '✅', color: '#3ecf8e' }),
  T({ id: 'stk-warning', name: 'Attention', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '⚠️', color: '#f0b429' }),
  T({ id: 'stk-idea', name: 'Idée', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '💡', color: '#f0b429' }),
  T({ id: 'stk-target', name: 'Cible', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '🎯', color: '#f04438' }),
  T({ id: 'stk-music', name: 'Musique', category: 'stickers', kind: 'sticker', tags: ['emoji'], asset: '🎵', color: '#a78bfa' }),

  // ——— Icons (text-based for now) ———
  T({ id: 'ico-play', name: 'Play', category: 'icons', kind: 'icon', tags: ['ui'], asset: '▶', color: '#4f8cff' }),
  T({ id: 'ico-pause', name: 'Pause', category: 'icons', kind: 'icon', tags: ['ui'], asset: '⏸', color: '#4f8cff' }),
  T({ id: 'ico-cam', name: 'Caméra', category: 'icons', kind: 'icon', tags: ['media'], asset: '🎬', color: '#22d3ee' }),
  T({ id: 'ico-mic', name: 'Micro', category: 'icons', kind: 'icon', tags: ['media'], asset: '🎤', color: '#a78bfa' }),

  // ——— Fonts (link to text engine) ———
  T({ id: 'fnt-inter', name: 'Inter', category: 'fonts', kind: 'font', tags: ['sans'], fontFamily: 'Inter, system-ui, sans-serif', color: '#9aa3b2' }),
  T({ id: 'fnt-montserrat', name: 'Montserrat', category: 'fonts', kind: 'font', tags: ['sans'], fontFamily: 'Montserrat, system-ui, sans-serif', color: '#9aa3b2' }),
  T({ id: 'fnt-oswald', name: 'Oswald', category: 'fonts', kind: 'font', tags: ['display'], fontFamily: 'Oswald, Impact, sans-serif', color: '#9aa3b2' }),
  T({ id: 'fnt-playfair', name: 'Playfair Display', category: 'fonts', kind: 'font', tags: ['serif'], fontFamily: '"Playfair Display", Georgia, serif', color: '#9aa3b2' }),
  T({ id: 'fnt-noto-ar', name: 'Noto Naskh Arabic', category: 'fonts', kind: 'font', tags: ['arabic', 'rtl'], fontFamily: '"Noto Naskh Arabic", Tahoma, sans-serif', color: '#3ecf8e' }),
  T({ id: 'fnt-cairo', name: 'Cairo', category: 'fonts', kind: 'font', tags: ['arabic', 'rtl'], fontFamily: 'Cairo, Tahoma, sans-serif', color: '#3ecf8e' }),

  // ——— Music (metadata only – user imports real files) ———
  T({ id: 'mus-upbeat', name: 'Upbeat Corporate', category: 'music', kind: 'audio', tags: ['corporate', 'upbeat'], mood: 'energetic', bpm: 120, duration: 90, color: '#4f8cff', license: 'cc0', description: 'Piste dynamique pour intros (importez votre fichier audio)' }),
  T({ id: 'mus-lofi', name: 'Lo-fi Chill', category: 'music', kind: 'audio', tags: ['lofi', 'chill'], mood: 'relaxed', bpm: 85, duration: 120, color: '#a78bfa', license: 'cc0' }),
  T({ id: 'mus-cinematic', name: 'Cinematic Drone', category: 'music', kind: 'audio', tags: ['cinematic', 'drone'], mood: 'epic', bpm: 70, duration: 150, color: '#22d3ee', premium: true, license: 'premium' }),
  T({ id: 'mus-tech', name: 'Tech Pulse', category: 'music', kind: 'audio', tags: ['tech', 'electronic'], mood: 'modern', bpm: 110, duration: 60, color: '#4f8cff', license: 'free' }),

  // ——— SFX ———
  T({ id: 'sfx-whoosh', name: 'Whoosh', category: 'sfx', kind: 'audio', tags: ['transition', 'whoosh'], duration: 1.2, color: '#6b7380', description: 'Souffle de transition' }),
  T({ id: 'sfx-pop', name: 'Pop', category: 'sfx', kind: 'audio', tags: ['ui', 'pop'], duration: 0.3, color: '#f0b429' }),
  T({ id: 'sfx-click', name: 'Click', category: 'sfx', kind: 'audio', tags: ['ui'], duration: 0.15, color: '#6b7380' }),
  T({ id: 'sfx-success', name: 'Success chime', category: 'sfx', kind: 'audio', tags: ['ui', 'success'], duration: 1.0, color: '#3ecf8e' }),
  T({ id: 'sfx-impact', name: 'Impact', category: 'sfx', kind: 'audio', tags: ['impact', 'hit'], duration: 0.8, color: '#f04438' }),

  // ——— Animations (text anim shortcuts) ———
  T({ id: 'an-typewriter', name: 'Machine à écrire', category: 'animations', kind: 'animation', tags: ['text', 'typewriter'], engineId: 'typewriter', color: '#4f8cff' }),
  T({ id: 'an-pop', name: 'Pop texte', category: 'animations', kind: 'animation', tags: ['text', 'pop'], engineId: 'pop', color: '#f472b6' }),
  T({ id: 'an-slide-up', name: 'Glissement vertical', category: 'animations', kind: 'animation', tags: ['text', 'slide'], engineId: 'slide-up', color: '#22d3ee' }),
  T({ id: 'an-glitch-txt', name: 'Glitch texte', category: 'animations', kind: 'animation', tags: ['text', 'glitch'], engineId: 'glitch', color: '#a78bfa', premium: true, license: 'premium' }),

  // ——— Graphics ———
  T({ id: 'gfx-shape-rect', name: 'Rectangle', category: 'graphics', kind: 'graphic', tags: ['shape'], asset: 'rect', color: '#4f8cff' }),
  T({ id: 'gfx-shape-ellipse', name: 'Ellipse', category: 'graphics', kind: 'graphic', tags: ['shape'], asset: 'ellipse', color: '#a78bfa' }),
  T({ id: 'gfx-shape-star', name: 'Étoile', category: 'graphics', kind: 'graphic', tags: ['shape'], asset: 'star', color: '#f0b429' }),
  T({ id: 'gfx-line', name: 'Ligne décorative', category: 'graphics', kind: 'graphic', tags: ['line'], asset: 'line', color: '#9aa3b2' }),
];

export const DEFAULT_CATALOG: LibraryCatalog = {
  version: 1,
  updatedAt: new Date().toISOString(),
  categories: LIBRARY_CATEGORIES,
  resources: DEFAULT_RESOURCES,
};
