import React, { useEffect, useState } from 'react';
import { Settings, Moon, Sun, HardDrive, Cpu, Shield, Trash2 } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { getServicesStatus } from '../services/api';

export function SettingsPanel() {
  const { theme, setTheme, notify } = useUIStore();
  const [status, setStatus] = useState<any>(null);
  const [paths, setPaths] = useState<any>(null);

  useEffect(() => {
    getServicesStatus().then(setStatus).catch(() => {});
    window.electronAPI?.storage?.getPaths?.().then(setPaths).catch(() => {});
  }, []);

  const clearCache = async () => {
    try {
      await window.electronAPI?.cache?.clear?.();
      notify({ type: 'success', title: 'Cache vidé' });
    } catch {
      notify({ type: 'error', title: 'Impossible de vider le cache' });
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '28px 36px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 24 }}>
          <Settings size={22} />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Réglages</h1>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"><Sun size={14} /> Apparence</div>
          <div className="flex gap-2">
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={14} /> Sombre
            </button>
            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={14} /> Clair
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"><Cpu size={14} /> Services</div>
          <div className="text-sm text-secondary" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>FFmpeg : {status?.ffmpeg?.available ? `✓ ${status.ffmpeg.version || 'ok'}` : 'Non configuré (stub)'}</div>
            <div>IA : {status?.ai?.provider || 'local'} {status?.ai?.configured ? '✓' : ''}</div>
            <div>Stockage : {status?.storage || 'local'}</div>
          </div>
        </div>

        {paths && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title"><HardDrive size={14} /> Chemins locaux</div>
            <div className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}>
              <div>AppData : {paths.appData}</div>
              <div>Projets : {paths.projects}</div>
              <div>Cache : {paths.cache}</div>
              <div>Media : {paths.media}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"><Shield size={14} /> Données</div>
          <button className="btn btn-secondary" onClick={clearCache}>
            <Trash2 size={14} /> Vider le cache
          </button>
        </div>
      </div>
    </div>
  );
}
