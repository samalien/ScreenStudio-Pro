/**
 * Professional timeline context menu (right-click on clips).
 * Actions are gated by clip type / lock state; separate audio is real extraction.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Scissors, Copy, ClipboardPaste, Trash2, Lock, Unlock, Type,
  Volume2, SplitSquareHorizontal, Layers, Info, Film,
} from 'lucide-react';
import type { Clip } from '../engine/types';

export interface TimelineContextMenuState {
  x: number;
  y: number;
  clip: Clip;
}

interface Props {
  menu: TimelineContextMenuState | null;
  onClose: () => void;
  currentTime: number;
  hasClipboard: boolean;
  busy?: boolean;
  onSplit: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
  onToggleLock: () => void;
  onSeparateAudio: () => void;
  onShowProperties: () => void;
  onFitToTrack?: () => void;
}

interface Item {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onClick: () => void;
}

export function TimelineContextMenu({
  menu,
  onClose,
  currentTime,
  hasClipboard,
  busy,
  onSplit,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onRename,
  onToggleLock,
  onSeparateAudio,
  onShowProperties,
  onFitToTrack,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setPos({ left, top });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const clip = menu.clip;
  const locked = !!clip.locked;
  const canSplit =
    !locked && currentTime > clip.start + 0.04 && currentTime < clip.start + clip.duration - 0.04;
  const isVideo = clip.type === 'video';
  const isMedia = clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';

  const items: Item[] = [
    {
      id: 'separate',
      label: busy ? 'Extraction audio…' : 'Séparer l’audio et la vidéo',
      icon: <SplitSquareHorizontal size={14} />,
      disabled: !isVideo || locked || busy || !clip.src,
      separatorBefore: false,
      onClick: onSeparateAudio,
    },
    {
      id: 'split',
      label: 'Diviser au curseur',
      icon: <Scissors size={14} />,
      disabled: !canSplit,
      separatorBefore: true,
      onClick: onSplit,
    },
    {
      id: 'cut',
      label: 'Couper',
      icon: <Scissors size={14} />,
      disabled: locked,
      separatorBefore: true,
      onClick: onCut,
    },
    {
      id: 'copy',
      label: 'Copier',
      icon: <Copy size={14} />,
      onClick: onCopy,
    },
    {
      id: 'paste',
      label: 'Coller',
      icon: <ClipboardPaste size={14} />,
      disabled: !hasClipboard,
      onClick: onPaste,
    },
    {
      id: 'duplicate',
      label: 'Dupliquer',
      icon: <Layers size={14} />,
      disabled: locked,
      onClick: onDuplicate,
    },
    {
      id: 'delete',
      label: 'Supprimer',
      icon: <Trash2 size={14} />,
      disabled: locked,
      danger: true,
      separatorBefore: true,
      onClick: onDelete,
    },
    {
      id: 'rename',
      label: 'Renommer…',
      icon: <Type size={14} />,
      disabled: locked,
      separatorBefore: true,
      onClick: onRename,
    },
    {
      id: 'lock',
      label: locked ? 'Déverrouiller' : 'Verrouiller',
      icon: locked ? <Unlock size={14} /> : <Lock size={14} />,
      onClick: onToggleLock,
    },
    {
      id: 'props',
      label: 'Propriétés',
      icon: <Info size={14} />,
      separatorBefore: true,
      onClick: onShowProperties,
    },
  ];

  if (onFitToTrack && isMedia) {
    items.push({
      id: 'fit',
      label: 'Ajuster à la piste',
      icon: <Film size={14} />,
      disabled: locked,
      onClick: onFitToTrack,
    });
  }

  // Hide separate for non-video by filtering
  const visible = items.filter((it) => {
    if (it.id === 'separate' && !isVideo) return false;
    return true;
  });

  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 10000,
        minWidth: 240,
        maxWidth: 320,
        background: 'var(--bg-elevated, #1e1e24)',
        border: '1px solid var(--border, #333)',
        borderRadius: 10,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        padding: '6px 0',
        color: 'var(--text, #eee)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          padding: '6px 12px 8px',
          fontSize: 11,
          color: 'var(--text-muted, #888)',
          borderBottom: '1px solid var(--border, #333)',
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={clip.name}
      >
        {clip.type === 'video' && <Film size={12} style={{ marginRight: 6, verticalAlign: -2 }} />}
        {clip.type === 'audio' && <Volume2 size={12} style={{ marginRight: 6, verticalAlign: -2 }} />}
        {clip.name}
      </div>
      {visible.map((it) => (
        <React.Fragment key={it.id}>
          {it.separatorBefore && (
            <div
              style={{
                height: 1,
                background: 'var(--border, #333)',
                margin: '4px 0',
              }}
            />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              if (it.id !== 'separate') onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: 'transparent',
              color: it.disabled
                ? 'var(--text-muted, #666)'
                : it.danger
                  ? 'var(--danger, #f87171)'
                  : 'inherit',
              cursor: it.disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: it.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!it.disabled) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--bg-hover, rgba(255,255,255,0.06))';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{ width: 16, display: 'inline-flex' }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
