/**
 * Local multi-user auth service (desktop-first).
 * Passwords hashed with scrypt; sessions tokenized.
 * Ready to swap for remote SaaS API later.
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  UserProfile,
  PublicUser,
  Session,
  AuthResult,
  ProjectMeta,
  ProjectFolder,
  ProjectVersion,
  ProjectComment,
  Invite,
  UserRole,
  CloudQuota,
} from '../../../shared/types/auth';
import {
  DEFAULT_QUOTA_FREE,
  DEFAULT_QUOTA_PRO,
} from '../../../shared/types/auth';
import { getStorage } from '../storage/LocalStorageProvider';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Auth');

const USERS_FILE = 'users-db.json';
const SESSIONS_FILE = 'sessions-db.json';
const PROJECTS_INDEX = 'projects-index.json';
const FOLDERS_FILE = 'project-folders.json';
const COMMENTS_FILE = 'project-comments.json';
const INVITES_FILE = 'invites-db.json';

interface DbShape {
  users: UserProfile[];
}

interface SessionDb {
  sessions: Session[];
}

function scryptHash(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function toPublic(u: UserProfile): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    globalRole: u.globalRole,
    locale: u.locale,
    createdAt: u.createdAt,
    quotaBytes: u.quotaBytes ?? DEFAULT_QUOTA_FREE,
    usedBytes: u.usedBytes ?? 0,
  };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const storage = getStorage();
  const p = path.join(storage.getAppDataPath(), file);
  try {
    if (!(await storage.exists(p))) return fallback;
    const buf = await storage.readFile(p);
    return JSON.parse(buf.toString('utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const storage = getStorage();
  const p = path.join(storage.getAppDataPath(), file);
  await storage.writeFile(p, JSON.stringify(data, null, 2));
}

export class LocalAuthService {
  private currentSession: Session | null = null;

  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    email = email.trim().toLowerCase();
    if (!email || !password || password.length < 6) {
      return { success: false, error: 'Email et mot de passe (min. 6 caractères) requis.' };
    }
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    if (db.users.some((u) => u.email === email)) {
      return { success: false, error: 'Un compte existe déjà avec cet email.' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const user: UserProfile = {
      id: uuidv4(),
      email,
      displayName: displayName || email.split('@')[0],
      globalRole: 'user',
      createdAt: now,
      updatedAt: now,
      passwordSalt: salt,
      passwordHash: scryptHash(password, salt),
      quotaBytes: DEFAULT_QUOTA_FREE,
      usedBytes: 0,
      locale: 'fr',
    };
    db.users.push(user);
    await writeJson(USERS_FILE, db);
    log.info('User registered', { id: user.id, email });
    return this.createSession(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    email = email.trim().toLowerCase();
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.email === email);
    if (!user || !user.passwordHash || !user.passwordSalt) {
      return { success: false, error: 'Identifiants invalides.' };
    }
    const hash = scryptHash(password, user.passwordSalt);
    if (hash !== user.passwordHash) {
      return { success: false, error: 'Identifiants invalides.' };
    }
    return this.createSession(user);
  }

  async logout(token?: string): Promise<{ success: boolean }> {
    const sdb = await readJson<SessionDb>(SESSIONS_FILE, { sessions: [] });
    const t = token || this.currentSession?.token;
    if (t) {
      sdb.sessions = sdb.sessions.filter((s) => s.token !== t);
      await writeJson(SESSIONS_FILE, sdb);
    }
    this.currentSession = null;
    return { success: true };
  }

  async validateSession(token: string): Promise<AuthResult> {
    const sdb = await readJson<SessionDb>(SESSIONS_FILE, { sessions: [] });
    const session = sdb.sessions.find((s) => s.token === token);
    if (!session || session.expiresAt < Date.now()) {
      return { success: false, error: 'Session expirée.' };
    }
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) return { success: false, error: 'Utilisateur introuvable.' };
    this.currentSession = session;
    return { success: true, user: toPublic(user), session };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string; devToken?: string }> {
    email = email.trim().toLowerCase();
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      // don't leak existence
      return { success: true, message: 'Si le compte existe, un email de réinitialisation a été envoyé.' };
    }
    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 3600_000;
    user.updatedAt = Date.now();
    await writeJson(USERS_FILE, db);
    log.info('Password reset token issued', { email });
    // Local mode: return token for UI (no email server)
    return {
      success: true,
      message: 'Token de réinitialisation généré (mode local).',
      devToken: token,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Mot de passe trop court.' };
    }
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find(
      (u) => u.resetToken === token && u.resetTokenExpires && u.resetTokenExpires > Date.now()
    );
    if (!user) return { success: false, error: 'Token invalide ou expiré.' };
    const salt = crypto.randomBytes(16).toString('hex');
    user.passwordSalt = salt;
    user.passwordHash = scryptHash(newPassword, salt);
    user.resetToken = null;
    user.resetTokenExpires = null;
    user.updatedAt = Date.now();
    await writeJson(USERS_FILE, db);
    return this.createSession(user);
  }

  async updateProfile(
    userId: string,
    patch: Partial<Pick<UserProfile, 'displayName' | 'avatarUrl' | 'locale'>>
  ): Promise<AuthResult> {
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { success: false, error: 'Utilisateur introuvable.' };
    if (patch.displayName) user.displayName = patch.displayName;
    if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl;
    if (patch.locale) user.locale = patch.locale;
    user.updatedAt = Date.now();
    await writeJson(USERS_FILE, db);
    return { success: true, user: toPublic(user) };
  }

  private async createSession(user: UserProfile): Promise<AuthResult> {
    const session: Session = {
      id: uuidv4(),
      userId: user.id,
      token: crypto.randomBytes(32).toString('hex'),
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 3600_000, // 30 days
      deviceLabel: process.platform,
    };
    const sdb = await readJson<SessionDb>(SESSIONS_FILE, { sessions: [] });
    // prune expired
    sdb.sessions = sdb.sessions.filter((s) => s.expiresAt > Date.now());
    sdb.sessions.push(session);
    await writeJson(SESSIONS_FILE, sdb);
    this.currentSession = session;
    return { success: true, user: toPublic(user), session };
  }

  /* —— Project index (per-user isolation) —— */

  async listProjects(userId: string): Promise<ProjectMeta[]> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    return all.items
      .filter(
        (p) =>
          !p.deletedAt &&
          (p.ownerId === userId || p.sharedWith.some((m) => m.userId === userId))
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async upsertProjectMeta(meta: ProjectMeta): Promise<ProjectMeta> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    const idx = all.items.findIndex((p) => p.id === meta.id);
    meta.updatedAt = Date.now();
    if (idx >= 0) all.items[idx] = meta;
    else all.items.push(meta);
    await writeJson(PROJECTS_INDEX, all);
    return meta;
  }

  async softDeleteProject(projectId: string, userId: string): Promise<boolean> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    const p = all.items.find((x) => x.id === projectId);
    if (!p || p.ownerId !== userId) return false;
    p.deletedAt = Date.now();
    p.updatedAt = Date.now();
    await writeJson(PROJECTS_INDEX, all);
    return true;
  }

  async restoreProject(projectId: string, userId: string): Promise<boolean> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    const p = all.items.find((x) => x.id === projectId);
    if (!p || p.ownerId !== userId) return false;
    p.deletedAt = null;
    p.updatedAt = Date.now();
    await writeJson(PROJECTS_INDEX, all);
    return true;
  }

  async setFavorite(projectId: string, userId: string, favorite: boolean): Promise<boolean> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    const p = all.items.find(
      (x) => x.id === projectId && (x.ownerId === userId || x.sharedWith.some((m) => m.userId === userId))
    );
    if (!p) return false;
    p.favorite = favorite;
    await writeJson(PROJECTS_INDEX, all);
    return true;
  }

  async listFolders(userId: string): Promise<ProjectFolder[]> {
    const all = await readJson<{ items: ProjectFolder[] }>(FOLDERS_FILE, { items: [] });
    return all.items.filter((f) => f.ownerId === userId);
  }

  async createFolder(userId: string, name: string, parentId: string | null = null): Promise<ProjectFolder> {
    const all = await readJson<{ items: ProjectFolder[] }>(FOLDERS_FILE, { items: [] });
    const folder: ProjectFolder = {
      id: uuidv4(),
      name,
      parentId,
      ownerId: userId,
      createdAt: Date.now(),
    };
    all.items.push(folder);
    await writeJson(FOLDERS_FILE, all);
    return folder;
  }

  /* —— Collaboration —— */

  async invite(
    projectId: string,
    inviterId: string,
    email: string,
    role: UserRole
  ): Promise<Invite | null> {
    const all = await readJson<{ items: ProjectMeta[] }>(PROJECTS_INDEX, { items: [] });
    const p = all.items.find((x) => x.id === projectId && x.ownerId === inviterId);
    if (!p) return null;
    const invite: Invite = {
      id: uuidv4(),
      projectId,
      email: email.trim().toLowerCase(),
      role,
      token: crypto.randomBytes(16).toString('hex'),
      invitedBy: inviterId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 3600_000,
      status: 'pending',
    };
    const invDb = await readJson<{ items: Invite[] }>(INVITES_FILE, { items: [] });
    invDb.items.push(invite);
    await writeJson(INVITES_FILE, invDb);
    // attach pending member stub
    p.sharedWith.push({
      userId: '',
      email: invite.email,
      displayName: invite.email,
      role,
      invitedAt: invite.createdAt,
    });
    await writeJson(PROJECTS_INDEX, all);
    return invite;
  }

  async listComments(projectId: string): Promise<ProjectComment[]> {
    const all = await readJson<{ items: ProjectComment[] }>(COMMENTS_FILE, { items: [] });
    return all.items.filter((c) => c.projectId === projectId).sort((a, b) => a.createdAt - b.createdAt);
  }

  async addComment(
    projectId: string,
    userId: string,
    displayName: string,
    body: string,
    timeSec?: number
  ): Promise<ProjectComment> {
    const all = await readJson<{ items: ProjectComment[] }>(COMMENTS_FILE, { items: [] });
    const c: ProjectComment = {
      id: uuidv4(),
      projectId,
      userId,
      displayName,
      body,
      timeSec,
      createdAt: Date.now(),
    };
    all.items.push(c);
    await writeJson(COMMENTS_FILE, all);
    return c;
  }

  async getQuota(userId: string): Promise<CloudQuota> {
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.id === userId);
    return {
      usedBytes: user?.usedBytes ?? 0,
      quotaBytes: user?.quotaBytes ?? DEFAULT_QUOTA_FREE,
      filesCount: 0,
    };
  }

  async setProQuota(userId: string): Promise<void> {
    const db = await readJson<DbShape>(USERS_FILE, { users: [] });
    const user = db.users.find((u) => u.id === userId);
    if (!user) return;
    user.globalRole = 'pro';
    user.quotaBytes = DEFAULT_QUOTA_PRO;
    user.updatedAt = Date.now();
    await writeJson(USERS_FILE, db);
  }
}

let instance: LocalAuthService | null = null;

export function getAuthService(): LocalAuthService {
  if (!instance) instance = new LocalAuthService();
  return instance;
}
