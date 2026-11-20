/**
 * Auto-save project document every N seconds when dirty.
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { saveProject } from '../services/api';

const INTERVAL_MS = 45_000;

export function useAutoSave(enabled = true) {
  const timer = useRef<number | null>(null);
  const lastSaved = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      const ui = useUIStore.getState();
      if (!ui.hasUnsavedChanges || !ui.projectPath) return;
      try {
        const doc = useProjectStore.getState().toDocument();
        const json = JSON.stringify(doc);
        if (json === lastSaved.current) return;
        ui.setSaving(true);
        await saveProject(doc, ui.projectPath);
        lastSaved.current = json;
        ui.setUnsaved(false);
        ui.setSaving(false);
      } catch {
        useUIStore.getState().setSaving(false);
      }
    };

    timer.current = window.setInterval(tick, INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled]);
}

/** Mark project dirty whenever clips change */
export function useDirtyTracker() {
  useEffect(() => {
    let prev = useProjectStore.getState().clips;
    return useProjectStore.subscribe((state) => {
      if (state.clips !== prev) {
        prev = state.clips;
        useUIStore.getState().setUnsaved(true);
      }
    });
  }, []);
}
