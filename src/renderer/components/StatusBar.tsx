import React, { useEffect, useState } from 'react';

export function StatusBar() {
  const [version, setVersion] = useState('0.1.0');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setVersion).catch(() => {});
    }
  }, []);

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className="status-item">ScreenStudio Pro v{version}</span>
        <span className="status-sep">•</span>
        <span className="status-item text-muted">Prêt</span>
      </div>
      <div className="status-right">
        <span className="status-item text-muted">MVP — Capture fonctionnelle</span>
      </div>

      <style>{`
        .statusbar {
          height: 28px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          font-size: 11px;
          color: var(--text-muted);
        }
        .status-left, .status-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-sep {
          opacity: 0.4;
        }
      `}</style>
    </footer>
  );
}
