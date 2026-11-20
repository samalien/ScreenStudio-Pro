/**
 * Professional multi-track project store + editing engine API.
 * All mutations go through helpers that record undo history.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  type Clip,
  type ClipEffects,
  type Track,
  type Keyframe,
  type ProjectSnapshot,
  type TransitionType,
  defaultEffects,
  defaultAudioSettings,
  DEFAULT_TRACKS,
} from '../engine/types';
import { historyEngine, type SnapshotData } from '../engine/history';

export type { Clip, ClipEffects, Track, Keyframe, ProjectSnapshot, TransitionType };
export { defaultEffects };

function cloneClips(clips: Clip[]): Clip[] {
  return structuredClone(clips);
}

function maxDuration(clips: Clip[]): number {
  return clips.reduce((m, c) => Math.max(m, c.start + c.duration), 0);
}

interface ProjectState {
  clips: Clip[];
  tracks: Track[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoom: number;
  snapEnabled: boolean;
  projectId: string;
  projectName: string;
  clipboard: Clip | null;

  // —— reads ——
  getClipsAtTime: (time: number) => Clip[];
  getSelected: () => Clip | undefined;
  snapshot: () => SnapshotData;

  // —— core mutations (with history) ——
  applySnapshot: (snap: SnapshotData) => void;
  commit: (label: string, mutator: (clips: Clip[], tracks: Track[]) => { clips: Clip[]; tracks?: Track[] }) => void;

  addClip: (
    data: Partial<Clip> &
      Pick<Clip, 'type' | 'name' | 'start' | 'duration' | 'trimStart' | 'src' | 'sourceDuration' | 'track'>
  ) => string;
  removeClip: (id: string) => void;
  removeClips: (ids: string[]) => void;
  updateClip: (id: string, updates: Partial<Clip>) => void;
  updateEffects: (id: string, effects: Partial<ClipEffects>) => void;
  splitClip: (id: string, atTime: number) => void;
  duplicateClip: (id: string) => void;
  trimClip: (id: string, edge: 'start' | 'end', timelineTime: number) => void;
  moveClip: (id: string, newStart: number, newTrack?: number) => void;
  setClipSpeed: (id: string, speed: number) => void;
  setClipReverse: (id: string, reverse: boolean) => void;
  mergeClips: (ids: string[]) => void;
  addKeyframe: (clipId: string, kf: Omit<Keyframe, 'id'>) => void;
  removeKeyframe: (clipId: string, kfId: string) => void;

  // tracks
  setTrackLocked: (trackId: number, locked: boolean) => void;
  setTrackHidden: (trackId: number, hidden: boolean) => void;
  setTrackMuted: (trackId: number, muted: boolean) => void;

  // transport
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedClipId: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  stepFrame: (dir: 1 | -1, fps?: number) => void;

  // project
  clearProject: () => void;
  loadSnapshot: (doc: ProjectSnapshot) => void;
  toDocument: () => ProjectSnapshot;
  recalculateDuration: () => void;

  // history
  undo: () => void;
  redo: () => void;

  // clipboard + context actions
  copyClip: (id: string) => void;
  cutClip: (id: string) => void;
  pasteClip: (atTime?: number) => string | null;
  renameClip: (id: string, name: string) => void;
  setClipLocked: (id: string, locked: boolean) => void;
  /**
   * Extract real audio from a video clip, place synced audio on an audio track,
   * mute the video's embedded audio. Returns new audio clip id or null.
   */
  separateAudioVideo: (videoClipId: string) => Promise<string | null>;
}

function normalizeClip(
  data: Partial<Clip> &
    Pick<Clip, 'type' | 'name' | 'start' | 'duration' | 'trimStart' | 'src' | 'sourceDuration' | 'track'>
): Clip {
  return {
    id: data.id || uuidv4(),
    type: data.type,
    name: data.name,
    start: Math.max(0, data.start),
    duration: Math.max(0.05, data.duration),
    trimStart: Math.max(0, data.trimStart),
    src: data.src,
    sourceDuration: data.sourceDuration || data.duration,
    filePath: data.filePath,
    mimeType: data.mimeType,
    width: data.width,
    height: data.height,
    fps: data.fps,
    text: data.text,
    textStyle: data.textStyle,
    track: data.track,
    volume: data.volume ?? 1,
    speed: data.speed ?? 1,
    reverse: data.reverse ?? false,
    fadeIn: data.fadeIn ?? 0,
    fadeOut: data.fadeOut ?? 0,
    transitionIn: data.transitionIn ?? 'none',
    transitionOut: data.transitionOut ?? 'none',
    effects: { ...defaultEffects(), ...(data.effects || {}) },
    keyframes: data.keyframes ? [...data.keyframes] : [],
    locked: data.locked ?? false,
    muted: data.muted ?? false,
    thumbnail: data.thumbnail,
    waveform: data.waveform,
    audio: data.audio ? { ...defaultAudioSettings(), ...data.audio } : defaultAudioSettings(),
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  clips: [],
  tracks: structuredClone(DEFAULT_TRACKS),
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  selectedClipId: null,
  zoom: 80,
  snapEnabled: true,
  projectId: uuidv4(),
  projectName: 'Untitled Project',
  clipboard: null,

  getClipsAtTime: (time) =>
    get().clips.filter((c) => time >= c.start && time < c.start + c.duration),

  getSelected: () => {
    const id = get().selectedClipId;
    return get().clips.find((c) => c.id === id);
  },

  snapshot: () => ({
    clips: cloneClips(get().clips),
    tracks: structuredClone(get().tracks),
    selectedClipId: get().selectedClipId,
    currentTime: get().currentTime,
    duration: get().duration,
  }),

  applySnapshot: (snap) => {
    set({
      clips: cloneClips(snap.clips),
      tracks: structuredClone(snap.tracks),
      selectedClipId: snap.selectedClipId,
      currentTime: snap.currentTime,
      duration: snap.duration || maxDuration(snap.clips),
    });
  },

  commit: (label, mutator) => {
    const before = get().snapshot();
    const result = mutator(cloneClips(get().clips), structuredClone(get().tracks));
    const clips = result.clips;
    const tracks = result.tracks ?? get().tracks;
    const duration = maxDuration(clips);
    set({ clips, tracks, duration });
    const after = get().snapshot();
    historyEngine.push(label, before, after, (snap) => get().applySnapshot(snap));
  },

  addClip: (data) => {
    const clip = normalizeClip(data);
    get().commit(`Ajouter « ${clip.name} »`, (clips) => ({
      clips: [...clips, clip],
    }));
    set({ selectedClipId: clip.id });
    return clip.id;
  },

  removeClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    const track = get().tracks.find((t) => t.id === clip.track);
    if (track?.locked) return;
    get().commit(`Supprimer « ${clip.name} »`, (clips) => ({
      clips: clips.filter((c) => c.id !== id),
    }));
    if (get().selectedClipId === id) set({ selectedClipId: null });
  },

  removeClips: (ids) => {
    const setIds = new Set(ids);
    get().commit(`Supprimer ${ids.length} clips`, (clips, tracks) => ({
      clips: clips.filter((c) => {
        if (!setIds.has(c.id)) return true;
        if (c.locked) return true;
        const tr = tracks.find((t) => t.id === c.track);
        return tr?.locked;
      }),
    }));
  },

  updateClip: (id, updates) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    get().commit(`Modifier « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  updateEffects: (id, effects) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    get().commit(`Effets « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) =>
        c.id === id ? { ...c, effects: { ...c.effects, ...effects } } : c
      ),
    }));
  },

  splitClip: (id, atTime) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    const relativeTime = atTime - clip.start;
    if (relativeTime <= 0.04 || relativeTime >= clip.duration - 0.04) return;

    const sourceAdvance = relativeTime * Math.abs(clip.speed || 1);
    const first: Clip = {
      ...structuredClone(clip),
      id: uuidv4(),
      duration: relativeTime,
    };
    const second: Clip = {
      ...structuredClone(clip),
      id: uuidv4(),
      start: atTime,
      duration: clip.duration - relativeTime,
      trimStart: clip.trimStart + sourceAdvance,
      name: `${clip.name} (2)`,
    };

    get().commit(`Diviser « ${clip.name} »`, (clips) => ({
      clips: [...clips.filter((c) => c.id !== id), first, second],
    }));
    set({ selectedClipId: second.id });
  },

  duplicateClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    const copy = {
      ...structuredClone(clip),
      id: uuidv4(),
      start: clip.start + clip.duration,
      name: `${clip.name} copie`,
      locked: false,
    };
    get().commit(`Dupliquer « ${clip.name} »`, (clips) => ({
      clips: [...clips, copy],
    }));
    set({ selectedClipId: copy.id });
  },

  trimClip: (id, edge, timelineTime) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;

    if (edge === 'start') {
      const newStart = Math.max(clip.start, Math.min(timelineTime, clip.start + clip.duration - 0.1));
      const delta = newStart - clip.start;
      const sourceAdvance = delta * Math.abs(clip.speed || 1);
      get().commit(`Rogner début « ${clip.name} »`, (clips) => ({
        clips: clips.map((c) =>
          c.id === id
            ? {
                ...c,
                start: newStart,
                duration: c.duration - delta,
                trimStart: c.trimStart + sourceAdvance,
              }
            : c
        ),
      }));
    } else {
      const newEnd = Math.max(clip.start + 0.1, Math.min(timelineTime, clip.start + clip.duration + 60));
      const newDuration = newEnd - clip.start;
      get().commit(`Rogner fin « ${clip.name} »`, (clips) => ({
        clips: clips.map((c) => (c.id === id ? { ...c, duration: newDuration } : c)),
      }));
    }
  },

  moveClip: (id, newStart, newTrack) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    if (newTrack !== undefined) {
      const tr = get().tracks.find((t) => t.id === newTrack);
      if (tr?.locked) return;
    }
    const start = Math.max(0, newStart);
    get().commit(`Déplacer « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) =>
        c.id === id
          ? { ...c, start, track: newTrack !== undefined ? newTrack : c.track }
          : c
      ),
    }));
  },

  setClipSpeed: (id, speed) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    const s = Math.max(0.1, Math.min(8, speed));
    // Keep source content: adjust timeline duration
    const contentSpan = clip.duration * Math.abs(clip.speed || 1);
    const newDuration = contentSpan / s;
    get().commit(`Vitesse « ${clip.name} » ×${s}`, (clips) => ({
      clips: clips.map((c) =>
        c.id === id ? { ...c, speed: s, duration: Math.max(0.05, newDuration) } : c
      ),
    }));
  },

  setClipReverse: (id, reverse) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    get().commit(`${reverse ? 'Inverser' : 'Sens normal'} « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) => (c.id === id ? { ...c, reverse } : c)),
    }));
  },

  mergeClips: (ids) => {
    if (ids.length < 2) return;
    const selected = get()
      .clips.filter((c) => ids.includes(c.id))
      .sort((a, b) => a.start - b.start);
    if (selected.length < 2) return;
    // Only merge contiguous same-track same-src clips
    const base = selected[0];
    const same = selected.every(
      (c) => c.track === base.track && c.src === base.src && c.type === base.type
    );
    if (!same) return;

    let end = base.start + base.duration;
    for (let i = 1; i < selected.length; i++) {
      const c = selected[i];
      if (Math.abs(c.start - end) > 0.05) return; // not contiguous
      end = c.start + c.duration;
    }
    const totalDuration = end - base.start;
    const merged: Clip = {
      ...structuredClone(base),
      id: uuidv4(),
      duration: totalDuration,
      name: `${base.name} (fusion)`,
    };
    const removeIds = new Set(selected.map((c) => c.id));
    get().commit(`Fusionner ${selected.length} clips`, (clips) => ({
      clips: [...clips.filter((c) => !removeIds.has(c.id)), merged],
    }));
    set({ selectedClipId: merged.id });
  },

  addKeyframe: (clipId, kf) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip || clip.locked) return;
    const full: Keyframe = { ...kf, id: uuidv4() };
    get().commit(`Keyframe ${kf.property}`, (clips) => ({
      clips: clips.map((c) =>
        c.id === clipId ? { ...c, keyframes: [...c.keyframes, full] } : c
      ),
    }));
  },

  removeKeyframe: (clipId, kfId) => {
    get().commit('Supprimer keyframe', (clips) => ({
      clips: clips.map((c) =>
        c.id === clipId
          ? { ...c, keyframes: c.keyframes.filter((k) => k.id !== kfId) }
          : c
      ),
    }));
  },

  setTrackLocked: (trackId, locked) => {
    get().commit(locked ? 'Verrouiller piste' : 'Déverrouiller piste', (clips, tracks) => ({
      clips,
      tracks: tracks.map((t) => (t.id === trackId ? { ...t, locked } : t)),
    }));
  },

  setTrackHidden: (trackId, hidden) => {
    set({
      tracks: get().tracks.map((t) => (t.id === trackId ? { ...t, hidden } : t)),
    });
  },

  setTrackMuted: (trackId, muted) => {
    set({
      tracks: get().tracks.map((t) => (t.id === trackId ? { ...t, muted } : t)),
    });
  },

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(400, zoom)) }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

  stepFrame: (dir, fps = 30) => {
    const frame = 1 / fps;
    set({ currentTime: Math.max(0, get().currentTime + dir * frame), isPlaying: false });
  },

  clearProject: () => {
    historyEngine.clear();
    set({
      clips: [],
      tracks: structuredClone(DEFAULT_TRACKS),
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      selectedClipId: null,
      projectId: uuidv4(),
      projectName: 'Untitled Project',
    });
  },

  loadSnapshot: (doc) => {
    historyEngine.clear();
    const clips = (doc.clips || []).map((c) => normalizeClip(c as any));
    set({
      clips,
      tracks: doc.tracks?.length ? doc.tracks : structuredClone(DEFAULT_TRACKS),
      currentTime: doc.currentTime || 0,
      duration: doc.duration || maxDuration(clips),
      isPlaying: false,
      selectedClipId: null,
      projectId: doc.id || uuidv4(),
      projectName: doc.name || 'Untitled Project',
    });
  },

  toDocument: (): ProjectSnapshot => {
    const s = get();
    return {
      version: '0.7.0',
      id: s.projectId,
      name: s.projectName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      duration: s.duration,
      clips: cloneClips(s.clips),
      tracks: structuredClone(s.tracks),
      currentTime: s.currentTime,
      settings: {
        width: 1920,
        height: 1080,
        fps: 30,
        backgroundColor: '#000000',
      },
    };
  },

  recalculateDuration: () => {
    set({ duration: maxDuration(get().clips) });
  },

  undo: () => {
    historyEngine.undo();
  },
  redo: () => {
    historyEngine.redo();
  },

  copyClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    set({ clipboard: structuredClone(clip) });
  },

  cutClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    const track = get().tracks.find((t) => t.id === clip.track);
    if (track?.locked) return;
    set({ clipboard: structuredClone(clip) });
    get().removeClip(id);
  },

  pasteClip: (atTime) => {
    const clip = get().clipboard;
    if (!clip) return null;
    const start = atTime ?? get().currentTime;
    const copy = {
      ...structuredClone(clip),
      id: uuidv4(),
      start: Math.max(0, start),
      name: `${clip.name} copie`,
      locked: false,
    };
    get().commit(`Coller « ${copy.name} »`, (clips) => ({
      clips: [...clips, copy],
    }));
    set({ selectedClipId: copy.id });
    return copy.id;
  },

  renameClip: (id, name) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.locked) return;
    const n = name.trim();
    if (!n || n === clip.name) return;
    get().commit(`Renommer « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) => (c.id === id ? { ...c, name: n } : c)),
    }));
  },

  setClipLocked: (id, locked) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip) return;
    get().commit(`${locked ? 'Verrouiller' : 'Déverrouiller'} « ${clip.name} »`, (clips) => ({
      clips: clips.map((c) => (c.id === id ? { ...c, locked } : c)),
    }));
  },

  separateAudioVideo: async (videoClipId) => {
    const clip = get().clips.find((c) => c.id === videoClipId);
    if (!clip || clip.type !== 'video' || !clip.src) {
      return null;
    }
    if (clip.locked) return null;

    // Dynamic import to avoid circular deps at module load
    const { extractAudioFromVideo, computeWaveform, diagnoseVideoAudio } = await import(
      '../engine/audioEngine'
    );
    const extracted = await extractAudioFromVideo(clip.src);
    if (!extracted) {
      try {
        const diag = await diagnoseVideoAudio(clip.src);
        (get() as any)._lastSeparateError = diag.message;
      } catch {
        (get() as any)._lastSeparateError =
          'Impossible d’extraire l’audio (fichier sans son ou format non supporté).';
      }
      return null;
    }
    (get() as any)._lastSeparateError = null;

    // Prefer track 2 (A1), else 4 (A2), else any audio track
    const audioTracks = get().tracks.filter((t) => t.kind === 'audio' && !t.locked);
    const preferred =
      audioTracks.find((t) => t.id === 2) ||
      audioTracks.find((t) => t.id === 4) ||
      audioTracks[0];
    const trackId = preferred?.id ?? 2;

    let waveform: number[] | undefined;
    try {
      waveform = await computeWaveform(extracted.url, 96);
    } catch {
      waveform = undefined;
    }

    // Timeline duration / trim aligned with the video clip
    const speed = Math.abs(clip.speed || 1) || 1;
    const sourceSpan = clip.duration * speed;
    const audioSourceDuration = extracted.duration;
    const audioTrimStart = Math.min(clip.trimStart, Math.max(0, audioSourceDuration - 0.05));
    const audioDuration = Math.min(
      clip.duration,
      Math.max(0.05, (audioSourceDuration - audioTrimStart) / speed)
    );

    const audioId = uuidv4();
    const audioClip: Clip = normalizeClip({
      id: audioId,
      type: 'audio',
      name: `Audio · ${clip.name}`,
      start: clip.start,
      duration: audioDuration,
      trimStart: audioTrimStart,
      src: extracted.url,
      sourceDuration: audioSourceDuration,
      track: trackId,
      volume: clip.volume ?? 1,
      speed: clip.speed || 1,
      reverse: false,
      fadeIn: clip.fadeIn || 0,
      fadeOut: clip.fadeOut || 0,
      waveform,
      mimeType: 'audio/wav',
    });

    get().commit(`Séparer audio « ${clip.name} »`, (clips) => ({
      clips: [
        ...clips.map((c) =>
          c.id === videoClipId
            ? {
                ...c,
                // Mute embedded audio so it doesn't double with the new track
                muted: true,
                name: c.name.includes('(vidéo)') ? c.name : `${c.name} (vidéo)`,
              }
            : c
        ),
        audioClip,
      ],
    }));
    set({ selectedClipId: audioId });
    return audioId;
  },
}));
