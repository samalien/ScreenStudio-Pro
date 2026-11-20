/**
 * Local filesystem storage provider (primary for desktop).
 * Uses Electron app.getPath for standard locations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { StorageProvider } from '../../../shared/interfaces/services';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Storage');

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private base: string;

  constructor() {
    // Prefer userData so it survives updates
    this.base = app.getPath('userData');
    this.ensureDirSync(this.getProjectsPath());
    this.ensureDirSync(this.getCachePath());
    this.ensureDirSync(this.getTempPath());
    this.ensureDirSync(this.getMediaPath());
    log.info('Local storage initialized', { base: this.base });
  }

  getAppDataPath(): string {
    return this.base;
  }
  getProjectsPath(): string {
    return path.join(this.base, 'projects');
  }
  getCachePath(): string {
    return path.join(this.base, 'cache');
  }
  getTempPath(): string {
    return path.join(this.base, 'temp');
  }
  getMediaPath(): string {
    return path.join(this.base, 'media');
  }

  private ensureDirSync(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    await this.ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, data);
  }

  async copy(src: string, dest: string): Promise<void> {
    await this.ensureDir(path.dirname(dest));
    await fs.promises.copyFile(src, dest);
  }

  async move(src: string, dest: string): Promise<void> {
    await this.ensureDir(path.dirname(dest));
    await fs.promises.rename(src, dest);
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async list(dir: string): Promise<string[]> {
    try {
      return await fs.promises.readdir(dir);
    } catch {
      return [];
    }
  }

  async getSize(filePath: string): Promise<number> {
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  }
}

let instance: LocalStorageProvider | null = null;

export function getStorage(): LocalStorageProvider {
  if (!instance) instance = new LocalStorageProvider();
  return instance;
}
