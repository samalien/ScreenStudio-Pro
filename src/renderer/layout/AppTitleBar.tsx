import React, { useState } from 'react';
import {
  MonitorPlay, Save, FolderOpen, Sun, Moon, User, Settings,
  ChevronDown, Sparkles, Download,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import {
  saveProject, saveProjectDialog, openProjectDialog, createProject, getLicense,
} from '../services/api';
import { Tooltip } from '../components/ui/Tooltip';
import { Modal } from '../components/ui/Modal';

export function AppTitleBar() {
  const {
    theme, toggleTheme, projectName, projectPath, hasUnsavedChanges,
    setProjectMeta, setUnsaved, setSaving, notify, setView, setLoading,
  } = useUIStore();
  const { clips, duration, clearProject, toDocument, loadSnapshot } = useProjectStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [license, setLicense] = useState<{ plan: string; features: string[] } | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      const doc = { ...toDocument(), name: projectName };
      let path = projectPath || undefined;
      if (!path) {
        const dlg = await saveProjectDialog(projectName);
        if (dlg.canceled || !dlg.path) {
          setSaving(false);
          return;
        }
        path = dlg.path;
      }
      const saved = await saveProject(doc, path);
      setProjectMeta(projectName, saved);
      setUnsaved(false);
      notify({ type: 'success', title: 'Projet enregistré', message: String(saved) });
    } catch (err: any) {
      notify({ type: 'error', title: 'Erreur de sauvegarde', message: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async () => {
    try {
      setLoading(true, 'Ouverture du projet…');
      const result = await openProjectDialog();
      if (result.canceled) return;
      if (result.error) {
        notify({ type: 'error', title: 'Impossible d’ouvrir', message: result.error });
        return;
      }
      if (result.project) {
        const p = result.project as any;
        loadSnapshot(p);
        setProjectMeta(p.name || 'Projet', result.path || null);
        setUnsaved(false);
        setView('editor');
        notify({ type: 'success', title: 'Projet ouvert', message: p.name });
      }
    } catch (err: any) {
      notify({ type: 'error', title: 'Erreur', message: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  };

  const handleNew = async () => {
    try {
      const p = await createProject('Nouveau projet');
      clearProject();
      setProjectMeta(p.name, null);
      setUnsaved(false);
      setView('editor');
      notify({ type: 'info', title: 'Nouveau projet créé' });
    } catch {
      clearProject();
      setProjectMeta('Nouveau projet', null);
      setView('editor');
    }
  };

  const openProfile = async () => {
    setProfileOpen(true);
    try {
      const lic = await getLicense();
      setLicense({ plan: lic.plan || 'free', features: lic.features || [] });
    } catch {
      setLicense({ plan: 'free', features: [] });
    }
  };

  return (
    <>
      <header className="titlebar">
        <div className="titlebar-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'drag' } as any}>
            <MonitorPlay size={18} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              ScreenStudio <span style={{ color: 'var(--accent)' }}>Pro</span>
            </span>
          </div>
          <div className="toolbar-sep" />
          <Tooltip content="Nouveau projet (Ctrl+N)">
            <button className="btn btn-ghost btn-sm" onClick={handleNew}>Nouveau</button>
          </Tooltip>
          <Tooltip content="Ouvrir (Ctrl+O)">
            <button className="btn btn-ghost btn-icon" data-action="open" onClick={handleOpen}>
              <FolderOpen size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Enregistrer (Ctrl+S)">
            <button className="btn btn-ghost btn-icon" data-action="save" onClick={handleSave}>
              <Save size={15} />
            </button>
          </Tooltip>
        </div>

        <div className="titlebar-center">
          <div
            style={{
              padding: '4px 14px',
              background: 'var(--bg-tertiary)',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 320,
            }}
          >
            <span className="truncate" style={{ fontWeight: 500 }}>
              {projectName}
            </span>
            {hasUnsavedChanges && (
              <span style={{ color: 'var(--warning)', fontSize: 10 }}>●</span>
            )}
          </div>
        </div>

        <div className="titlebar-section">
          <Tooltip content={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}>
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </Tooltip>
          <Tooltip content="Exporter">
            <button className="btn btn-ghost btn-icon" onClick={() => setView('export')}>
              <Download size={15} />
            </button>
          </Tooltip>
          <button className="btn btn-ghost btn-sm" onClick={openProfile} style={{ gap: 6 }}>
            <User size={14} />
            <span>Profil</span>
            <ChevronDown size={12} />
          </button>
        </div>
      </header>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="Profil & licence"
        footer={
          <button className="btn btn-secondary" onClick={() => setProfileOpen(false)}>
            Fermer
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="card" style={{ padding: 14 }}>
            <div className="flex items-center gap-2 mb-2">
              <User size={18} color="var(--accent)" />
              <strong>Utilisateur local</strong>
            </div>
            <p className="text-secondary text-sm">
              Compte desktop — pas de connexion cloud requise pour l’édition locale.
            </p>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="flex items-center justify-between mb-2">
              <strong>Licence</strong>
              <span className={`badge ${license?.plan === 'pro' ? 'badge-premium' : 'badge-accent'}`}>
                {(license?.plan || 'free').toUpperCase()}
              </span>
            </div>
            <p className="text-secondary text-sm mb-2">
              {license?.plan === 'pro'
                ? 'Toutes les fonctionnalités Premium sont débloquées.'
                : 'Plan gratuit — export WebM, montage de base. Passez en Pro pour MP4, IA et 4K.'}
            </p>
            {license?.features && license.features.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {license.features.slice(0, 8).map((f) => (
                  <span key={f} className="badge badge-accent">{f}</span>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary w-full" onClick={() => notify({ type: 'info', title: 'Boutique Pro bientôt disponible' })}>
            <Sparkles size={14} /> Passer à Pro
          </button>
        </div>
      </Modal>
    </>
  );
}
