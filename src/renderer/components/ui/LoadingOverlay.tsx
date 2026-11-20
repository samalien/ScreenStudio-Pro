import React from 'react';
import { useUIStore } from '../../stores/uiStore';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useUIStore();
  if (!isLoading) return null;
  return (
    <div className="loading-overlay">
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
      {loadingMessage && (
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{loadingMessage}</div>
      )}
    </div>
  );
}
