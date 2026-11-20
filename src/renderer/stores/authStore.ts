/**
 * Auth + project library + collaboration client store.
 * Talks to main AuthService via IPC; falls back to localStorage demo mode.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  PublicUser,
  Session,
  ProjectMeta,
  ProjectFolder,
  ProjectComment,
  CloudQuota,
  UserRole,
} from '../../shared/types/auth';

const TOKEN_KEY = 'ssp_session_token';

function api() {
  return (window as any).electronAPI?.auth as any;
}

interface AuthState {
  user: PublicUser | null;
  session: Session | null;
  projects: ProjectMeta[];
  folders: ProjectFolder[];
  comments: ProjectComment[];
  quota: CloudQuota | null;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  requestReset: (email: string) => Promise<{ ok: boolean; message: string; devToken?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<boolean>;
  updateProfile: (patch: { displayName?: string; locale?: string }) => Promise<boolean>;

  refreshProjects: () => Promise<void>;
  upsertLocalProject: (partial: Partial<ProjectMeta> & { id?: string; name: string }) => Promise<ProjectMeta | null>;
  removeProject: (id: string) => Promise<boolean>;
  restoreProject: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  inviteMember: (projectId: string, email: string, role: UserRole) => Promise<boolean>;
  loadComments: (projectId: string) => Promise<void>;
  postComment: (projectId: string, body: string, timeSec?: number) => Promise<void>;
  refreshQuota: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  projects: [],
  folders: [],
  comments: [],
  quota: null,
  loading: false,
  error: null,

  hydrate: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !api()) return;
    set({ loading: true });
    try {
      const res = await api().validate(token);
      if (res?.success && res.user) {
        set({ user: res.user, session: res.session, error: null });
        await get().refreshProjects();
        await get().refreshQuota();
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      /* offline */
    } finally {
      set({ loading: false });
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      if (!api()) {
        // pure local fallback
        const user: PublicUser = {
          id: uuidv4(),
          email,
          displayName: displayName || email.split('@')[0],
          globalRole: 'user',
          createdAt: Date.now(),
          quotaBytes: 2 * 1024 ** 3,
          usedBytes: 0,
        };
        const session: Session = {
          id: uuidv4(),
          userId: user.id,
          token: uuidv4(),
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 864e5,
        };
        localStorage.setItem(TOKEN_KEY, session.token);
        set({ user, session, loading: false });
        return true;
      }
      const res = await api().register(email, password, displayName);
      if (!res.success) {
        set({ error: res.error || 'Échec inscription', loading: false });
        return false;
      }
      localStorage.setItem(TOKEN_KEY, res.session.token);
      set({ user: res.user, session: res.session, loading: false });
      await get().refreshProjects();
      return true;
    } catch (e: any) {
      set({ error: String(e.message || e), loading: false });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      if (!api()) {
        set({ error: 'Auth IPC indisponible — relancez l’app Electron.', loading: false });
        return false;
      }
      const res = await api().login(email, password);
      if (!res.success) {
        set({ error: res.error || 'Échec connexion', loading: false });
        return false;
      }
      localStorage.setItem(TOKEN_KEY, res.session.token);
      set({ user: res.user, session: res.session, loading: false });
      await get().refreshProjects();
      await get().refreshQuota();
      return true;
    } catch (e: any) {
      set({ error: String(e.message || e), loading: false });
      return false;
    }
  },

  logout: async () => {
    const token = get().session?.token;
    try {
      if (api()) await api().logout(token);
    } catch { /* */ }
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, session: null, projects: [], folders: [], comments: [], quota: null });
  },

  requestReset: async (email) => {
    if (!api()) return { ok: false, message: 'IPC indisponible' };
    const res = await api().requestReset(email);
    return { ok: !!res.success, message: res.message || '', devToken: res.devToken };
  },

  resetPassword: async (token, newPassword) => {
    if (!api()) return false;
    const res = await api().resetPassword(token, newPassword);
    if (res.success) {
      localStorage.setItem(TOKEN_KEY, res.session.token);
      set({ user: res.user, session: res.session });
      return true;
    }
    set({ error: res.error });
    return false;
  },

  updateProfile: async (patch) => {
    const user = get().user;
    if (!user || !api()) return false;
    const res = await api().updateProfile(user.id, patch);
    if (res.success) {
      set({ user: res.user });
      return true;
    }
    return false;
  },

  refreshProjects: async () => {
    const user = get().user;
    if (!user || !api()) return;
    const list = await api().listProjects(user.id);
    const folders = await api().folders(user.id);
    set({ projects: list || [], folders: folders || [] });
  },

  upsertLocalProject: async (partial) => {
    const user = get().user;
    if (!user) return null;
    const meta: ProjectMeta = {
      id: partial.id || uuidv4(),
      name: partial.name,
      description: partial.description,
      ownerId: user.id,
      path: partial.path,
      folderId: partial.folderId ?? null,
      favorite: partial.favorite ?? false,
      tags: partial.tags || [],
      createdAt: partial.createdAt || Date.now(),
      updatedAt: Date.now(),
      version: (partial.version || 0) + 1,
      storage: partial.storage || 'local',
      sharedWith: partial.sharedWith || [],
      deletedAt: null,
    };
    if (api()) {
      await api().upsertProject(meta);
      await get().refreshProjects();
    } else {
      set((s) => ({ projects: [meta, ...s.projects.filter((p) => p.id !== meta.id)] }));
    }
    return meta;
  },

  removeProject: async (id) => {
    const user = get().user;
    if (!user || !api()) return false;
    const ok = await api().deleteProject(id, user.id);
    await get().refreshProjects();
    return !!ok;
  },

  restoreProject: async (id) => {
    const user = get().user;
    if (!user || !api()) return false;
    const ok = await api().restoreProject(id, user.id);
    await get().refreshProjects();
    return !!ok;
  },

  toggleFavorite: async (id) => {
    const user = get().user;
    const p = get().projects.find((x) => x.id === id);
    if (!user || !p || !api()) return;
    await api().favorite(id, user.id, !p.favorite);
    await get().refreshProjects();
  },

  createFolder: async (name) => {
    const user = get().user;
    if (!user || !api()) return;
    await api().createFolder(user.id, name, null);
    await get().refreshProjects();
  },

  inviteMember: async (projectId, email, role) => {
    const user = get().user;
    if (!user || !api()) return false;
    const inv = await api().invite(projectId, user.id, email, role);
    await get().refreshProjects();
    return !!inv;
  },

  loadComments: async (projectId) => {
    if (!api()) return;
    const list = await api().comments(projectId);
    set({ comments: list || [] });
  },

  postComment: async (projectId, body, timeSec) => {
    const user = get().user;
    if (!user || !api()) return;
    await api().addComment(projectId, user.id, user.displayName, body, timeSec);
    await get().loadComments(projectId);
  },

  refreshQuota: async () => {
    const user = get().user;
    if (!user || !api()) return;
    const q = await api().quota(user.id);
    set({ quota: q });
  },
}));
