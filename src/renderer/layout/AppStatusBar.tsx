import React, { useEffect, useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useProjectStore } from '../stores/projectStore';
import { getServicesStatus } from '../services/api';

export function AppStatusBar() {
  const { isSaving, hasUnsavedChanges, view } = useUIStore();
  const { clips, duration } = useProjectStore();
  const [version, setVersion] = useState('0.6.0');
  const [ffmpegOk, setFfmpegOk] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setVersion).catch(() => {});
      getServicesStatus().then((s) => {
        if (s?.ffmpeg) setFfmpegOk(!!s.ffmpeg.available);
      }).catch(() => {});
    }
  }, []);

  const statusText = isSaving
    ? 'Enregistrement…'
    : hasUnsavedChanges
      ? 'Modifications non enregistrées'
      : 'Prêt';

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className={`status-dot ${hasUnsavedChanges ? 'warn' : ''}`} />
        <span>{statusText}</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>
          {clips.length} clip{clips.length !== 1 ? 's' : ''} · {duration.toFixed(1)}s
        </span>
      </div>
      <div className="status-right">
        <span>FFmpeg {ffmpegOk ? '✓' : '—'}</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span>v{version}</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ textTransform: 'capitalize' }}>{view}</span>
      </div>
    </footer>
  );
}
