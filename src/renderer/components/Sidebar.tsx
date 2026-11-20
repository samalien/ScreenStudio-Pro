import React from 'react';
import {
  Video,
  Scissors,
  Sparkles,
  Volume2,
  Download,
  Settings,
} from 'lucide-react';
export type ModuleId = 'capture' | 'editor' | 'effects' | 'audio' | 'export' | 'settings';
import clsx from 'clsx';

interface SidebarProps {
  activeModule: ModuleId;
  onModuleChange: (module: ModuleId) => void;
}

const modules: { id: ModuleId; label: string; icon: React.ReactNode; premium?: boolean }[] = [
  { id: 'capture', label: 'Capture', icon: <Video size={18} /> },
  { id: 'editor', label: 'Montage', icon: <Scissors size={18} /> },
  { id: 'effects', label: 'Effets', icon: <Sparkles size={18} />, premium: false },
  { id: 'audio', label: 'Audio', icon: <Volume2 size={18} />, premium: false },
  { id: 'export', label: 'Export', icon: <Download size={18} /> },
];

export function Sidebar({ activeModule, onModuleChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {modules.map((mod) => (
          <button
            key={mod.id}
            className={clsx('sidebar-item', activeModule === mod.id && 'active')}
            onClick={() => onModuleChange(mod.id)}
            title={mod.label}
          >
            {mod.icon}
            <span>{mod.label}</span>
            {mod.premium && <span className="premium-dot" title="Premium" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-item" title="Paramètres">
          <Settings size={18} />
          <span>Réglages</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: 200px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 12px 8px;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: var(--radius);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          transition: all 0.15s;
          position: relative;
          text-align: left;
        }
        .sidebar-item:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }
        .sidebar-item.active {
          background: var(--accent-muted);
          color: var(--accent);
        }
        .premium-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--purple);
          margin-left: auto;
        }
        .sidebar-footer {
          border-top: 1px solid var(--border);
          padding-top: 8px;
          margin-top: 8px;
        }
      `}</style>
    </aside>
  );
}
