import React, { useEffect, useState } from 'react';
import {
  Plus, FolderOpen, Clock, Film, Trash2, Sparkles, Video, LayoutTemplate,
} from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import { listRecentProjects, createProject, openProjectDialog } from '../services/api';
import { Modal } from '../components/ui/Modal';

interface RecentItem {
  id: string;
  name: string;
  path: string;
  updatedAt: number;
}

export function Dashboard() {
  const { setView, setProjectMeta, setUnsaved, notify, setLoading } = useUIStore();
  const clearProject = useProjectStore((s) => s.clearProject);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [newName, setNewName] = useState('Mon projet');
  const [showNew, setShowNew] = useState(false);

  const loadRecent = async () => {
    try {
      const list = await listRecentProjects(12);
      setRecent((list as RecentItem[]) || []);
    } catch {
      setRecent([]);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const handleNew = async () => {
    try {
      setLoading(true, 'Création…');
      const p = await createProject(newName.trim() || 'Nouveau projet');
      clearProject();
      setProjectMeta(p.name, null);
      setUnsaved(false);
      setShowNew(false);
      setView('editor');
      notify({ type: 'success', title: 'Projet créé', message: p.name });
    } catch {
      clearProject();
      setProjectMeta(newName || 'Nouveau projet', null);
      setView('editor');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    try {
      setLoading(true, 'Ouverture…');
      const result = await openProjectDialog();
      if (result.canceled) return;
      if (result.error) {
        notify({ type: 'error', title: 'Erreur', message: result.error });
        return;
      }
      if (result.project) {
        const p = result.project as any;
        useProjectStore.getState().loadSnapshot(p);
        setProjectMeta(p.name || 'Projet', result.path || null);
        setUnsaved(false);
        setView('editor');
        notify({ type: 'success', title: 'Projet ouvert' });
      }
    } catch (err: any) {
      notify({ type: 'error', title: 'Erreur', message: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-2" style={{ marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Mes projets</h1>
            <p className="text-secondary">Créez, ouvrez et gérez vos montages ScreenStudio Pro</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={handleOpen}>
              <FolderOpen size={15} /> Ouvrir
            </button>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <Plus size={15} /> Nouveau projet
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            { icon: <Video size={22} />, title: 'Capturer', desc: 'Enregistrer l’écran', view: 'capture' as const },
            { icon: <Film size={22} />, title: 'Monter', desc: 'Timeline multipiste', view: 'editor' as const },
            { icon: <Sparkles size={22} />, title: 'IA', desc: 'Sous-titres & plus', view: 'ai' as const },
            { icon: <LayoutTemplate size={22} />, title: 'Modèles', desc: 'Démarrer plus vite', view: 'templates' as const },
          ].map((a) => (
            <button
              key={a.title}
              className="card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                border: '1px solid var(--border)',
                transition: 'border-color 0.15s, transform 0.15s',
                padding: 16,
              }}
              onClick={() => {
                if (a.view === 'editor' || a.view === 'capture') {
                  setProjectMeta(useUIStore.getState().projectName || 'Nouveau projet', null);
                }
                setView(a.view);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <div style={{ color: 'var(--accent)', marginBottom: 10 }}>{a.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
              <div className="text-muted text-sm">{a.desc}</div>
            </button>
          ))}
        </div>

        {/* Recent projects */}
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          <Clock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Récents
        </h2>

        {recent.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px', background: 'var(--bg-secondary)', borderRadius: 12, border: '1px dashed var(--border)' }}>
            <Film size={36} strokeWidth={1.2} />
            <h3>Aucun projet récent</h3>
            <p>Créez votre premier projet ou ouvrez un fichier .ssproj existant.</p>
            <button className="btn btn-primary mt-2" onClick={() => setShowNew(true)}>
              <Plus size={14} /> Créer un projet
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((r) => (
              <button
                key={r.path}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: '1px solid var(--border)',
                }}
                onClick={async () => {
                  try {
                    setLoading(true, 'Chargement…');
                    const { loadProject } = await import('../services/api');
                    const p = await loadProject(r.path);
                    useProjectStore.getState().loadSnapshot(p as any);
                    setProjectMeta((p as any).name || r.name, r.path);
                    setUnsaved(false);
                    setView('editor');
                  } catch (err: any) {
                    notify({ type: 'error', title: 'Impossible de charger', message: String(err?.message || err) });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 32,
                    borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Film size={16} color="var(--text-muted)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="text-muted text-xs truncate">{r.path}</div>
                </div>
                <div className="text-muted text-xs" style={{ flexShrink: 0 }}>
                  {formatDate(r.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Nouveau projet"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleNew}>Créer</button>
          </>
        }
      >
        <label className="label">Nom du projet</label>
        <input
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNew()}
          autoFocus
          placeholder="Mon super tutoriel"
        />
        <p className="text-muted text-sm mt-2">
          Vous pourrez enregistrer le projet en .ssproj à tout moment (Ctrl+S).
        </p>
      </Modal>
    </div>
  );
}
