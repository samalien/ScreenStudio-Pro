/// <reference types="vite/client" />

/** IPC API exposed by preload — single declaration for the renderer. */

export interface ProjectDialogResult {
  canceled?: boolean;
  path?: string;
  error?: string;
  project?: {
    id?: string;
    name?: string;
    clips?: unknown[];
    tracks?: unknown[];
    duration?: number;
    currentTime?: number;
    [key: string]: unknown;
  };
}

export interface ServicesStatus {
  ffmpeg?: { available?: boolean; version?: string | null };
  [key: string]: unknown;
}

export interface LicenseInfo {
  plan: string;
  features: string[];
  valid?: boolean;
  [key: string]: unknown;
}

export interface ElectronAPI {
  getSources: () => Promise<
    Array<{ id: string; name: string; thumbnail: string; display_id: string; appIcon: string | null }>
  >;
  getMediaAccessStatus: (mediaType: 'microphone' | 'camera' | 'screen') => Promise<string>;
  askMediaAccess: (mediaType: 'microphone' | 'camera') => Promise<boolean>;
  saveRecording: (
    buffer: ArrayBuffer,
    defaultName: string
  ) => Promise<{ success: boolean; path?: string; error?: string }>;
  openPath: (filePath: string) => Promise<string>;
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  restoreWindow: () => Promise<void>;
  platform: string;
  storage: { getPaths: () => Promise<Record<string, string>> };
  project: {
    create: (name: string) => Promise<{ id?: string; name: string; [key: string]: unknown }>;
    save: (project: unknown, filePath?: string) => Promise<string>;
    load: (filePath: string) => Promise<unknown>;
    listRecent: (limit?: number) => Promise<
      Array<{ id: string; name: string; path: string; updatedAt: number }>
    >;
    delete: (filePath: string) => Promise<unknown>;
    openDialog: () => Promise<ProjectDialogResult>;
    saveDialog: (defaultName: string) => Promise<ProjectDialogResult>;
  };
  ffmpeg: {
    status: () => Promise<{ available: boolean; version: string | null }>;
    probe: (filePath: string) => Promise<unknown>;
  };
  jobs: {
    enqueue: (type: string, payload: Record<string, unknown>, priority?: number) => Promise<string>;
    get: (id: string) => Promise<unknown>;
    list: (status?: string) => Promise<unknown>;
    cancel: (id: string) => Promise<boolean>;
  };
  cache: { clear: () => Promise<unknown> };
  security: {
    getMachineId: () => Promise<string>;
    validateLicense: (key?: string) => Promise<LicenseInfo>;
    checkFeature: (feature: string) => Promise<boolean>;
  };
  ai: {
    transcribe: (path: string, language?: string) => Promise<unknown>;
    titleSuggestions: (transcript: string) => Promise<string[]>;
  };
  auth: Record<string, (...args: never[]) => Promise<unknown>>;
  billing: Record<string, (...args: never[]) => Promise<unknown>>;
  services: { status: () => Promise<ServicesStatus> };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
