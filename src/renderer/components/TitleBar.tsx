import React from 'react';
import { MonitorPlay } from 'lucide-react';

export function TitleBar() {
  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <div className="logo">
          <MonitorPlay size={18} color="#58a6ff" />
          <span className="logo-text">ScreenStudio <strong>Pro</strong></span>
        </div>
      </div>
      <div className="titlebar-actions">
        <span className="badge badge-premium">v0.4</span>
      </div>

      <style>{`
        .titlebar {
          height: 40px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          -webkit-app-region: drag;
          user-select: none;
        }
        .titlebar-drag {
          display: flex;
          align-items: center;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-text {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .logo-text strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .titlebar-actions {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </header>
  );
}
