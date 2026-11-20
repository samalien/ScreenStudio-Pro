/**
 * Creative Library store – catalog, search, favorites, custom resources.
 * External catalog JSON can be loaded without code changes.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  LibraryCatalog,
  LibraryResource,
  LibraryCategory,
  LibraryCategoryId,
  LibraryFilters,
  ResourceKind,
  TemplatePayload,
} from '../engine/library/types';
import { DEFAULT_CATALOG, LIBRARY_CATEGORIES } from '../engine/library/catalog';

const FAV_KEY = 'ssp_library_favorites_v1';
const CUSTOM_KEY = 'ssp_library_custom_v1';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

interface LibraryState {
  catalog: LibraryCatalog;
  favorites: string[];
  customResources: LibraryResource[];
  filters: LibraryFilters;
  selectedId: string | null;

  setFilter: <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => void;
  setQuery: (q: string) => void;
  setCategory: (c: LibraryCategoryId | 'all') => void;
  resetFilters: () => void;

  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  getFiltered: () => LibraryResource[];
  getById: (id: string) => LibraryResource | undefined;
  getCategories: () => LibraryCategory[];

  /** Admin / user: add resource without code change */
  addCustomResource: (res: Omit<LibraryResource, 'id'> & { id?: string }) => string;
  removeCustomResource: (id: string) => void;
  updateCustomResource: (id: string, patch: Partial<LibraryResource>) => void;

  /** Load external catalog (merge or replace) */
  loadExternalCatalog: (data: LibraryCatalog, mode?: 'merge' | 'replace') => void;
  /** Import from JSON file content */
  importCatalogJson: (json: string, mode?: 'merge' | 'replace') => { ok: boolean; error?: string; count?: number };
  exportCatalogJson: () => string;

  select: (id: string | null) => void;
}

const defaultFilters = (): LibraryFilters => ({
  query: '',
  category: 'all',
  kind: 'all',
  license: 'all',
  favoritesOnly: false,
  tags: [],
  sort: 'popular',
});

export const useLibraryStore = create<LibraryState>((set, get) => ({
  catalog: DEFAULT_CATALOG,
  favorites: loadJson<string[]>(FAV_KEY, []),
  customResources: loadJson<LibraryResource[]>(CUSTOM_KEY, []),
  filters: defaultFilters(),
  selectedId: null,

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  setQuery: (q) => set((s) => ({ filters: { ...s.filters, query: q } })),
  setCategory: (c) => set((s) => ({ filters: { ...s.filters, category: c } })),
  resetFilters: () => set({ filters: defaultFilters() }),

  toggleFavorite: (id) => {
    const favs = get().favorites;
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    saveJson(FAV_KEY, next);
    set({ favorites: next });
  },
  isFavorite: (id) => get().favorites.includes(id),

  getCategories: () => get().catalog.categories?.length ? get().catalog.categories : LIBRARY_CATEGORIES,

  getById: (id) => {
    const all = [...get().catalog.resources, ...get().customResources];
    return all.find((r) => r.id === id);
  },

  getFiltered: () => {
    const { catalog, customResources, filters, favorites } = get();
    let list = [...catalog.resources, ...customResources];

    if (filters.category !== 'all') {
      list = list.filter((r) => r.category === filters.category);
    }
    if (filters.kind !== 'all') {
      list = list.filter((r) => r.kind === filters.kind);
    }
    if (filters.license === 'free') {
      list = list.filter((r) => !r.premium && (r.license === 'free' || r.license === 'cc0' || r.license === 'cc-by'));
    } else if (filters.license === 'premium') {
      list = list.filter((r) => r.premium || r.license === 'premium');
    }
    if (filters.favoritesOnly) {
      list = list.filter((r) => favorites.includes(r.id));
    }
    if (filters.tags.length) {
      list = list.filter((r) => filters.tags.every((t) => r.tags.includes(t)));
    }
    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.nameEn || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.category.includes(q)
      );
    }

    switch (filters.sort) {
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'duration':
        list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'popular':
      default:
        list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0) || a.name.localeCompare(b.name));
        break;
    }
    return list;
  },

  addCustomResource: (res) => {
    const id = res.id || `custom-${uuidv4().slice(0, 8)}`;
    const item: LibraryResource = {
      premium: false,
      license: 'free',
      tags: [],
      ...res,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...get().customResources, item];
    saveJson(CUSTOM_KEY, next);
    set({ customResources: next });
    return id;
  },

  removeCustomResource: (id) => {
    const next = get().customResources.filter((r) => r.id !== id);
    saveJson(CUSTOM_KEY, next);
    set({ customResources: next });
  },

  updateCustomResource: (id, patch) => {
    const next = get().customResources.map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
    );
    saveJson(CUSTOM_KEY, next);
    set({ customResources: next });
  },

  loadExternalCatalog: (data, mode = 'merge') => {
    if (mode === 'replace') {
      set({ catalog: data });
      return;
    }
    set((s) => ({
      catalog: {
        version: Math.max(s.catalog.version, data.version || 1),
        updatedAt: data.updatedAt || new Date().toISOString(),
        categories: data.categories?.length ? data.categories : s.catalog.categories,
        resources: [
          ...s.catalog.resources.filter((r) => !data.resources.some((d) => d.id === r.id)),
          ...data.resources,
        ],
      },
    }));
  },

  importCatalogJson: (json, mode = 'merge') => {
    try {
      const data = JSON.parse(json) as LibraryCatalog;
      if (!data.resources || !Array.isArray(data.resources)) {
        return { ok: false, error: 'JSON invalide : resources manquant' };
      }
      get().loadExternalCatalog(
        {
          version: data.version || 1,
          updatedAt: data.updatedAt || new Date().toISOString(),
          categories: data.categories || LIBRARY_CATEGORIES,
          resources: data.resources,
        },
        mode
      );
      return { ok: true, count: data.resources.length };
    } catch (e: any) {
      return { ok: false, error: String(e.message || e) };
    }
  },

  exportCatalogJson: () => {
    const { catalog, customResources } = get();
    const full: LibraryCatalog = {
      version: catalog.version,
      updatedAt: new Date().toISOString(),
      categories: catalog.categories,
      resources: [...catalog.resources, ...customResources],
    };
    return JSON.stringify(full, null, 2);
  },

  select: (id) => set({ selectedId: id }),
}));

/** Apply a template payload to the project store */
export function applyTemplateToProject(
  template: TemplatePayload,
  deps: {
    addClip: (data: any) => string;
    clearProject?: () => void;
    setProjectMeta?: (name: string, path: string | null) => void;
    currentTime: number;
  }
) {
  if (template.replace && deps.clearProject) {
    deps.clearProject();
  }
  if (template.projectName && deps.setProjectMeta) {
    deps.setProjectMeta(template.projectName, null);
  }
  const offset = template.replace ? 0 : deps.currentTime;
  template.clips.forEach((c) => {
    deps.addClip({
      type: c.type,
      name: c.name,
      start: c.start + offset,
      duration: c.duration,
      trimStart: 0,
      src: c.src || '',
      sourceDuration: c.duration,
      track: c.track,
      volume: c.volume ?? 1,
      text: c.text,
      textStyle: c.textStyle,
      richTextStyle: c.richTextStyle,
      textAnimation: c.textAnimation,
      effects: c.effects,
      transitionIn: c.transitionIn || 'none',
      transitionOut: c.transitionOut || 'none',
      fadeIn: c.fadeIn ?? 0,
      fadeOut: c.fadeOut ?? 0,
      speed: 1,
      reverse: false,
      locked: false,
      muted: false,
      keyframes: [],
    });
  });
}
