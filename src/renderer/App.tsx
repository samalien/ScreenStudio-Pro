import React, { useEffect } from 'react';
import { AppTitleBar } from './layout/AppTitleBar';
import { AppSidebar } from './layout/AppSidebar';
import { AppStatusBar } from './layout/AppStatusBar';
import { ToastContainer } from './components/ui/Toast';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { Dashboard } from './panels/Dashboard';
import { AIPanel } from './panels/AIPanel';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { GraphicsPanel } from './panels/GraphicsPanel';
import { TextStudioPanel } from './panels/TextStudioPanel';
import { EffectsLibraryPanel } from './panels/EffectsLibraryPanel';
import { AudioStudioPanel } from './panels/AudioStudioPanel';
import { SubtitlesPanel } from './panels/SubtitlesPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { AccountPanel } from './panels/AccountPanel';
import { BillingPanel } from './panels/BillingPanel';
import { TimelineEngine } from './modules/workspace/TimelineEngine';
import { CaptureModule } from './modules/capture/CaptureModule';
import { ExportModule } from './modules/export/ExportModule';
import { useUIStore } from './stores/uiStore';
import { useHistoryKeys } from './hooks/useHistoryKeys';

export default function App() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  useHistoryKeys(); // global undo/redo

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ss:save'));
      }
      if (mod && e.key === 'o') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('ss:open'));
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
        setView('dashboard');
      }
      if (mod && e.key === '1') setView('dashboard');
      if (mod && e.key === '2') setView('editor');
      if (mod && e.key === '3') setView('capture');
      if (mod && e.key === '4') setView('export');
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView, toggleTheme]);

  useEffect(() => {
    const save = () => {
      const btn = document.querySelector('[data-action="save"]') as HTMLButtonElement | null;
      btn?.click();
    };
    const open = () => {
      const btn = document.querySelector('[data-action="open"]') as HTMLButtonElement | null;
      btn?.click();
    };
    window.addEventListener('ss:save', save);
    window.addEventListener('ss:open', open);
    return () => {
      window.removeEventListener('ss:save', save);
      window.removeEventListener('ss:open', open);
    };
  }, []);

  const renderMain = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard />;
      case 'editor':
        return <TimelineEngine />;
      case 'capture':
        return <CaptureModule />;
      case 'export':
        return <ExportModule />;
      case 'ai':
        return <AIPanel />;
      case 'templates':
        return <TemplatesPanel />;
      case 'graphics':
        return <GraphicsPanel />;
      case 'text':
        return <TextStudioPanel />;
      case 'effects':
        return <EffectsLibraryPanel />;
      case 'audio':
        return <AudioStudioPanel />;
      case 'subtitles':
        return <SubtitlesPanel />;
      case 'account':
        return <AccountPanel />;
      case 'billing':
        return <BillingPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-shell">
      <AppTitleBar />
      <div className="app-body">
        <AppSidebar />
        <main className="workspace" style={{ position: 'relative' }}>
          {renderMain()}
          <LoadingOverlay />
        </main>
      </div>
      <AppStatusBar />
      <ToastContainer />
    </div>
  );
}
