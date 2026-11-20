/**
 * Central IPC registration – all main↔renderer contracts live here.
 * Keeps main.ts clean.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getStorage } from '../services/storage/LocalStorageProvider';
import { getFFmpeg } from '../services/ffmpeg/FFmpegService';
import { getJobQueue } from '../services/queue/JobQueue';
import { getProjectService } from '../services/project/ProjectService';
import { getCache } from '../services/cache/CacheService';
import { getSecurity } from '../services/security/SecurityService';
import { getAudioService } from '../services/audio/AudioService';
import { getImageService } from '../services/image/ImageService';
import { getAIService } from '../services/ai/AIService';
import { getAuthService } from '../services/auth/AuthService';
import { getBillingService } from '../services/billing/BillingService';
import { rootLogger } from '../services/logging/Logger';
import type { ProjectDocument } from '../../shared/types/media';
import type { JobType } from '../../shared/types/jobs';

const log = rootLogger.child('IPC');

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  /* ---------- System / existing (kept for compatibility) ---------- */
  // (existing handlers stay in main.ts for now to avoid breaking changes)

  /* ---------- Storage / paths ---------- */
  ipcMain.handle('storage:get-paths', () => {
    const s = getStorage();
    return {
      appData: s.getAppDataPath(),
      projects: s.getProjectsPath(),
      cache: s.getCachePath(),
      temp: s.getTempPath(),
      media: s.getMediaPath(),
    };
  });

  /* ---------- Project ---------- */
  ipcMain.handle('project:create', async (_e, name: string) => {
    return getProjectService().create(name);
  });

  ipcMain.handle('project:save', async (_e, project: ProjectDocument, filePath?: string) => {
    return getProjectService().save(project, filePath);
  });

  ipcMain.handle('project:load', async (_e, filePath: string) => {
    return getProjectService().load(filePath);
  });

  ipcMain.handle('project:list-recent', async (_e, limit?: number) => {
    return getProjectService().listRecent(limit);
  });

  ipcMain.handle('project:delete', async (_e, filePath: string) => {
    return getProjectService().delete(filePath);
  });

  ipcMain.handle('project:open-dialog', async () => {
    const win = getMainWindow();
    if (!win) return { canceled: true };
    const result = await dialog.showOpenDialog(win, {
      title: 'Ouvrir un projet ScreenStudio',
      filters: [
        { name: 'Projet ScreenStudio', extensions: ['ssproj'] },
        { name: 'Tous les fichiers', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      const project = await getProjectService().load(result.filePaths[0]);
      return { canceled: false, path: result.filePaths[0], project };
    } catch (err: any) {
      return { canceled: false, error: String(err.message || err) };
    }
  });

  ipcMain.handle('project:save-dialog', async (_e, defaultName: string) => {
    const win = getMainWindow();
    if (!win) return { canceled: true };
    const result = await dialog.showSaveDialog(win, {
      title: 'Enregistrer le projet',
      defaultPath: defaultName.endsWith('.ssproj') ? defaultName : `${defaultName}.ssproj`,
      filters: [{ name: 'Projet ScreenStudio', extensions: ['ssproj'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    return { canceled: false, path: result.filePath };
  });

  /* ---------- FFmpeg / Media ---------- */
  ipcMain.handle('ffmpeg:status', async () => {
    const ff = getFFmpeg();
    return {
      available: await ff.isAvailable(),
      version: await ff.getVersion(),
    };
  });

  ipcMain.handle('ffmpeg:probe', async (_e, filePath: string) => {
    return getFFmpeg().probe(filePath);
  });

  /* ---------- Jobs ---------- */
  ipcMain.handle('jobs:enqueue', async (_e, type: JobType, payload: Record<string, unknown>, priority?: number) => {
    return getJobQueue().enqueue(type, payload, priority);
  });

  ipcMain.handle('jobs:get', async (_e, id: string) => {
    return getJobQueue().get(id);
  });

  ipcMain.handle('jobs:list', async (_e, status?: string) => {
    return getJobQueue().list(status as any);
  });

  ipcMain.handle('jobs:cancel', async (_e, id: string) => {
    return getJobQueue().cancel(id);
  });

  /* ---------- Cache ---------- */
  ipcMain.handle('cache:clear', async () => {
    await getCache().clear();
    return true;
  });

  /* ---------- Security / License ---------- */
  ipcMain.handle('security:machine-id', async () => {
    return getSecurity().getMachineId();
  });

  ipcMain.handle('security:license', async (_e, key?: string) => {
    return getSecurity().validateLicense(key);
  });

  ipcMain.handle('security:check-feature', async (_e, feature: string) => {
    return getSecurity().checkFeature(feature);
  });

  /* ---------- AI ---------- */
  ipcMain.handle('ai:transcribe', async (_e, path: string, language?: string) => {
    return getAIService().transcribe(path, language);
  });

  ipcMain.handle('ai:title-suggestions', async (_e, transcript: string) => {
    return getAIService().generateTitleSuggestions(transcript);
  });

  /* ---------- Audio / Image (status only for now) ---------- */
  ipcMain.handle('services:status', async () => {
    const ff = getFFmpeg();
    return {
      ffmpeg: { available: await ff.isAvailable(), version: await ff.getVersion() },
      ai: { provider: getAIService().providerId, configured: getAIService().isConfigured() },
      storage: getStorage().name,
    };
  });


  /* ---------- Auth / Users / Projects cloud index ---------- */
    ipcMain.handle('auth:register', async (_e, email, password, displayName) => {
    return getAuthService().register(email, password, displayName);
  });
  ipcMain.handle('auth:login', async (_e, email, password) => {
    return getAuthService().login(email, password);
  });
  ipcMain.handle('auth:logout', async (_e, token) => {
    return getAuthService().logout(token);
  });
  ipcMain.handle('auth:validate', async (_e, token) => {
    return getAuthService().validateSession(token);
  });
  ipcMain.handle('auth:request-reset', async (_e, email) => {
    return getAuthService().requestPasswordReset(email);
  });
  ipcMain.handle('auth:reset-password', async (_e, token, newPassword) => {
    return getAuthService().resetPassword(token, newPassword);
  });
  ipcMain.handle('auth:update-profile', async (_e, userId, patch) => {
    return getAuthService().updateProfile(userId, patch);
  });
  ipcMain.handle('auth:list-projects', async (_e, userId) => {
    return getAuthService().listProjects(userId);
  });
  ipcMain.handle('auth:upsert-project', async (_e, meta) => {
    return getAuthService().upsertProjectMeta(meta);
  });
  ipcMain.handle('auth:delete-project', async (_e, projectId, userId) => {
    return getAuthService().softDeleteProject(projectId, userId);
  });
  ipcMain.handle('auth:restore-project', async (_e, projectId, userId) => {
    return getAuthService().restoreProject(projectId, userId);
  });
  ipcMain.handle('auth:favorite', async (_e, projectId, userId, favorite) => {
    return getAuthService().setFavorite(projectId, userId, favorite);
  });
  ipcMain.handle('auth:folders', async (_e, userId) => {
    return getAuthService().listFolders(userId);
  });
  ipcMain.handle('auth:create-folder', async (_e, userId, name, parentId) => {
    return getAuthService().createFolder(userId, name, parentId);
  });
  ipcMain.handle('auth:invite', async (_e, projectId, inviterId, email, role) => {
    return getAuthService().invite(projectId, inviterId, email, role);
  });
  ipcMain.handle('auth:comments', async (_e, projectId) => {
    return getAuthService().listComments(projectId);
  });
  ipcMain.handle('auth:add-comment', async (_e, projectId, userId, displayName, body, timeSec) => {
    return getAuthService().addComment(projectId, userId, displayName, body, timeSec);
  });
  ipcMain.handle('auth:quota', async (_e, userId) => {
    return getAuthService().getQuota(userId);
  });


  /* ---------- Billing (server-side entitlements) ---------- */
  ipcMain.handle('billing:plans', async () => getBillingService().listPlans());
  ipcMain.handle('billing:config', async () => getBillingService().getConfig());
  ipcMain.handle('billing:entitlements', async (_e, userId: string, storageUsed?: number) => {
    return getBillingService().getEntitlements(userId, storageUsed || 0);
  });
  ipcMain.handle('billing:check-feature', async (_e, userId: string, feature: string) => {
    return getBillingService().checkFeature(userId, feature as any);
  });
  ipcMain.handle('billing:assert-export', async (_e, userId: string, kind: string) => {
    return getBillingService().assertCanExport(userId, kind as any);
  });
  ipcMain.handle('billing:record-export', async (_e, userId: string) => {
    await getBillingService().recordExport(userId);
    return true;
  });
  ipcMain.handle('billing:consume-ai', async (_e, userId: string, amount?: number) => {
    return getBillingService().consumeAiCredit(userId, amount ?? 1);
  });
  ipcMain.handle('billing:checkout', async (_e, req: any) => {
    return getBillingService().startCheckout(req);
  });
  ipcMain.handle('billing:cancel', async (_e, userId: string, atPeriodEnd?: boolean) => {
    return getBillingService().cancelSubscription(userId, atPeriodEnd !== false);
  });
  ipcMain.handle('billing:transactions', async (_e, userId: string) => {
    return getBillingService().listTransactions(userId);
  });
  ipcMain.handle('billing:invoices', async (_e, userId: string) => {
    return getBillingService().listInvoices(userId);
  });
  ipcMain.handle('billing:admin-stats', async () => getBillingService().adminStats());
  ipcMain.handle('billing:admin-subs', async () => getBillingService().adminListSubscriptions());
  ipcMain.handle('billing:webhook', async (_e, rawBody: string, signature?: string) => {
    return getBillingService().handleWebhook(rawBody, signature);
  });
  /** Admin-only: grant plan without payment (for support / tests) – explicitly labeled */
  ipcMain.handle('billing:admin-grant', async (_e, userId: string, planId: string, adminKey?: string) => {
    if (adminKey !== process.env.BILLING_ADMIN_KEY && process.env.BILLING_ADMIN_KEY) {
      return { success: false, error: 'Clé admin invalide.' };
    }
    // If BILLING_ADMIN_KEY unset, allow local desktop admin grant but flag it
    return getBillingService().changePlanLocalOnly(userId, planId as any);
  });

  log.info('IPC handlers registered');
}
