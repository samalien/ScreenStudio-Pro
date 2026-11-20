import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerIpcHandlers } from './ipc/registerHandlers';
import { rootLogger } from './services/logging/Logger';
import { getStorage } from './services/storage/LocalStorageProvider';
import { getJobQueue } from './services/queue/JobQueue';
import { getFFmpeg } from './services/ffmpeg/FFmpegService';
import { getSecurity } from './services/security/SecurityService';

const log = rootLogger.child('Main');

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'ScreenStudio Pro',
    backgroundColor: '#0f1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Empêche la fenêtre de l'app d'apparaître dans les captures d'écran
  mainWindow.setContentProtection(true);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ——— Legacy IPC Handlers (kept for full backward compatibility) ———

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  const filtered = sources.filter((source) => {
    const name = (source.name || '').toLowerCase();
    return !name.includes('screenstudio') && !name.includes('screen studio');
  });

  return filtered.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
    display_id: source.display_id,
    appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
  }));
});

ipcMain.handle('get-media-access-status', async (_event, mediaType: 'microphone' | 'camera' | 'screen') => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus(mediaType);
  }
  return 'granted';
});

ipcMain.handle('ask-media-access', async (_event, mediaType: 'microphone' | 'camera') => {
  if (process.platform === 'darwin') {
    return systemPreferences.askForMediaAccess(mediaType);
  }
  return true;
});

ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, defaultName: string) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer la vidéo',
    defaultPath: defaultName,
    filters: [
      { name: 'Vidéo WebM', extensions: ['webm'] },
      { name: 'Vidéo MP4', extensions: ['mp4'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) return { success: false };

  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, path: filePath };
  } catch (err) {
    log.error('Erreur sauvegarde', { err: String(err) });
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('open-path', async (_event, filePath: string) => {
  return shell.openPath(filePath);
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('minimize-window', () => {
  if (mainWindow && !mainWindow.isMinimized()) {
    mainWindow.minimize();
  }
});

ipcMain.handle('restore-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ——— App lifecycle ———

app.whenReady().then(async () => {
  // Initialize core services (order matters)
  getStorage();
  getSecurity();
  getFFmpeg();
  getJobQueue();

  // Register all new architectural IPC handlers
  registerIpcHandlers(() => mainWindow);

  createWindow();

  log.info('ScreenStudio Pro started', {
    version: app.getVersion(),
    isDev,
    platform: process.platform,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
    }
  });
});
