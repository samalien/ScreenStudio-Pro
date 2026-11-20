/**
 * Zustand store for the professional Graphics / Photo Editor.
 * Manages document, layers, history, tools, zoom, selection.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  GraphicsDocument,
  GraphicsLayer,
  GraphicsTool,
  ColorAdjustments,
  HistoryEntry,
  LayerTransform,
  TextStyle,
  ShapeStyle,
  ShapeKind,
  ExportOptions,
  Rect,
} from '../modules/graphics/types';
import { DEFAULT_ADJUSTMENTS } from '../modules/graphics/types';
import { getFilterById } from '../modules/graphics/filters/filtersLibrary';
import { mergeAdjustments } from '../modules/graphics/filters/adjustments';

const MAX_HISTORY = 50;

function createDefaultTransform(w = 400, h = 300): LayerTransform {
  return {
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
  };
}

function createEmptyDocument(name = 'Sans titre', width = 1920, height = 1080): GraphicsDocument {
  return {
    id: uuidv4(),
    name,
    width,
    height,
    background: '#1a1e26',
    layers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function cloneDocument(doc: GraphicsDocument): GraphicsDocument {
  return structuredClone(doc);
}

interface GraphicsState {
  document: GraphicsDocument;
  selectedLayerIds: string[];
  activeTool: GraphicsTool;
  zoom: number;
  panX: number;
  panY: number;
  history: HistoryEntry[];
  historyIndex: number;
  isDirty: boolean;
  cropRect: Rect | null;
  showGrid: boolean;
  showGuides: boolean;
  snapToGrid: boolean;

  // —— document ——
  newDocument: (name?: string, width?: number, height?: number) => void;
  loadDocument: (doc: GraphicsDocument) => void;
  setDocumentName: (name: string) => void;
  setCanvasSize: (width: number, height: number) => void;
  setBackground: (color: string) => void;

  // —— layers ——
  addImageLayer: (src: string, name: string, naturalWidth: number, naturalHeight: number) => string;
  addTextLayer: (text?: string, style?: Partial<TextStyle>) => string;
  addShapeLayer: (kind: ShapeKind, style?: Partial<ShapeStyle>) => string;
  addStickerLayer: (content: string, name: string, isEmoji?: boolean) => string;
  removeLayers: (ids: string[]) => void;
  duplicateLayers: (ids: string[]) => void;
  updateLayer: (id: string, updates: Partial<GraphicsLayer>) => void;
  updateLayerTransform: (id: string, transform: Partial<LayerTransform>) => void;
  updateLayerAdjustments: (id: string, adjustments: Partial<ColorAdjustments>) => void;
  setLayerFilter: (id: string, filterId: string | null) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  reorderLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  selectLayers: (ids: string[]) => void;
  clearSelection: () => void;
  getSelectedLayers: () => GraphicsLayer[];
  getLayerById: (id: string) => GraphicsLayer | undefined;

  // —— tools & view ——
  setTool: (tool: GraphicsTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: (containerW: number, containerH: number) => void;
  setCropRect: (rect: Rect | null) => void;
  applyCrop: () => void;
  toggleGrid: () => void;

  // —— history ——
  commit: (label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // —— export helpers ——
  getEffectiveAdjustments: (layer: GraphicsLayer) => ColorAdjustments;
}

export const useGraphicsStore = create<GraphicsState>((set, get) => ({
  document: createEmptyDocument(),
  selectedLayerIds: [],
  activeTool: 'select',
  zoom: 0.5,
  panX: 0,
  panY: 0,
  history: [],
  historyIndex: -1,
  isDirty: false,
  cropRect: null,
  showGrid: false,
  showGuides: true,
  snapToGrid: true,

  newDocument: (name = 'Sans titre', width = 1920, height = 1080) => {
    const doc = createEmptyDocument(name, width, height);
    set({
      document: doc,
      selectedLayerIds: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      cropRect: null,
      zoom: 0.5,
      panX: 0,
      panY: 0,
    });
    get().commit('Nouveau document');
  },

  loadDocument: (doc) => {
    set({
      document: cloneDocument(doc),
      selectedLayerIds: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
      cropRect: null,
    });
    get().commit('Document chargé');
  },

  setDocumentName: (name) => {
    set((s) => ({
      document: { ...s.document, name, updatedAt: Date.now() },
      isDirty: true,
    }));
  },

  setCanvasSize: (width, height) => {
    set((s) => ({
      document: { ...s.document, width, height, updatedAt: Date.now() },
      isDirty: true,
    }));
    get().commit('Redimensionner le canevas');
  },

  setBackground: (color) => {
    set((s) => ({
      document: { ...s.document, background: color, updatedAt: Date.now() },
      isDirty: true,
    }));
    get().commit('Fond modifié');
  },

  addImageLayer: (src, name, naturalWidth, naturalHeight) => {
    const id = uuidv4();
    const { document } = get();
    // Fit inside canvas while preserving aspect
    const scale = Math.min(
      document.width / naturalWidth,
      document.height / naturalHeight,
      1
    );
    const w = Math.round(naturalWidth * scale);
    const h = Math.round(naturalHeight * scale);
    const layer: GraphicsLayer = {
      id,
      type: 'image',
      name: name || 'Image',
      visible: true,
      locked: false,
      transform: {
        x: Math.round((document.width - w) / 2),
        y: Math.round((document.height - h) / 2),
        width: w,
        height: h,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
      src,
      naturalWidth,
      naturalHeight,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      filterId: null,
      blendMode: 'source-over',
      crop: null,
      zIndex: document.layers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedLayerIds: [id],
      isDirty: true,
    }));
    get().commit(`Ajouter image « ${name} »`);
    return id;
  },

  addTextLayer: (text = 'Double-cliquez pour éditer', style) => {
    const id = uuidv4();
    const { document } = get();
    const layer: GraphicsLayer = {
      id,
      type: 'text',
      name: 'Texte',
      visible: true,
      locked: false,
      transform: {
        x: Math.round(document.width / 2 - 150),
        y: Math.round(document.height / 2 - 30),
        width: 300,
        height: 60,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
      text,
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 48,
        fontWeight: 700,
        color: '#ffffff',
        backgroundColor: 'transparent',
        align: 'center',
        lineHeight: 1.2,
        letterSpacing: 0,
        ...style,
      },
      zIndex: document.layers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedLayerIds: [id],
      isDirty: true,
    }));
    get().commit('Ajouter texte');
    return id;
  },

  addShapeLayer: (kind, style) => {
    const id = uuidv4();
    const { document } = get();
    const layer: GraphicsLayer = {
      id,
      type: 'shape',
      name: kind === 'rect' ? 'Rectangle' : kind === 'ellipse' ? 'Ellipse' : kind,
      visible: true,
      locked: false,
      transform: {
        x: Math.round(document.width / 2 - 100),
        y: Math.round(document.height / 2 - 80),
        width: 200,
        height: 160,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
      shapeKind: kind,
      shapeStyle: {
        fill: '#4f8cff',
        stroke: '#ffffff',
        strokeWidth: 0,
        cornerRadius: kind === 'rect' ? 8 : 0,
        ...style,
      },
      zIndex: document.layers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedLayerIds: [id],
      isDirty: true,
    }));
    get().commit(`Ajouter forme « ${kind} »`);
    return id;
  },

  addStickerLayer: (content, name, isEmoji = true) => {
    const id = uuidv4();
    const { document } = get();
    const size = isEmoji ? 120 : 200;
    const layer: GraphicsLayer = {
      id,
      type: 'text', // stickers rendered as text/emoji for simplicity
      name: name || 'Sticker',
      visible: true,
      locked: false,
      transform: {
        x: Math.round(document.width / 2 - size / 2),
        y: Math.round(document.height / 2 - size / 2),
        width: size,
        height: size,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
      },
      text: content,
      textStyle: {
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif',
        fontSize: isEmoji ? 96 : 48,
        fontWeight: 400,
        color: '#ffffff',
        backgroundColor: 'transparent',
        align: 'center',
        lineHeight: 1,
        letterSpacing: 0,
      },
      zIndex: document.layers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, layer],
        updatedAt: Date.now(),
      },
      selectedLayerIds: [id],
      isDirty: true,
    }));
    get().commit(`Ajouter sticker « ${name} »`);
    return id;
  },

  removeLayers: (ids) => {
    if (!ids.length) return;
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.filter((l) => !ids.includes(l.id)),
        updatedAt: Date.now(),
      },
      selectedLayerIds: s.selectedLayerIds.filter((id) => !ids.includes(id)),
      isDirty: true,
    }));
    get().commit(ids.length > 1 ? `Supprimer ${ids.length} calques` : 'Supprimer calque');
  },

  duplicateLayers: (ids) => {
    const { document } = get();
    const newIds: string[] = [];
    const clones: GraphicsLayer[] = [];
    ids.forEach((id) => {
      const src = document.layers.find((l) => l.id === id);
      if (!src) return;
      const nid = uuidv4();
      newIds.push(nid);
      clones.push({
        ...structuredClone(src),
        id: nid,
        name: `${src.name} copie`,
        transform: {
          ...src.transform,
          x: src.transform.x + 20,
          y: src.transform.y + 20,
        },
        zIndex: document.layers.length + clones.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    if (!clones.length) return;
    set((s) => ({
      document: {
        ...s.document,
        layers: [...s.document.layers, ...clones],
        updatedAt: Date.now(),
      },
      selectedLayerIds: newIds,
      isDirty: true,
    }));
    get().commit('Dupliquer calque(s)');
  },

  updateLayer: (id, updates) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === id ? { ...l, ...updates, updatedAt: Date.now() } : l
        ),
        updatedAt: Date.now(),
      },
      isDirty: true,
    }));
  },

  updateLayerTransform: (id, transform) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === id
            ? { ...l, transform: { ...l.transform, ...transform }, updatedAt: Date.now() }
            : l
        ),
        updatedAt: Date.now(),
      },
      isDirty: true,
    }));
  },

  updateLayerAdjustments: (id, adjustments) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === id
            ? {
                ...l,
                adjustments: { ...(l.adjustments || DEFAULT_ADJUSTMENTS), ...adjustments },
                updatedAt: Date.now(),
              }
            : l
        ),
        updatedAt: Date.now(),
      },
      isDirty: true,
    }));
  },

  setLayerFilter: (id, filterId) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) =>
          l.id === id ? { ...l, filterId, updatedAt: Date.now() } : l
        ),
        updatedAt: Date.now(),
      },
      isDirty: true,
    }));
    get().commit(filterId ? `Filtre « ${filterId} »` : 'Retirer filtre');
  },

  setLayerVisibility: (id, visible) => {
    get().updateLayer(id, { visible });
  },

  setLayerLocked: (id, locked) => {
    get().updateLayer(id, { locked });
  },

  reorderLayer: (id, direction) => {
    const { document } = get();
    const layers = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);
    const idx = layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    let newIdx = idx;
    if (direction === 'up') newIdx = Math.min(layers.length - 1, idx + 1);
    if (direction === 'down') newIdx = Math.max(0, idx - 1);
    if (direction === 'top') newIdx = layers.length - 1;
    if (direction === 'bottom') newIdx = 0;
    if (newIdx === idx) return;
    const [item] = layers.splice(idx, 1);
    layers.splice(newIdx, 0, item);
    const reindexed = layers.map((l, i) => ({ ...l, zIndex: i }));
    set((s) => ({
      document: { ...s.document, layers: reindexed, updatedAt: Date.now() },
      isDirty: true,
    }));
    get().commit('Réordonner calque');
  },

  selectLayers: (ids) => set({ selectedLayerIds: ids }),
  clearSelection: () => set({ selectedLayerIds: [] }),
  getSelectedLayers: () => {
    const { document, selectedLayerIds } = get();
    return document.layers.filter((l) => selectedLayerIds.includes(l.id));
  },
  getLayerById: (id) => get().document.layers.find((l) => l.id === id),

  setTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(8, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  zoomIn: () => set((s) => ({ zoom: Math.min(8, s.zoom * 1.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.05, s.zoom / 1.25) })),
  zoomToFit: (containerW, containerH) => {
    const { document } = get();
    const pad = 48;
    const zx = (containerW - pad) / document.width;
    const zy = (containerH - pad) / document.height;
    set({ zoom: Math.max(0.05, Math.min(1, Math.min(zx, zy))), panX: 0, panY: 0 });
  },
  setCropRect: (rect) => set({ cropRect: rect }),
  applyCrop: () => {
    const { cropRect, document, selectedLayerIds } = get();
    if (!cropRect || !selectedLayerIds.length) return;
    const id = selectedLayerIds[0];
    const layer = document.layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'image') return;
    // Store crop relative to layer
    get().updateLayer(id, {
      crop: {
        x: cropRect.x,
        y: cropRect.y,
        width: cropRect.width,
        height: cropRect.height,
      },
      transform: {
        ...layer.transform,
        width: cropRect.width,
        height: cropRect.height,
      },
    });
    set({ cropRect: null });
    get().commit('Recadrer');
  },
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  commit: (label) => {
    const { document, history, historyIndex } = get();
    const entry: HistoryEntry = {
      id: uuidv4(),
      label,
      timestamp: Date.now(),
      document: cloneDocument(document),
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isDirty: true,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    set({
      document: cloneDocument(prev.document),
      historyIndex: historyIndex - 1,
      selectedLayerIds: [],
      isDirty: true,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    set({
      document: cloneDocument(next.document),
      historyIndex: historyIndex + 1,
      selectedLayerIds: [],
      isDirty: true,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  getEffectiveAdjustments: (layer) => {
    const base = layer.adjustments || DEFAULT_ADJUSTMENTS;
    const filter = getFilterById(layer.filterId);
    if (filter?.adjustments) {
      return mergeAdjustments(base, filter.adjustments);
    }
    return base;
  },
}));
