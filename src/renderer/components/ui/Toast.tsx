import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { useUIStore, type Notification } from '../../stores/uiStore';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--accent)',
};

function ToastItem({ n }: { n: Notification }) {
  const dismiss = useUIStore((s) => s.dismissNotification);
  const Icon = ICONS[n.type];

  return (
    <div className={`toast toast-${n.type}`}>
      <Icon size={18} color={COLORS[n.type]} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
        {n.message && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
        )}
      </div>
      <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => dismiss(n.id)}>
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const notifications = useUIStore((s) => s.notifications);
  if (!notifications.length) return null;
  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <ToastItem key={n.id} n={n} />
      ))}
    </div>
  );
}
