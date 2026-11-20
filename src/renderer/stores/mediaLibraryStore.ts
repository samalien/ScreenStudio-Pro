import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ImportedMedia } from '../engine/mediaImport';

export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  name: string;
  src: string;
  duration: number;
  thumbnail?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
  waveform?: number[];
  addedAt: number;
}

interface MediaLibraryState {
  assets: MediaAsset[];
  addAsset: (asset: Omit<MediaAsset, 'id' | 'addedAt'> & { id?: string }) => string;
  addImported: (media: ImportedMedia) => string;
  removeAsset: (id: string) => void;
  clear: () => void;
  getById: (id: string) => MediaAsset | undefined;
}

export const useMediaLibraryStore = create<MediaLibraryState>((set, get) => ({
  assets: [],
  addAsset: (asset) => {
    const id = asset.id || uuidv4();
    set((s) => ({
      assets: [...s.assets, { ...asset, id, addedAt: Date.now() }],
    }));
    return id;
  },
  addImported: (media) => {
    return get().addAsset({
      id: media.id,
      kind: media.kind as MediaKind,
      name: media.name,
      src: media.src,
      duration: media.duration,
      thumbnail: media.thumbnail,
      width: media.width,
      height: media.height,
      mimeType: media.mimeType,
      sizeBytes: media.sizeBytes,
      waveform: media.waveform,
    });
  },
  removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
  clear: () => set({ assets: [] }),
  getById: (id) => get().assets.find((a) => a.id === id),
}));
