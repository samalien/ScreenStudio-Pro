/**
 * Subtitle tracks state — persisted alongside project document.
 */

import { create } from 'zustand';
import type { SubtitleCue, SubtitleLanguage, SubtitleStyle, SubtitleTrack } from '../engine/subtitles/types';
import { defaultSubtitleStyle } from '../engine/subtitles/types';
import { withIds, transcriptToCues } from '../engine/subtitles/sttProviders';
import { translateCues, detectLanguage } from '../engine/subtitles/translation';
import { cuesToSRT, cuesToVTT, parseSRT, downloadText } from '../engine/subtitles/format';

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

interface SubtitleState {
  tracks: SubtitleTrack[];
  activeTrackId: string | null;
  selectedCueId: string | null;
  busy: boolean;
  progress: string;

  setBusy: (b: boolean, msg?: string) => void;
  setActiveTrack: (id: string | null) => void;
  setSelectedCue: (id: string | null) => void;

  createTrack: (label: string, language: SubtitleLanguage) => string;
  removeTrack: (id: string) => void;
  updateTrackStyle: (id: string, style: Partial<SubtitleStyle>) => void;
  setTrackLanguage: (id: string, language: SubtitleLanguage) => void;
  setTrackVisible: (id: string, visible: boolean) => void;

  setCues: (trackId: string, cues: SubtitleCue[]) => void;
  addCue: (trackId: string, cue: Partial<SubtitleCue> & { start: number; end: number; text: string }) => void;
  updateCue: (trackId: string, cueId: string, patch: Partial<SubtitleCue>) => void;
  removeCue: (trackId: string, cueId: string) => void;
  moveCue: (trackId: string, cueId: string, start: number, end: number) => void;

  importFromTranscript: (trackId: string, text: string, duration: number) => void;
  importSRT: (trackId: string, content: string) => void;
  exportSRT: (trackId: string, filename?: string) => void;
  exportVTT: (trackId: string, filename?: string) => void;

  translateTrack: (trackId: string, to: SubtitleLanguage) => Promise<string | null>;

  loadFromProject: (tracks: SubtitleTrack[]) => void;
  toJSON: () => SubtitleTrack[];
  clear: () => void;
}

export const useSubtitleStore = create<SubtitleState>((set, get) => ({
  tracks: [],
  activeTrackId: null,
  selectedCueId: null,
  busy: false,
  progress: '',

  setBusy: (b, msg = '') => set({ busy: b, progress: msg }),
  setActiveTrack: (id) => set({ activeTrackId: id }),
  setSelectedCue: (id) => set({ selectedCueId: id }),

  createTrack: (label, language) => {
    const id = newId('sub');
    const track: SubtitleTrack = {
      id,
      label,
      language,
      cues: [],
      style: defaultSubtitleStyle(),
      visible: true,
    };
    set((s) => ({ tracks: [...s.tracks, track], activeTrackId: id }));
    return id;
  },

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      activeTrackId: s.activeTrackId === id ? s.tracks[0]?.id || null : s.activeTrackId,
    })),

  updateTrackStyle: (id, style) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === id ? { ...t, style: { ...t.style, ...style } } : t
      ),
    })),

  setTrackLanguage: (id, language) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, language } : t)),
    })),

  setTrackVisible: (id, visible) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, visible } : t)),
    })),

  setCues: (trackId, cues) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === trackId ? { ...t, cues } : t)),
    })),

  addCue: (trackId, cue) => {
    const full: SubtitleCue = {
      id: newId('cue'),
      language: get().tracks.find((t) => t.id === trackId)?.language || 'fr',
      ...cue,
      text: cue.text,
      start: cue.start,
      end: cue.end,
    };
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, cues: [...t.cues, full].sort((a, b) => a.start - b.start) } : t
      ),
      selectedCueId: full.id,
    }));
  },

  updateCue: (trackId, cueId, patch) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              cues: t.cues
                .map((c) => (c.id === cueId ? { ...c, ...patch } : c))
                .sort((a, b) => a.start - b.start),
            }
          : t
      ),
    })),

  removeCue: (trackId, cueId) =>
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, cues: t.cues.filter((c) => c.id !== cueId) } : t
      ),
      selectedCueId: s.selectedCueId === cueId ? null : s.selectedCueId,
    })),

  moveCue: (trackId, cueId, start, end) =>
    get().updateCue(trackId, cueId, {
      start: Math.max(0, start),
      end: Math.max(start + 0.2, end),
    }),

  importFromTranscript: (trackId, text, duration) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;
    const raw = transcriptToCues(text, duration, track.language);
    get().setCues(trackId, withIds(raw));
  },

  importSRT: (trackId, content) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;
    get().setCues(trackId, parseSRT(content, track.language));
  },

  exportSRT: (trackId, filename) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;
    downloadText(filename || `${track.label || 'subtitles'}.srt`, cuesToSRT(track.cues), 'application/x-subrip');
  },

  exportVTT: (trackId, filename) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track) return;
    downloadText(filename || `${track.label || 'subtitles'}.vtt`, cuesToVTT(track.cues, track.style), 'text/vtt');
  },

  translateTrack: async (trackId, to) => {
    const track = get().tracks.find((t) => t.id === trackId);
    if (!track || !track.cues.length) return null;
    get().setBusy(true, 'Traduction…');
    try {
      let from = track.language;
      if (from === 'auto') {
        from = await detectLanguage(track.cues.map((c) => c.text).join(' '));
      }
      const translated = await translateCues(track.cues, from, to, (p) =>
        get().setBusy(true, p.message)
      );
      const label = `${track.label} → ${to}`;
      const id = get().createTrack(label, to);
      get().setCues(id, translated);
      get().updateTrackStyle(id, {
        direction: to === 'ar' ? 'rtl' : 'auto',
      });
      get().setBusy(false, '');
      return id;
    } catch (err: any) {
      get().setBusy(false, '');
      throw err;
    }
  },

  loadFromProject: (tracks) =>
    set({
      tracks: tracks || [],
      activeTrackId: tracks?.[0]?.id || null,
    }),

  toJSON: () => get().tracks,

  clear: () => set({ tracks: [], activeTrackId: null, selectedCueId: null }),
}));
