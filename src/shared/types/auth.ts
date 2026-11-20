/**
 * Multi-user auth, roles, projects metadata, collaboration & cloud types.
 * Designed for local-first Electron with optional remote SaaS backend.
 */

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'guest';

export type GlobalRole = 'user' | 'pro' | 'team_admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  globalRole: GlobalRole;
  locale?: string;
  createdAt: number;
  updatedAt: number;
  /** never sent to renderer in clear form */
  passwordHash?: string;
  passwordSalt?: string;
  resetToken?: string | null;
  resetTokenExpires?: number | null;
  quotaBytes?: number;
  usedBytes?: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  globalRole: GlobalRole;
  locale?: string;
  createdAt: number;
  quotaBytes: number;
  usedBytes: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  deviceLabel?: string;
  ipHint?: string;
}

export interface AuthResult {
  success: boolean;
  user?: PublicUser;
  session?: Session;
  error?: string;
}

/** Project library entry (index, not full document) */
export interface ProjectMeta {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  path?: string;
  cloudKey?: string;
  folderId?: string | null;
  favorite: boolean;
  tags: string[];
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  version: number;
  /** local | cloud | hybrid */
  storage: 'local' | 'cloud' | 'hybrid';
  sharedWith: ProjectMember[];
  deletedAt?: number | null;
}

export interface ProjectMember {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  invitedAt: number;
  acceptedAt?: number;
}

export interface ProjectFolder {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: number;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  label?: string;
  snapshotPath?: string;
  createdAt: number;
  createdBy: string;
  sizeBytes?: number;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  userId: string;
  displayName: string;
  body: string;
  timeSec?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface Invite {
  id: string;
  projectId: string;
  email: string;
  role: UserRole;
  token: string;
  invitedBy: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'revoked';
}

export interface CloudQuota {
  usedBytes: number;
  quotaBytes: number;
  filesCount: number;
}

export interface CloudFileEntry {
  key: string;
  name: string;
  sizeBytes: number;
  updatedAt: number;
  contentType?: string;
  projectId?: string;
}

export const DEFAULT_QUOTA_FREE = 2 * 1024 * 1024 * 1024; // 2 Go
export const DEFAULT_QUOTA_PRO = 50 * 1024 * 1024 * 1024; // 50 Go

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['read', 'write', 'delete', 'share', 'manage_members', 'export', 'comment'],
  admin: ['read', 'write', 'delete', 'share', 'manage_members', 'export', 'comment'],
  editor: ['read', 'write', 'export', 'comment'],
  viewer: ['read', 'comment'],
  guest: ['read'],
};

export function hasPermission(role: UserRole, perm: string): boolean {
  return (ROLE_PERMISSIONS[role] || []).includes(perm);
}
