import { contextBridge, ipcRenderer } from 'electron';

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  display_id: string;
  appIcon: string | null;
}

/**
 * Public API exposed to the renderer.
 * All new architectural services go through this bridge.
 */
const api = {
  // ——— Legacy capture / window (unchanged) ———
  getSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('get-sources'),

  getMediaAccessStatus: (mediaType: 'microphone' | 'camera' | 'screen') =>
    ipcRenderer.invoke('get-media-access-status', mediaType),

  askMediaAccess: (mediaType: 'microphone' | 'camera') =>
    ipcRenderer.invoke('ask-media-access', mediaType),

  saveRecording: (buffer: ArrayBuffer, defaultName: string) =>
    ipcRenderer.invoke('save-recording', buffer, defaultName),

  openPath: (filePath: string) => ipcRenderer.invoke('open-path', filePath),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  restoreWindow: () => ipcRenderer.invoke('restore-window'),

  platform: process.platform,

  // ——— New architecture services ———

  storage: {
    getPaths: () => ipcRenderer.invoke('storage:get-paths'),
  },

  project: {
    create: (name: string) => ipcRenderer.invoke('project:create', name),
    save: (project: unknown, filePath?: string) =>
      ipcRenderer.invoke('project:save', project, filePath),
    load: (filePath: string) => ipcRenderer.invoke('project:load', filePath),
    listRecent: (limit?: number) => ipcRenderer.invoke('project:list-recent', limit),
    delete: (filePath: string) => ipcRenderer.invoke('project:delete', filePath),
    openDialog: () => ipcRenderer.invoke('project:open-dialog'),
    saveDialog: (defaultName: string) => ipcRenderer.invoke('project:save-dialog', defaultName),
  },

  ffmpeg: {
    status: () => ipcRenderer.invoke('ffmpeg:status'),
    probe: (filePath: string) => ipcRenderer.invoke('ffmpeg:probe', filePath),
  },

  jobs: {
    enqueue: (type: string, payload: Record<string, unknown>, priority?: number) =>
      ipcRenderer.invoke('jobs:enqueue', type, payload, priority),
    get: (id: string) => ipcRenderer.invoke('jobs:get', id),
    list: (status?: string) => ipcRenderer.invoke('jobs:list', status),
    cancel: (id: string) => ipcRenderer.invoke('jobs:cancel', id),
  },

  cache: {
    clear: () => ipcRenderer.invoke('cache:clear'),
  },

  security: {
    getMachineId: () => ipcRenderer.invoke('security:machine-id'),
    validateLicense: (key?: string) => ipcRenderer.invoke('security:license', key),
    checkFeature: (feature: string) => ipcRenderer.invoke('security:check-feature', feature),
  },

  ai: {
    transcribe: (path: string, language?: string) =>
      ipcRenderer.invoke('ai:transcribe', path, language),
    titleSuggestions: (transcript: string) =>
      ipcRenderer.invoke('ai:title-suggestions', transcript),
  },


  auth: {
    register: (email: string, password: string, displayName: string) =>
      ipcRenderer.invoke('auth:register', email, password, displayName),
    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),
    logout: (token?: string) => ipcRenderer.invoke('auth:logout', token),
    validate: (token: string) => ipcRenderer.invoke('auth:validate', token),
    requestReset: (email: string) => ipcRenderer.invoke('auth:request-reset', email),
    resetPassword: (token: string, newPassword: string) =>
      ipcRenderer.invoke('auth:reset-password', token, newPassword),
    updateProfile: (userId: string, patch: Record<string, unknown>) =>
      ipcRenderer.invoke('auth:update-profile', userId, patch),
    listProjects: (userId: string) => ipcRenderer.invoke('auth:list-projects', userId),
    upsertProject: (meta: unknown) => ipcRenderer.invoke('auth:upsert-project', meta),
    deleteProject: (projectId: string, userId: string) =>
      ipcRenderer.invoke('auth:delete-project', projectId, userId),
    restoreProject: (projectId: string, userId: string) =>
      ipcRenderer.invoke('auth:restore-project', projectId, userId),
    favorite: (projectId: string, userId: string, favorite: boolean) =>
      ipcRenderer.invoke('auth:favorite', projectId, userId, favorite),
    folders: (userId: string) => ipcRenderer.invoke('auth:folders', userId),
    createFolder: (userId: string, name: string, parentId?: string | null) =>
      ipcRenderer.invoke('auth:create-folder', userId, name, parentId),
    invite: (projectId: string, inviterId: string, email: string, role: string) =>
      ipcRenderer.invoke('auth:invite', projectId, inviterId, email, role),
    comments: (projectId: string) => ipcRenderer.invoke('auth:comments', projectId),
    addComment: (projectId: string, userId: string, displayName: string, body: string, timeSec?: number) =>
      ipcRenderer.invoke('auth:add-comment', projectId, userId, displayName, body, timeSec),
    quota: (userId: string) => ipcRenderer.invoke('auth:quota', userId),
  },

  billing: {
    plans: () => ipcRenderer.invoke('billing:plans'),
    config: () => ipcRenderer.invoke('billing:config'),
    entitlements: (userId: string, storageUsed?: number) =>
      ipcRenderer.invoke('billing:entitlements', userId, storageUsed),
    checkFeature: (userId: string, feature: string) =>
      ipcRenderer.invoke('billing:check-feature', userId, feature),
    assertExport: (userId: string, kind: string) =>
      ipcRenderer.invoke('billing:assert-export', userId, kind),
    recordExport: (userId: string) => ipcRenderer.invoke('billing:record-export', userId),
    consumeAi: (userId: string, amount?: number) =>
      ipcRenderer.invoke('billing:consume-ai', userId, amount),
    checkout: (req: unknown) => ipcRenderer.invoke('billing:checkout', req),
    cancel: (userId: string, atPeriodEnd?: boolean) =>
      ipcRenderer.invoke('billing:cancel', userId, atPeriodEnd),
    transactions: (userId: string) => ipcRenderer.invoke('billing:transactions', userId),
    invoices: (userId: string) => ipcRenderer.invoke('billing:invoices', userId),
    adminStats: () => ipcRenderer.invoke('billing:admin-stats'),
    adminSubs: () => ipcRenderer.invoke('billing:admin-subs'),
    adminGrant: (userId: string, planId: string, adminKey?: string) =>
      ipcRenderer.invoke('billing:admin-grant', userId, planId, adminKey),
    webhook: (rawBody: string, signature?: string) =>
      ipcRenderer.invoke('billing:webhook', rawBody, signature),
  },
  services: {
    status: () => ipcRenderer.invoke('services:status'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

/** Runtime shape of window.electronAPI (renderer types live in vite-env.d.ts). */
export type ElectronAPI = typeof api;
