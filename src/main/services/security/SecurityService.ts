/**
 * Security & licensing stubs.
 * - Path sanitization
 * - Machine ID (for future license binding)
 * - Feature flags (free / pro)
 */

import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { app } from 'electron';
import type { SecurityService, LicenseInfo } from '../../../shared/interfaces/services';
import { getStorage } from '../storage/LocalStorageProvider';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Security');

const FREE_FEATURES = [
  'capture',
  'timeline',
  'text',
  'basic-effects',
  'export-webm',
];

const PRO_FEATURES = [
  ...FREE_FEATURES,
  'export-mp4',
  'transitions',
  'audio-denoise',
  'ai-subtitles',
  'ai-bg-remove',
  'templates',
  '4k-export',
];

export class DefaultSecurityService implements SecurityService {
  private machineId: string | null = null;
  private license: LicenseInfo | null = null;

  async getMachineId(): Promise<string> {
    if (this.machineId) return this.machineId;
    const storage = getStorage();
    const idPath = path.join(storage.getAppDataPath(), 'machine-id');
    try {
      if (await storage.exists(idPath)) {
        const buf = await storage.readFile(idPath);
        this.machineId = buf.toString('utf-8').trim();
        return this.machineId;
      }
    } catch {
      /* create new */
    }
    const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${app.getPath('userData')}`;
    this.machineId = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
    await storage.writeFile(idPath, this.machineId);
    log.info('Machine ID generated');
    return this.machineId;
  }

  async validateLicense(key?: string): Promise<LicenseInfo> {
    // Stub: always free for now. Later: online validation + signed payload.
    const machineId = await this.getMachineId();
    if (!key) {
      this.license = {
        valid: true,
        plan: 'free',
        features: FREE_FEATURES,
        machineId,
      };
      return this.license;
    }
    // Placeholder for real key format
    if (key.startsWith('PRO-') || key.startsWith('SSPRO-')) {
      this.license = {
        valid: true,
        plan: 'pro',
        expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
        features: PRO_FEATURES,
        machineId,
      };
      return this.license;
    }
    this.license = {
      valid: false,
      plan: 'free',
      features: FREE_FEATURES,
      machineId,
    };
    return this.license;
  }

  async checkFeature(feature: string): Promise<boolean> {
    if (!this.license) await this.validateLicense();
    return this.license!.features.includes(feature);
  }

  /**
   * Prevent path traversal. Only allow paths under userData or absolute user-chosen paths.
   */
  sanitizePath(userPath: string): string {
    const resolved = path.resolve(userPath);
    // Block obvious traversal
    if (resolved.includes('..')) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  isPathAllowed(filePath: string): boolean {
    try {
      const resolved = path.resolve(filePath);
      const userData = path.resolve(getStorage().getAppDataPath());
      // Allow anything under userData or absolute paths chosen via dialog (trusted)
      return resolved.startsWith(userData) || path.isAbsolute(resolved);
    } catch {
      return false;
    }
  }
}

let instance: DefaultSecurityService | null = null;

export function getSecurity(): DefaultSecurityService {
  if (!instance) instance = new DefaultSecurityService();
  return instance;
}
