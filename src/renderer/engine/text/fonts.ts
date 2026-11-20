/**
 * Font library for ScreenStudio Pro text engine.
 * System + web-safe + Arabic-capable fonts.
 * Custom fonts can be registered at runtime (FontFace).
 */

import type { FontItem } from './types';

export const FONT_LIBRARY: FontItem[] = [
  // Sans
  {
    id: 'inter',
    family: 'Inter, system-ui, sans-serif',
    label: 'Inter',
    category: 'sans',
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: 'system-ui',
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    label: 'System UI',
    category: 'system',
    weights: [400, 600, 700],
  },
  {
    id: 'arial',
    family: 'Arial, Helvetica, sans-serif',
    label: 'Arial',
    category: 'sans',
    weights: [400, 700],
  },
  {
    id: 'helvetica',
    family: 'Helvetica, Arial, sans-serif',
    label: 'Helvetica',
    category: 'sans',
    weights: [400, 700],
  },
  {
    id: 'roboto',
    family: 'Roboto, "Helvetica Neue", sans-serif',
    label: 'Roboto',
    category: 'sans',
    weights: [300, 400, 500, 700],
    url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  },
  {
    id: 'montserrat',
    family: 'Montserrat, system-ui, sans-serif',
    label: 'Montserrat',
    category: 'sans',
    weights: [400, 600, 700, 800],
    url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
  },
  {
    id: 'poppins',
    family: 'Poppins, system-ui, sans-serif',
    label: 'Poppins',
    category: 'sans',
    weights: [400, 500, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  },
  {
    id: 'oswald',
    family: 'Oswald, Impact, sans-serif',
    label: 'Oswald',
    category: 'display',
    weights: [400, 500, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap',
  },
  {
    id: 'bebas',
    family: '"Bebas Neue", Impact, sans-serif',
    label: 'Bebas Neue',
    category: 'display',
    weights: [400],
    url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  },
  // Serif
  {
    id: 'georgia',
    family: 'Georgia, "Times New Roman", serif',
    label: 'Georgia',
    category: 'serif',
    weights: [400, 700],
  },
  {
    id: 'playfair',
    family: '"Playfair Display", Georgia, serif',
    label: 'Playfair Display',
    category: 'serif',
    weights: [400, 600, 700],
    url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap',
  },
  {
    id: 'merriweather',
    family: 'Merriweather, Georgia, serif',
    label: 'Merriweather',
    category: 'serif',
    weights: [400, 700],
    url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  },
  // Mono
  {
    id: 'jetbrains',
    family: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    label: 'JetBrains Mono',
    category: 'mono',
    weights: [400, 500, 700],
    url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
  },
  {
    id: 'courier',
    family: '"Courier New", Courier, monospace',
    label: 'Courier New',
    category: 'mono',
    weights: [400, 700],
  },
  // Hand / script
  {
    id: 'pacifico',
    family: 'Pacifico, cursive',
    label: 'Pacifico',
    category: 'hand',
    weights: [400],
    url: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
  },
  {
    id: 'dancing',
    family: '"Dancing Script", cursive',
    label: 'Dancing Script',
    category: 'hand',
    weights: [400, 700],
    url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap',
  },
  // Arabic / RTL capable
  {
    id: 'noto-naskh',
    family: '"Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif',
    label: 'Noto Naskh Arabic',
    category: 'arabic',
    weights: [400, 500, 600, 700],
    supportsRtl: true,
    url: 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap',
  },
  {
    id: 'noto-sans-arabic',
    family: '"Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif',
    label: 'Noto Sans Arabic',
    category: 'arabic',
    weights: [400, 500, 600, 700],
    supportsRtl: true,
    url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap',
  },
  {
    id: 'amiri',
    family: 'Amiri, "Times New Roman", serif',
    label: 'Amiri',
    category: 'arabic',
    weights: [400, 700],
    supportsRtl: true,
    url: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap',
  },
  {
    id: 'cairo',
    family: 'Cairo, "Segoe UI", Tahoma, sans-serif',
    label: 'Cairo',
    category: 'arabic',
    weights: [400, 600, 700],
    supportsRtl: true,
    url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  },
  {
    id: 'tahoma',
    family: 'Tahoma, "Segoe UI", sans-serif',
    label: 'Tahoma (RTL)',
    category: 'arabic',
    weights: [400, 700],
    supportsRtl: true,
  },
];

const loadedFonts = new Set<string>();

/** Load a font CSS URL (Google Fonts or custom) once */
export function ensureFontLoaded(font: FontItem): void {
  if (!font.url || loadedFonts.has(font.id) || typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = font.url;
  document.head.appendChild(link);
  loadedFonts.add(font.id);
}

export function ensureAllWebFonts(): void {
  FONT_LIBRARY.forEach((f) => {
    if (f.url) ensureFontLoaded(f);
  });
}

/** Register a user-imported font file via FontFace API */
export async function importFontFile(
  file: File,
  familyName?: string
): Promise<FontItem> {
  const name = familyName || file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const buffer = await file.arrayBuffer();
  const face = new FontFace(name, buffer);
  await face.load();
  (document.fonts as any).add(face);
  const item: FontItem = {
    id: `custom-${Date.now()}`,
    family: `"${name}", sans-serif`,
    label: name,
    category: 'system',
    weights: [400, 700],
    supportsRtl: false,
  };
  FONT_LIBRARY.push(item);
  return item;
}

export function getFontById(id: string): FontItem | undefined {
  return FONT_LIBRARY.find((f) => f.id === id);
}

export function getFontsByCategory(cat: FontItem['category']): FontItem[] {
  return FONT_LIBRARY.filter((f) => f.category === cat);
}

/** Detect if text contains Arabic / RTL characters */
export function containsRtlScript(text: string): boolean {
  // Arabic, Hebrew, etc.
  return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    text
  );
}

export function resolveDirection(
  text: string,
  preferred: 'ltr' | 'rtl' | 'auto'
): 'ltr' | 'rtl' {
  if (preferred === 'ltr' || preferred === 'rtl') return preferred;
  return containsRtlScript(text) ? 'rtl' : 'ltr';
}
