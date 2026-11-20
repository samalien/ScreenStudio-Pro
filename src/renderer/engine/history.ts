/**
 * Undo / Redo command stack.
 * Stores inverse operations so the project model can be restored exactly.
 */

import type { Clip, Track, HistoryEntry } from './types';

const MAX_HISTORY = 80;

export type SnapshotData = {
  clips: Clip[];
  tracks: Track[];
  selectedClipId: string | null;
  currentTime: number;
  duration: number;
};

type Listener = () => void;

export class HistoryEngine {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<Listener>();
  private isApplying = false;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
  get undoLabel() {
    return this.undoStack[this.undoStack.length - 1]?.label ?? null;
  }
  get redoLabel() {
    return this.redoStack[this.redoStack.length - 1]?.label ?? null;
  }
  get entries() {
    return [...this.undoStack];
  }

  /**
   * Push a command. `before` and `after` are full snapshots of relevant state.
   * Applying undo restores `before`, redo restores `after`.
   */
  push(
    label: string,
    before: SnapshotData,
    after: SnapshotData,
    apply: (snap: SnapshotData) => void
  ) {
    if (this.isApplying) return;
    const entry: HistoryEntry = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      timestamp: Date.now(),
      undo: () => {
        this.isApplying = true;
        try {
          apply(structuredClone(before));
        } finally {
          this.isApplying = false;
        }
      },
      redo: () => {
        this.isApplying = true;
        try {
          apply(structuredClone(after));
        } finally {
          this.isApplying = false;
        }
      },
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    entry.undo();
    this.redoStack.push(entry);
    this.emit();
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    entry.redo();
    this.undoStack.push(entry);
    this.emit();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }
}

export const historyEngine = new HistoryEngine();
