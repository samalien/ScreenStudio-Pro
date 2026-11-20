import { useEffect } from 'react';

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: ShortcutHandler;
  description?: string;
  /** If true, preventDefault is called */
  preventDefault?: boolean;
}

/**
 * Hook to register keyboard shortcuts.
 * Works both in the renderer and can be extended with Electron globalShortcut later.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase() ||
          e.code.toLowerCase() === shortcut.key.toLowerCase();

        const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = !!shortcut.shift === e.shiftKey;
        const altMatch = !!shortcut.alt === e.altKey;

        // For meta-only shortcuts on Mac
        const metaOnly = shortcut.meta && !shortcut.ctrl;
        const metaMatch = metaOnly ? e.metaKey : true;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

/** Common shortcut definitions for the app */
export const CAPTURE_SHORTCUTS = {
  startStop: { key: 'r', ctrl: true, description: 'Démarrer / Arrêter l’enregistrement' },
  pause: { key: 'p', ctrl: true, description: 'Pause / Reprendre' },
  cancel: { key: 'Escape', description: 'Annuler le compte à rebours / sélection' },
};

export const EDITOR_SHORTCUTS = {
  playPause: { key: ' ', description: 'Lecture / Pause' },
  split: { key: 's', description: 'Diviser le clip à la tête de lecture' },
  delete: { key: 'Delete', description: 'Supprimer le clip sélectionné' },
  deleteBackspace: { key: 'Backspace', description: 'Supprimer le clip sélectionné' },
  undo: { key: 'z', ctrl: true, description: 'Annuler' },
  zoomIn: { key: '=', ctrl: true, description: 'Zoom timeline +' },
  zoomOut: { key: '-', ctrl: true, description: 'Zoom timeline -' },
  nextFrame: { key: 'ArrowRight', description: 'Frame suivante' },
  prevFrame: { key: 'ArrowLeft', description: 'Frame précédente' },
};
