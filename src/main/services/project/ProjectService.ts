/**
 * Project persistence – JSON-based .ssproj files.
 * Media assets are referenced by absolute or app-relative paths.
 */

import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectService } from '../../../shared/interfaces/services';
import type { ProjectDocument } from '../../../shared/types/media';
import { PROJECT_VERSION, PROJECT_FILE_EXT, MAX_RECENT_PROJECTS } from '../../../shared/constants';
import { sanitizeFileName, ensureExtension } from '../../../shared/utils/paths';
import { getStorage } from '../storage/LocalStorageProvider';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Project');

const RECENT_KEY = 'recent-projects.json';

interface RecentEntry {
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}

export class JsonProjectService implements ProjectService {
  async create(name: string): Promise<ProjectDocument> {
    const now = Date.now();
    const doc: ProjectDocument = {
      version: PROJECT_VERSION,
      id: uuidv4(),
      name: name || 'Untitled Project',
      createdAt: now,
      updatedAt: now,
      duration: 0,
      clips: [],
      mediaLibrary: [],
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        backgroundColor: '#000000',
      },
    };
    log.info('Project created', { id: doc.id, name: doc.name });
    return doc;
  }

  async save(project: ProjectDocument, filePath?: string): Promise<string> {
    const storage = getStorage();
    project.updatedAt = Date.now();

    let target = filePath;
    if (!target) {
      const safe = sanitizeFileName(project.name);
      target = path.join(storage.getProjectsPath(), ensureExtension(safe, PROJECT_FILE_EXT));
    } else {
      target = ensureExtension(target, PROJECT_FILE_EXT);
    }

    const json = JSON.stringify(project, null, 2);
    await storage.writeFile(target, json);
    await this.addRecent({
      id: project.id,
      name: project.name,
      path: target,
      updatedAt: project.updatedAt,
    });
    log.info('Project saved', { path: target, clips: project.clips.length });
    return target;
  }

  async load(filePath: string): Promise<ProjectDocument> {
    const storage = getStorage();
    const buf = await storage.readFile(filePath);
    const doc = JSON.parse(buf.toString('utf-8')) as ProjectDocument;
    if (!doc.version || !doc.id || !Array.isArray(doc.clips)) {
      throw new Error('Invalid project file format');
    }
    await this.addRecent({
      id: doc.id,
      name: doc.name,
      path: filePath,
      updatedAt: doc.updatedAt || Date.now(),
    });
    log.info('Project loaded', { path: filePath, name: doc.name });
    return doc;
  }

  async listRecent(limit = MAX_RECENT_PROJECTS): Promise<RecentEntry[]> {
    const storage = getStorage();
    const recentPath = path.join(storage.getAppDataPath(), RECENT_KEY);
    try {
      const buf = await storage.readFile(recentPath);
      const list = JSON.parse(buf.toString('utf-8')) as RecentEntry[];
      return list.slice(0, limit);
    } catch {
      return [];
    }
  }

  async delete(filePath: string): Promise<boolean> {
    try {
      await getStorage().delete(filePath);
      // remove from recent
      const recent = await this.listRecent(100);
      const filtered = recent.filter((r) => r.path !== filePath);
      await this.writeRecent(filtered);
      return true;
    } catch {
      return false;
    }
  }

  async exportMediaManifest(project: ProjectDocument): Promise<string[]> {
    const paths = new Set<string>();
    for (const clip of project.clips) {
      if (clip.src && !clip.src.startsWith('blob:')) paths.add(clip.src);
    }
    for (const m of project.mediaLibrary) {
      if (m.path) paths.add(m.path);
    }
    return Array.from(paths);
  }

  private async addRecent(entry: RecentEntry) {
    let list = await this.listRecent(100);
    list = list.filter((r) => r.path !== entry.path && r.id !== entry.id);
    list.unshift(entry);
    list = list.slice(0, MAX_RECENT_PROJECTS);
    await this.writeRecent(list);
  }

  private async writeRecent(list: RecentEntry[]) {
    const storage = getStorage();
    const recentPath = path.join(storage.getAppDataPath(), RECENT_KEY);
    await storage.writeFile(recentPath, JSON.stringify(list, null, 2));
  }
}

let instance: JsonProjectService | null = null;

export function getProjectService(): JsonProjectService {
  if (!instance) instance = new JsonProjectService();
  return instance;
}
