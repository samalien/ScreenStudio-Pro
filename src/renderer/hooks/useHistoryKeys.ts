import { useEffect, useState } from 'react';
import { historyEngine } from '../engine/history';
import { useProjectStore } from '../stores/projectStore';

export function useHistoryKeys() {
  const [, force] = useState(0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => historyEngine.subscribe(() => force((n) => n + 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    canUndo: historyEngine.canUndo,
    canRedo: historyEngine.canRedo,
    undoLabel: historyEngine.undoLabel,
    redoLabel: historyEngine.redoLabel,
    undo,
    redo,
  };
}
