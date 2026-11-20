/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getSources: () => Promise<import('../../preload/preload').ScreenSource[]>;
    getMediaAccessStatus: (mediaType: 'microphone' | 'camera' | 'screen') => Promise<string>;
    askMediaAccess: (mediaType: 'microphone' | 'camera') => Promise<boolean>;
    saveRecording: (buffer: ArrayBuffer, defaultName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    openPath: (filePath: string) => Promise<string>;
    getAppVersion: () => Promise<string>;
    minimizeWindow: () => Promise<void>;
    restoreWindow: () => Promise<void>;
    platform: string;
  };
}
