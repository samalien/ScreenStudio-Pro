/**
 * UI state: theme, active view, panels, notifications, modals.
 */

import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type AppView =
  | 'dashboard'
  | 'editor'
  | 'capture'
  | 'export'
  | 'ai'
  | 'templates'
  | 'graphics'
  | 'text'
  | 'effects'
  | 'audio'
  | 'subtitles'
  | 'account'
  | 'billing'
  | 'settings';

export type NotifyType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotifyType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = persistent
  createdAt: number;
}

interface UIState {
  theme: Theme;
  view: AppView;
  sidebarCollapsed: boolean;
  propertiesOpen: boolean;
  mediaTab: 'media' | 'audio'
  | 'subtitles' | 'text' | 'effects' | 'transitions' | 'ai' | 'templates';
  notifications: Notification[];
  isSaving: boolean;
  isLoading: boolean;
  loadingMessage: string;
  projectName: string;
  projectPath: string | null;
  hasUnsavedChanges: boolean;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setView: (v: AppView) => void;
  toggleSidebar: () => void;
  setPropertiesOpen: (open: boolean) => void;
  setMediaTab: (tab: UIState['mediaTab']) => void;
  notify: (n: Omit<Notification, 'id' | 'createdAt'>) => string;
  dismissNotification: (id: string) => void;
  setSaving: (v: boolean) => void;
  setLoading: (v: boolean, message?: string) => void;
  setProjectMeta: (name: string, path: string | null) => void;
  setUnsaved: (v: boolean) => void;
}

let notifCounter = 0;

export const useUIStore = create<UIState>((set, get) => ({
  theme: (localStorage.getItem('ss-theme') as Theme) || 'dark',
  view: 'dashboard',
  sidebarCollapsed: false,
  propertiesOpen: true,
  mediaTab: 'media',
  notifications: [],
  isSaving: false,
  isLoading: false,
  loadingMessage: '',
  projectName: 'Untitled Project',
  projectPath: null,
  hasUnsavedChanges: false,

  setTheme: (theme) => {
    localStorage.setItem('ss-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
  setView: (view) => set({ view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPropertiesOpen: (open) => set({ propertiesOpen: open }),
  setMediaTab: (mediaTab) => set({ mediaTab }),
  notify: (n) => {
    const id = `n-${++notifCounter}-${Date.now()}`;
    const item: Notification = {
      id,
      createdAt: Date.now(),
      duration: n.duration ?? 4000,
      ...n,
    };
    set((s) => ({ notifications: [...s.notifications, item] }));
    if (item.duration && item.duration > 0) {
      setTimeout(() => get().dismissNotification(id), item.duration);
    }
    return id;
  },
  dismissNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) })),
  setSaving: (isSaving) => set({ isSaving }),
  setLoading: (isLoading, loadingMessage = '') => set({ isLoading, loadingMessage }),
  setProjectMeta: (projectName, projectPath) => set({ projectName, projectPath }),
  setUnsaved: (hasUnsavedChanges) => set({ hasUnsavedChanges }),
}));

/** Apply theme on load */
if (typeof document !== 'undefined') {
  const t = (localStorage.getItem('ss-theme') as Theme) || 'dark';
  document.documentElement.setAttribute('data-theme', t);
}
