/**
 * Simple file-based cache under userData/cache.
 * Key → hashed filename. Optional TTL via sidecar .meta.json.
 */

import * as path from 'path';
import * as crypto from 'crypto';
import type { CacheService } from '../../../shared/interfaces/services';
import { getStorage } from '../storage/LocalStorageProvider';
import { DEFAULT_CACHE_TTL_SEC } from '../../../shared/constants';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Cache');

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

export class FileCacheService implements CacheService {
  private dir: string;

  constructor() {
    this.dir = getStorage().getCachePath();
  }

  private dataPath(key: string) {
    return path.join(this.dir, hashKey(key) + '.bin');
  }
  private metaPath(key: string) {
    return path.join(this.dir, hashKey(key) + '.meta.json');
  }

  async get(key: string): Promise<Buffer | null> {
    const storage = getStorage();
    const data = this.dataPath(key);
    if (!(await storage.exists(data))) return null;

    try {
      const metaRaw = await storage.readFile(this.metaPath(key));
      const meta = JSON.parse(metaRaw.toString('utf-8')) as { expiresAt?: number };
      if (meta.expiresAt && Date.now() > meta.expiresAt) {
        await this.delete(key);
        return null;
      }
    } catch {
      /* no meta or invalid → treat as valid */
    }

    return storage.readFile(data);
  }

  async set(key: string, value: Buffer, ttlSec = DEFAULT_CACHE_TTL_SEC): Promise<void> {
    const storage = getStorage();
    await storage.writeFile(this.dataPath(key), value);
    const meta = {
      key,
      createdAt: Date.now(),
      expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : undefined,
      size: value.length,
    };
    await storage.writeFile(this.metaPath(key), JSON.stringify(meta));
    log.debug('Cache set', { key: key.slice(0, 40), size: value.length });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    const storage = getStorage();
    await storage.delete(this.dataPath(key));
    await storage.delete(this.metaPath(key));
  }

  async clear(): Promise<void> {
    const storage = getStorage();
    const files = await storage.list(this.dir);
    for (const f of files) {
      await storage.delete(path.join(this.dir, f));
    }
    log.info('Cache cleared');
  }

  async getOrCompute(
    key: string,
    compute: () => Promise<Buffer>,
    ttlSec?: number
  ): Promise<Buffer> {
    const hit = await this.get(key);
    if (hit) return hit;
    const value = await compute();
    await this.set(key, value, ttlSec);
    return value;
  }
}

let instance: FileCacheService | null = null;

export function getCache(): FileCacheService {
  if (!instance) instance = new FileCacheService();
  return instance;
}
