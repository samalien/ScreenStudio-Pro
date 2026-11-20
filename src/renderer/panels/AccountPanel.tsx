/**
 * Compte utilisateur, projets cloud index, collaboration, quotas.
 */

import React, { useEffect, useState } from 'react';
import {
  User, LogIn, LogOut, UserPlus, KeyRound, Cloud, FolderOpen,
  Star, Trash2, Share2, MessageSquare, Shield, HardDrive,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';

type Tab = 'auth' | 'profile' | 'projects' | 'collab' | 'cloud';

export function AccountPanel() {
  const {
    user, projects, folders, comments, quota, loading, error,
    hydrate, register, login, logout, requestReset, resetPassword,
    updateProfile, refreshProjects, upsertLocalProject, removeProject,
    toggleFavorite, createFolder, inviteMember, loadComments, postComment,
  } = useAuthStore();
  const { notify, setView } = useUIStore();

  const [tab, setTab] = useState<Tab>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (user) setTab('projects');
  }, [user?.id]);

  useEffect(() => {
    if (selectedProject) loadComments(selectedProject);
  }, [selectedProject]);

  const onAuth = async () => {
    if (mode === 'login') {
      const ok = await login(email, password);
      if (ok) notify({ type: 'success', title: 'Connecté' });
      else notify({ type: 'error', title: 'Connexion échouée', message: error || '' });
    } else if (mode === 'register') {
      const ok = await register(email, password, displayName);
      if (ok) notify({ type: 'success', title: 'Compte créé' });
      else notify({ type: 'error', title: 'Inscription échouée', message: error || '' });
    } else {
      if (resetToken) {
        const ok = await resetPassword(resetToken, password);
        if (ok) notify({ type: 'success', title: 'Mot de passe mis à jour' });
      } else {
        const res = await requestReset(email);
        notify({
          type: 'info',
          title: 'Réinitialisation',
          message: res.devToken ? `Token local : ${res.devToken}` : res.message,
        });
        if (res.devToken) setResetToken(res.devToken);
      }
    }
  };

  const filtered = projects.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      (p.tags || []).some((t) => t.includes(query.toLowerCase()))
  );

  const formatBytes = (n: number) => {
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} Mo`;
    return `${(n / 1024 ** 3).toFixed(2)} Go`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <User size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>Compte & Projets</h1>
          {user && (
            <span className="text-secondary" style={{ fontSize: 12 }}>
              {user.displayName} · {user.globalRole}
            </span>
          )}
        </div>
        <div className="flex gap-2" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {(
            [
              ['auth', 'Session', LogIn],
              ['profile', 'Profil', User],
              ['projects', 'Projets', FolderOpen],
              ['collab', 'Collab', Share2],
              ['cloud', 'Cloud', Cloud],
            ] as [Tab, string, any][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`btn ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12 }}
              onClick={() => setTab(id)}
              disabled={!user && id !== 'auth'}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {tab === 'auth' && (
          <div style={{ maxWidth: 400 }}>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              {(['login', 'register', 'reset'] as const).map((m) => (
                <button
                  key={m}
                  className={`btn ${mode === m ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'login' ? 'Connexion' : m === 'register' ? 'Inscription' : 'Mot de passe'}
                </button>
              ))}
            </div>
            {mode === 'register' && (
              <Field label="Nom affiché">
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
            )}
            <Field label="Email">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {(mode !== 'reset' || resetToken) && (
              <Field label={mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            {mode === 'reset' && resetToken && (
              <Field label="Token">
                <input className="input" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
              </Field>
            )}
            {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading} onClick={onAuth}>
              {mode === 'login' ? (
                <>
                  <LogIn size={14} /> Se connecter
                </>
              ) : mode === 'register' ? (
                <>
                  <UserPlus size={14} /> Créer un compte
                </>
              ) : (
                <>
                  <KeyRound size={14} /> Réinitialiser
                </>
              )}
            </button>
            {user && (
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => logout()}>
                <LogOut size={14} /> Déconnexion
              </button>
            )}
            <p className="text-secondary" style={{ fontSize: 11, marginTop: 12 }}>
              Mode local sécurisé (scrypt + sessions). Isolation des projets par utilisateur. Prêt pour un backend SaaS.
            </p>
          </div>
        )}

        {tab === 'profile' && user && (
          <div style={{ maxWidth: 420 }}>
            <Field label="Nom">
              <input
                className="input"
                defaultValue={user.displayName}
                onBlur={(e) => updateProfile({ displayName: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input className="input" value={user.email} disabled />
            </Field>
            <Field label="Rôle">
              <div className="flex items-center gap-2">
                <Shield size={14} /> {user.globalRole}
              </div>
            </Field>
            <button className="btn btn-ghost" onClick={() => logout()}>
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        )}

        {tab === 'projects' && user && (
          <div>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <input
                className="input"
                placeholder="Rechercher…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const name = `Projet ${new Date().toLocaleDateString()}`;
                  await upsertLocalProject({ name, favorite: false });
                  notify({ type: 'success', title: 'Projet créé dans l’index' });
                }}
              >
                Nouveau
              </button>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  const name = prompt('Nom du dossier');
                  if (name) await createFolder(name);
                }}
              >
                Dossier
              </button>
              <button className="btn btn-ghost" onClick={() => refreshProjects()}>
                Actualiser
              </button>
            </div>
            {folders.length > 0 && (
              <div className="text-secondary" style={{ fontSize: 12, marginBottom: 8 }}>
                Dossiers : {folders.map((f) => f.name).join(', ')}
              </div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderColor: selectedProject === p.id ? 'var(--accent)' : undefined,
                  }}
                >
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setSelectedProject(p.id)}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="text-secondary" style={{ fontSize: 11 }}>
                      v{p.version} · {p.storage} · {new Date(p.updatedAt).toLocaleString()}
                      {p.sharedWith?.length ? ` · ${p.sharedWith.length} membre(s)` : ''}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => toggleFavorite(p.id)} title="Favori">
                    <Star size={14} fill={p.favorite ? 'currentColor' : 'none'} color={p.favorite ? '#f0b429' : undefined} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => removeProject(p.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button className="btn btn-ghost" onClick={() => setView('editor')}>
                    Ouvrir
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-secondary">Aucun projet — créez-en un ou sauvegardez depuis le montage.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'collab' && user && (
          <div style={{ maxWidth: 520 }}>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 12 }}>
              Invitations, rôles (owner / admin / editor / viewer) et commentaires horodatés.
            </p>
            <Field label="Projet">
              <select
                className="input"
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value || null)}
              >
                <option value="">— choisir —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {selectedProject && (
              <>
                <div className="flex gap-2" style={{ marginBottom: 12 }}>
                  <input
                    className="input"
                    placeholder="email@invite.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      const ok = await inviteMember(selectedProject, inviteEmail, 'editor');
                      notify({
                        type: ok ? 'success' : 'error',
                        title: ok ? 'Invitation créée' : 'Échec invitation',
                      });
                    }}
                  >
                    <Share2 size={14} /> Inviter (éditeur)
                  </button>
                </div>
                <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
                  <MessageSquare size={14} /> Commentaires
                </div>
                <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}>
                  {comments.map((c) => (
                    <div key={c.id} style={{ fontSize: 12, marginBottom: 6 }}>
                      <strong>{c.displayName}</strong>{' '}
                      <span className="text-secondary">{new Date(c.createdAt).toLocaleString()}</span>
                      <div>{c.body}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Ajouter un commentaire…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!commentBody.trim()) return;
                      await postComment(selectedProject, commentBody);
                      setCommentBody('');
                    }}
                  >
                    Envoyer
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'cloud' && user && (
          <div style={{ maxWidth: 480 }}>
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <HardDrive size={16} /> <strong>Quota stockage</strong>
              </div>
              <div style={{ fontSize: 13 }}>
                {formatBytes(quota?.usedBytes || user.usedBytes || 0)} /{' '}
                {formatBytes(quota?.quotaBytes || user.quotaBytes || 0)}
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'var(--bg-tertiary)',
                  marginTop: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(
                      100,
                      ((quota?.usedBytes || 0) / (quota?.quotaBytes || 1)) * 100
                    )}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </div>
            <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
              Interface cloud prête : <code>CloudStorageProvider</code> (upload / download / signed URL).
              Implémentation S3 / R2 / Drive branchable sans changer les appelants. Isolation des données par{' '}
              <code>ownerId</code> et permissions de rôle.
            </p>
            <ul className="text-secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
              <li>Stockage médias sous userData/media (local) ou cloudKey</li>
              <li>Sync multi-appareils via index projets + versions</li>
              <li>Partage par invitation + rôles</li>
              <li>Soft-delete + restauration</li>
              <li>Historique / versions (ProjectVersion)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
