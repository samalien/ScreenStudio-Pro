import React from 'react';
import {
  LayoutDashboard, Scissors, Video, Download, Sparkles,
  LayoutTemplate, PenTool, Settings, Wand2, Music, Languages, ChevronLeft, ChevronRight,
  FolderOpen, Clapperboard, Type, User, CreditCard,
} from 'lucide-react';
import { useUIStore, type AppView } from '../stores/uiStore';
import { Tooltip } from '../components/ui/Tooltip';

const NAV: { id: AppView; label: string; icon: React.ReactNode; section?: string }[] = [
  { id: 'dashboard', label: 'Projets', icon: <LayoutDashboard size={18} />, section: 'Principal' },
  { id: 'editor', label: 'Montage', icon: <Scissors size={18} /> },
  { id: 'capture', label: 'Capture', icon: <Video size={18} /> },
  { id: 'export', label: 'Export', icon: <Download size={18} /> },
  { id: 'ai', label: 'IA', icon: <Sparkles size={18} />, section: 'Création' },
  { id: 'templates', label: 'Modèles', icon: <LayoutTemplate size={18} /> },
  { id: 'graphics', label: 'Graphismes', icon: <PenTool size={18} /> },
  { id: 'text', label: 'Textes', icon: <Type size={18} /> },
  { id: 'effects', label: 'Effets', icon: <Wand2 size={18} /> },
  { id: 'audio', label: 'Audio', icon: <Music size={18} /> },
  { id: 'subtitles', label: 'Sous-titres', icon: <Languages size={18} /> },
  { id: 'billing', label: 'Abonnements', icon: <CreditCard size={18} /> },
  { id: 'account', label: 'Compte', icon: <User size={18} />, section: 'Système' },
  { id: 'settings', label: 'Réglages', icon: <Settings size={18} />, section: 'Système' },
];

export function AppSidebar() {
  const { view, setView, sidebarCollapsed, toggleSidebar } = useUIStore();

  let lastSection = '';

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-nav" style={{ flex: 1 }}>
        {NAV.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          return (
            <React.Fragment key={item.id}>
              {showSection && <div className="sidebar-section">{item.section}</div>}
              <Tooltip content={sidebarCollapsed ? item.label : ''} side="right">
                <button
                  className={`nav-item ${view === item.id ? 'active' : ''}`}
                  onClick={() => setView(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </Tooltip>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <Tooltip content={sidebarCollapsed ? 'Développer' : 'Réduire'} side="right">
          <button className="nav-item" onClick={toggleSidebar}>
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            <span>Réduire</span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
