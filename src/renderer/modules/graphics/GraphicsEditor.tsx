/**
 * Professional Graphics & Photo Editor – main workspace.
 * Canvas + Toolbar + Layers + Properties + History.
 * Integrates with media library and video timeline.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Upload, Download, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Crop, RotateCw, Type, Square, Circle, Star, Move, MousePointer2,
  Layers, Settings2, Image as ImageIcon, Sparkles, Trash2, Copy,
  Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Grid3X3,
  Sun, Contrast, Droplets, Thermometer, Palette, Wand2,
  Plus, Save, Film, FolderOpen,
} from 'lucide-react';
import { useGraphicsStore } from '../../stores/graphicsStore';
import { useMediaLibraryStore } from '../../stores/mediaLibraryStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { FILTER_PRESETS, FILTER_CATEGORIES, getFilterById } from './filters/filtersLibrary';
import { adjustmentsToCssFilter } from './filters/adjustments';
import type { GraphicsLayer, ColorAdjustments, ExportFormat, ShapeKind } from './types';
import { DEFAULT_ADJUSTMENTS } from './types';

// ——— Stickers / Emojis library ———
const STICKERS = [
  { id: 's1', name: 'Feu', content: '🔥', cat: 'emoji' },
  { id: 's2', name: 'Étoile', content: '⭐', cat: 'emoji' },
  { id: 's3', name: 'Cœur', content: '❤️', cat: 'emoji' },
  { id: 's4', name: 'OK', content: '👍', cat: 'emoji' },
  { id: 's5', name: 'Clap', content: '👏', cat: 'emoji' },
  { id: 's6', name: 'Rocket', content: '🚀', cat: 'emoji' },
  { id: 's7', name: 'Caméra', content: '🎬', cat: 'emoji' },
  { id: 's8', name: 'Musique', content: '🎵', cat: 'emoji' },
  { id: 's9', name: 'Check', content: '✅', cat: 'emoji' },
  { id: 's10', name: 'Warning', content: '⚠️', cat: 'emoji' },
  { id: 's11', name: 'Idée', content: '💡', cat: 'emoji' },
  { id: 's12', name: 'Cible', content: '🎯', cat: 'emoji' },
];

const CANVAS_PRESETS = [
  { name: 'Full HD', w: 1920, h: 1080 },
  { name: '4K', w: 3840, h: 2160 },
  { name: 'Instagram Post', w: 1080, h: 1080 },
  { name: 'Instagram Story', w: 1080, h: 1920 },
  { name: 'YouTube Thumb', w: 1280, h: 720 },
  { name: 'TikTok', w: 1080, h: 1920 },
  { name: 'Twitter/X', w: 1200, h: 675 },
  { name: 'Facebook Cover', w: 820, h: 312 },
  { name: 'A4 Portrait', w: 1240, h: 1754 },
  { name: 'Carré 1000', w: 1000, h: 1000 },
];

export function GraphicsEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rightTab, setRightTab] = useState<'properties' | 'filters' | 'layers' | 'history'>('properties');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportQuality, setExportQuality] = useState(0.92);
  const [isRendering, setIsRendering] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const {
    document: doc,
    selectedLayerIds,
    activeTool,
    zoom,
    panX,
    panY,
    history,
    historyIndex,
    isDirty,
    showGrid,
    setTool,
    setZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    setPan,
    newDocument,
    addImageLayer,
    addTextLayer,
    addShapeLayer,
    addStickerLayer,
    removeLayers,
    duplicateLayers,
    updateLayer,
    updateLayerTransform,
    updateLayerAdjustments,
    setLayerFilter,
    setLayerVisibility,
    setLayerLocked,
    reorderLayer,
    selectLayers,
    clearSelection,
    getSelectedLayers,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    setDocumentName,
    setCanvasSize,
    setBackground,
    getEffectiveAdjustments,
    toggleGrid,
  } = useGraphicsStore();

  const addMediaAsset = useMediaLibraryStore((s) => s.addAsset);
  const addClip = useProjectStore((s) => s.addClip);
  const currentTime = useProjectStore((s) => s.currentTime);
  const { notify, setView } = useUIStore();

  const selected = getSelectedLayers();
  const primary = selected[0] as GraphicsLayer | undefined;

  // ——— Render canvas ———
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = doc.width;
    canvas.height = doc.height;

    // Background
    if (doc.background === 'transparent') {
      // checkerboard
      const size = 16;
      for (let y = 0; y < doc.height; y += size) {
        for (let x = 0; x < doc.width; x += size) {
          ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#2a2e36' : '#1e222a';
          ctx.fillRect(x, y, size, size);
        }
      }
    } else {
      ctx.fillStyle = doc.background;
      ctx.fillRect(0, 0, doc.width, doc.height);
    }

    // Sort layers by zIndex
    const layers = [...doc.layers].sort((a, b) => a.zIndex - b.zIndex);

    layers.forEach((layer) => {
      if (!layer.visible) return;
      ctx.save();
      ctx.globalAlpha = layer.transform.opacity;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';

      const t = layer.transform;
      const cx = t.x + t.width / 2;
      const cy = t.y + t.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(t.scaleX, t.scaleY);
      ctx.translate(-t.width / 2, -t.height / 2);

      if (layer.type === 'image' && layer.src) {
        const img = imageCache.get(layer.src);
        if (img && img.complete) {
          // Apply CSS filter for preview speed
          const adj = getEffectiveAdjustments(layer);
          const filterCss = adjustmentsToCssFilter(adj);
          const preset = getFilterById(layer.filterId);
          if (preset?.cssFilter && preset.cssFilter !== 'none') {
            ctx.filter = `${filterCss} ${preset.cssFilter}`;
          } else {
            ctx.filter = filterCss;
          }

          if (layer.crop) {
            const sx = layer.crop.x;
            const sy = layer.crop.y;
            const sw = layer.crop.width;
            const sh = layer.crop.height;
            ctx.drawImage(
              img,
              sx, sy, sw, sh,
              0, 0, t.width, t.height
            );
          } else {
            ctx.drawImage(img, 0, 0, t.width, t.height);
          }
          ctx.filter = 'none';
        }
      } else if (layer.type === 'text' && layer.text && layer.textStyle) {
        const s = layer.textStyle;
        ctx.font = `${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
        ctx.fillStyle = s.color;
        ctx.textAlign = s.align;
        ctx.textBaseline = 'middle';
        if (s.shadowBlur) {
          ctx.shadowColor = s.shadowColor || 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = s.shadowBlur;
          ctx.shadowOffsetX = s.shadowOffsetX || 0;
          ctx.shadowOffsetY = s.shadowOffsetY || 0;
        }
        const x = s.align === 'center' ? t.width / 2 : s.align === 'right' ? t.width : 0;
        ctx.fillText(layer.text, x, t.height / 2, t.width);
        ctx.shadowBlur = 0;
      } else if (layer.type === 'shape' && layer.shapeKind && layer.shapeStyle) {
        const st = layer.shapeStyle;
        ctx.fillStyle = st.fill;
        ctx.strokeStyle = st.stroke;
        ctx.lineWidth = st.strokeWidth;
        const w = t.width;
        const h = t.height;
        if (layer.shapeKind === 'rect') {
          const r = st.cornerRadius || 0;
          if (r > 0) {
            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(w - r, 0);
            ctx.quadraticCurveTo(w, 0, w, r);
            ctx.lineTo(w, h - r);
            ctx.quadraticCurveTo(w, h, w - r, h);
            ctx.lineTo(r, h);
            ctx.quadraticCurveTo(0, h, 0, h - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.fill();
            if (st.strokeWidth > 0) ctx.stroke();
          } else {
            ctx.fillRect(0, 0, w, h);
            if (st.strokeWidth > 0) ctx.strokeRect(0, 0, w, h);
          }
        } else if (layer.shapeKind === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          if (st.strokeWidth > 0) ctx.stroke();
        } else if (layer.shapeKind === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
          if (st.strokeWidth > 0) ctx.stroke();
        } else if (layer.shapeKind === 'star') {
          drawStar(ctx, w / 2, h / 2, 5, w / 2, w / 4);
          ctx.fill();
          if (st.strokeWidth > 0) ctx.stroke();
        }
      }

      ctx.restore();
    });

    // Selection outlines
    selectedLayerIds.forEach((id) => {
      const layer = doc.layers.find((l) => l.id === id);
      if (!layer || !layer.visible) return;
      const t = layer.transform;
      ctx.save();
      ctx.strokeStyle = '#4f8cff';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(t.x, t.y, t.width, t.height);
      // handles
      const hs = 8 / zoom;
      ctx.fillStyle = '#4f8cff';
      ctx.setLineDash([]);
      [
        [t.x, t.y],
        [t.x + t.width, t.y],
        [t.x, t.y + t.height],
        [t.x + t.width, t.y + t.height],
      ].forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });
      ctx.restore();
    });
  }, [doc, selectedLayerIds, zoom, getEffectiveAdjustments]);

  // Image cache
  const imageCache = React.useMemo(() => new Map<string, HTMLImageElement>(), []);

  useEffect(() => {
    // Preload images
    doc.layers.forEach((layer) => {
      if (layer.type === 'image' && layer.src && !imageCache.has(layer.src)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imageCache.set(layer.src!, img);
          renderCanvas();
        };
        img.src = layer.src;
      }
    });
    renderCanvas();
  }, [doc, renderCanvas, imageCache]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }
      if (mod && e.key === 'd') {
        e.preventDefault();
        if (selectedLayerIds.length) duplicateLayers(selectedLayerIds);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIds.length && !(e.target as HTMLElement).matches('input, textarea')) {
          e.preventDefault();
          removeLayers(selectedLayerIds);
        }
      }
      if (e.key === 'v') setTool('select');
      if (e.key === 't') setTool('text');
      if (e.key === 'c') setTool('crop');
      if (e.key === 'r') setTool('rotate');
      if (mod && e.key === '0') {
        e.preventDefault();
        if (containerRef.current) {
          zoomToFit(containerRef.current.clientWidth, containerRef.current.clientHeight);
        }
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      }
      if (mod && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedLayerIds, duplicateLayers, removeLayers, setTool, zoomIn, zoomOut, zoomToFit]);

  // Fit on first mount
  useEffect(() => {
    if (containerRef.current) {
      zoomToFit(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
  }, []);

  // ——— Import image ———
  const handleImportFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) =>
      /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(f.name) || f.type.startsWith('image/')
    );
    if (!list.length) {
      notify({ type: 'warning', title: 'Aucun fichier image valide' });
      return;
    }
    for (const file of list) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => {
          imageCache.set(url, img);
          addImageLayer(url, file.name, img.naturalWidth, img.naturalHeight);
          // Also add to media library
          addMediaAsset({
            kind: 'image',
            name: file.name,
            src: url,
            duration: 5,
            width: img.naturalWidth,
            height: img.naturalHeight,
            mimeType: file.type,
            sizeBytes: file.size,
            thumbnail: url,
          });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    }
    notify({ type: 'success', title: `${list.length} image(s) importée(s)` });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleImportFiles(e.dataTransfer.files);
  };

  // ——— Export ———
  const exportImage = async (format: ExportFormat, quality = 0.92, sendToTimeline = false) => {
    setIsRendering(true);
    try {
      // Force high-quality render
      renderCanvas();
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas indisponible');

      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, mime, quality)
      );
      if (!blob) throw new Error('Échec de l’export');

      const url = URL.createObjectURL(blob);
      const name = `${doc.name || 'export'}.${format === 'jpeg' ? 'jpg' : format}`;

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();

      // Media library
      addMediaAsset({
        kind: 'image',
        name,
        src: url,
        duration: 5,
        width: doc.width,
        height: doc.height,
        mimeType: mime,
        sizeBytes: blob.size,
        thumbnail: url,
      });

      if (sendToTimeline) {
        addClip({
          type: 'image',
          name,
          start: currentTime,
          duration: 5,
          trimStart: 0,
          src: url,
          sourceDuration: 5,
          track: 1,
          volume: 1,
        } as any);
        setView('editor');
        notify({ type: 'success', title: 'Image ajoutée à la timeline' });
      } else {
        notify({ type: 'success', title: `Export ${format.toUpperCase()} réussi` });
      }
      setExportOpen(false);
    } catch (err: any) {
      notify({ type: 'error', title: 'Export échoué', message: String(err.message || err) });
    } finally {
      setIsRendering(false);
    }
  };

  // ——— Interaction (simple select + move) ———
  const dragState = useRef<{
    mode: 'move' | 'none';
    startX: number;
    startY: number;
    origTransforms: Map<string, { x: number; y: number }>;
  } | null>(null);

  const canvasToDoc = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    return { x, y };
  };

  const hitTest = (x: number, y: number): string | null => {
    const layers = [...doc.layers].sort((a, b) => b.zIndex - a.zIndex);
    for (const l of layers) {
      if (!l.visible || l.locked) continue;
      const t = l.transform;
      // Simple AABB (ignore rotation for hit for simplicity)
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
        return l.id;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (activeTool !== 'select' && activeTool !== 'move') return;
    const { x, y } = canvasToDoc(e.clientX, e.clientY);
    const hit = hitTest(x, y);
    if (hit) {
      if (!e.shiftKey) selectLayers([hit]);
      else {
        const next = selectedLayerIds.includes(hit)
          ? selectedLayerIds.filter((id) => id !== hit)
          : [...selectedLayerIds, hit];
        selectLayers(next);
      }
      const ids = e.shiftKey ? (selectedLayerIds.includes(hit) ? selectedLayerIds : [...selectedLayerIds, hit]) : [hit];
      const orig = new Map<string, { x: number; y: number }>();
      ids.forEach((id) => {
        const l = doc.layers.find((ll) => ll.id === id);
        if (l) orig.set(id, { x: l.transform.x, y: l.transform.y });
      });
      dragState.current = { mode: 'move', startX: x, startY: y, origTransforms: orig };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      clearSelection();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current || dragState.current.mode !== 'move') return;
    const { x, y } = canvasToDoc(e.clientX, e.clientY);
    const dx = x - dragState.current.startX;
    const dy = y - dragState.current.startY;
    dragState.current.origTransforms.forEach((orig, id) => {
      updateLayerTransform(id, { x: orig.x + dx, y: orig.y + dy });
    });
  };

  const onPointerUp = () => {
    if (dragState.current?.mode === 'move') {
      commit('Déplacer calque(s)');
    }
    dragState.current = null;
  };

  // ——— UI helpers ———
  const adj = primary?.adjustments || DEFAULT_ADJUSTMENTS;

  const setAdj = (key: keyof ColorAdjustments, value: number) => {
    if (!primary) return;
    updateLayerAdjustments(primary.id, { [key]: value });
  };

  const commitAdj = () => commit('Réglages couleur');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Top toolbar */}
      <div
        className="flex items-center gap-1"
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        <ToolBtn icon={<Upload size={16} />} label="Importer" onClick={() => fileInputRef.current?.click()} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
          multiple
          hidden
          onChange={(e) => e.target.files && handleImportFiles(e.target.files)}
        />
        <ToolBtn icon={<FolderOpen size={16} />} label="Nouveau" onClick={() => newDocument()} />
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn icon={<Undo2 size={16} />} label="Annuler" onClick={undo} disabled={!canUndo()} />
        <ToolBtn icon={<Redo2 size={16} />} label="Rétablir" onClick={redo} disabled={!canRedo()} />
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn
          icon={<MousePointer2 size={16} />}
          label="Sélection"
          active={activeTool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolBtn
          icon={<Move size={16} />}
          label="Déplacer"
          active={activeTool === 'move'}
          onClick={() => setTool('move')}
        />
        <ToolBtn
          icon={<Crop size={16} />}
          label="Recadrer"
          active={activeTool === 'crop'}
          onClick={() => setTool('crop')}
        />
        <ToolBtn
          icon={<RotateCw size={16} />}
          label="Rotation"
          active={activeTool === 'rotate'}
          onClick={() => {
            if (primary) {
              updateLayerTransform(primary.id, {
                rotation: (primary.transform.rotation + 90) % 360,
              });
              commit('Rotation 90°');
            }
          }}
        />
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn icon={<Type size={16} />} label="Texte" onClick={() => { setTool('text'); addTextLayer(); }} />
        <ToolBtn icon={<Square size={16} />} label="Rectangle" onClick={() => addShapeLayer('rect')} />
        <ToolBtn icon={<Circle size={16} />} label="Ellipse" onClick={() => addShapeLayer('ellipse')} />
        <ToolBtn icon={<Star size={16} />} label="Étoile" onClick={() => addShapeLayer('star')} />
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <ToolBtn icon={<ZoomOut size={16} />} label="Zoom −" onClick={zoomOut} />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <ToolBtn icon={<ZoomIn size={16} />} label="Zoom +" onClick={zoomIn} />
        <ToolBtn
          icon={<Maximize2 size={16} />}
          label="Ajuster"
          onClick={() =>
            containerRef.current &&
            zoomToFit(containerRef.current.clientWidth, containerRef.current.clientHeight)
          }
        />
        <ToolBtn icon={<Grid3X3 size={16} />} label="Grille" active={showGrid} onClick={toggleGrid} />
        <div style={{ flex: 1 }} />
        <ToolBtn
          icon={<Film size={16} />}
          label="Vers timeline"
          onClick={() => exportImage('png', 1, true)}
        />
        <ToolBtn
          icon={<Download size={16} />}
          label="Exporter"
          onClick={() => setExportOpen(true)}
          primary
        />
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left – tools / stickers */}
        <div
          style={{
            width: 72,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0',
            gap: 4,
            overflowY: 'auto',
          }}
        >
          <SideIcon icon={<ImageIcon size={18} />} title="Importer" onClick={() => fileInputRef.current?.click()} />
          <SideIcon icon={<Type size={18} />} title="Texte" onClick={() => addTextLayer()} />
          <SideIcon icon={<Square size={18} />} title="Formes" onClick={() => addShapeLayer('rect')} />
          <SideIcon icon={<Sparkles size={18} />} title="Stickers" onClick={() => {}} />
          <div style={{ height: 1, width: 32, background: 'var(--border)', margin: '6px 0' }} />
          {STICKERS.slice(0, 8).map((s) => (
            <button
              key={s.id}
              title={s.name}
              onClick={() => addStickerLayer(s.content, s.name, true)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                fontSize: 22,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.content}
            </button>
          ))}
        </div>

        {/* Center – canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: dragOver ? 'var(--accent-muted)' : 'var(--bg-tertiary)',
            position: 'relative',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 2,
              lineHeight: 0,
            }}
          >
            <canvas
              ref={canvasRef}
              width={doc.width}
              height={doc.height}
              style={{
                display: 'block',
                cursor: activeTool === 'select' || activeTool === 'move' ? 'default' : 'crosshair',
                maxWidth: 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </div>
          {dragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(79,140,255,0.15)',
                border: '2px dashed var(--accent)',
                pointerEvents: 'none',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              Déposez vos images ici
            </div>
          )}
        </div>

        {/* Right panel */}
        <div
          style={{
            width: 300,
            borderLeft: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            {(
              [
                { id: 'properties', label: 'Propriétés', icon: <Settings2 size={14} /> },
                { id: 'filters', label: 'Filtres', icon: <Wand2 size={14} /> },
                { id: 'layers', label: 'Calques', icon: <Layers size={14} /> },
                { id: 'history', label: 'Historique', icon: <Undo2 size={14} /> },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  background: rightTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                  color: rightTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {rightTab === 'properties' && (
              <PropertiesPanel
                primary={primary}
                doc={doc}
                adj={adj}
                setAdj={setAdj}
                commitAdj={commitAdj}
                updateLayer={updateLayer}
                updateLayerTransform={updateLayerTransform}
                setDocumentName={setDocumentName}
                setCanvasSize={setCanvasSize}
                setBackground={setBackground}
                commit={commit}
              />
            )}
            {rightTab === 'filters' && (
              <FiltersPanel
                primary={primary}
                setLayerFilter={setLayerFilter}
                commit={commit}
              />
            )}
            {rightTab === 'layers' && (
              <LayersPanel
                layers={doc.layers}
                selectedLayerIds={selectedLayerIds}
                selectLayers={selectLayers}
                setLayerVisibility={setLayerVisibility}
                setLayerLocked={setLayerLocked}
                reorderLayer={reorderLayer}
                removeLayers={removeLayers}
                duplicateLayers={duplicateLayers}
              />
            )}
            {rightTab === 'history' && (
              <HistoryPanel history={history} historyIndex={historyIndex} />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center gap-3"
        style={{
          padding: '4px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        <span>
          {doc.width} × {doc.height} px
        </span>
        <span>•</span>
        <span>{doc.layers.length} calque(s)</span>
        {isDirty && (
          <>
            <span>•</span>
            <span style={{ color: 'var(--warning)' }}>Non enregistré</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <span>{doc.name}</span>
      </div>

      {/* Export modal */}
      {exportOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setExportOpen(false)}
        >
          <div
            className="card"
            style={{ width: 380, padding: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Exporter l’image</h3>
            <div style={{ marginBottom: 12 }}>
              <label className="text-secondary" style={{ fontSize: 12 }}>Format</label>
              <div className="flex gap-2" style={{ marginTop: 6 }}>
                {(['png', 'jpg', 'webp'] as ExportFormat[]).map((f) => (
                  <button
                    key={f}
                    className={`btn ${exportFormat === f ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, textTransform: 'uppercase' }}
                    onClick={() => setExportFormat(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            {(exportFormat === 'jpg' || exportFormat === 'webp') && (
              <div style={{ marginBottom: 12 }}>
                <label className="text-secondary" style={{ fontSize: 12 }}>
                  Qualité : {Math.round(exportQuality * 100)}%
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={exportQuality}
                  onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
            )}
            <div className="flex gap-2" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setExportOpen(false)}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isRendering}
                onClick={() => exportImage(exportFormat, exportQuality, false)}
              >
                {isRendering ? 'Export…' : 'Télécharger'}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isRendering}
                onClick={() => exportImage(exportFormat, exportQuality, true)}
              >
                Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Sub-components ———

function ToolBtn({
  icon,
  label,
  onClick,
  active,
  disabled,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={primary ? 'btn btn-primary' : 'btn btn-ghost'}
      style={{
        padding: '6px 8px',
        opacity: disabled ? 0.4 : 1,
        background: active ? 'var(--accent-muted)' : primary ? undefined : 'transparent',
        color: active ? 'var(--accent)' : undefined,
        border: active ? '1px solid var(--accent)' : undefined,
      }}
    >
      {icon}
    </button>
  );
}

function SideIcon({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}

function PropertiesPanel({
  primary,
  doc,
  adj,
  setAdj,
  commitAdj,
  updateLayer,
  updateLayerTransform,
  setDocumentName,
  setCanvasSize,
  setBackground,
  commit,
}: any) {
  return (
    <div>
      <Section title="Document">
        <Field label="Nom">
          <input
            className="input"
            value={doc.name}
            onChange={(e) => setDocumentName(e.target.value)}
            onBlur={() => commit('Renommer')}
          />
        </Field>
        <div className="flex gap-2">
          <Field label="Largeur">
            <input
              className="input"
              type="number"
              value={doc.width}
              onChange={(e) => setCanvasSize(parseInt(e.target.value) || 1, doc.height)}
            />
          </Field>
          <Field label="Hauteur">
            <input
              className="input"
              type="number"
              value={doc.height}
              onChange={(e) => setCanvasSize(doc.width, parseInt(e.target.value) || 1)}
            />
          </Field>
        </div>
        <Field label="Fond">
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={doc.background === 'transparent' ? '#1a1e26' : doc.background}
              onChange={(e) => setBackground(e.target.value)}
              style={{ width: 32, height: 28, border: 'none', background: 'none' }}
            />
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setBackground('transparent')}>
              Transparent
            </button>
          </div>
        </Field>
        <div style={{ marginTop: 8 }}>
          <div className="text-secondary" style={{ fontSize: 11, marginBottom: 4 }}>Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {CANVAS_PRESETS.map((p) => (
              <button
                key={p.name}
                className="btn btn-ghost"
                style={{ fontSize: 10, padding: '4px 6px' }}
                onClick={() => setCanvasSize(p.w, p.h)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {primary ? (
        <>
          <Section title="Calque sélectionné">
            <Field label="Nom">
              <input
                className="input"
                value={primary.name}
                onChange={(e) => updateLayer(primary.id, { name: e.target.value })}
              />
            </Field>
            <Field label="Opacité">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={primary.transform.opacity}
                onChange={(e) =>
                  updateLayerTransform(primary.id, { opacity: parseFloat(e.target.value) })
                }
                onMouseUp={commitAdj}
                style={{ width: '100%' }}
              />
            </Field>
            <div className="flex gap-2">
              <Field label="X">
                <input
                  className="input"
                  type="number"
                  value={Math.round(primary.transform.x)}
                  onChange={(e) =>
                    updateLayerTransform(primary.id, { x: parseInt(e.target.value) || 0 })
                  }
                />
              </Field>
              <Field label="Y">
                <input
                  className="input"
                  type="number"
                  value={Math.round(primary.transform.y)}
                  onChange={(e) =>
                    updateLayerTransform(primary.id, { y: parseInt(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Field label="Largeur">
                <input
                  className="input"
                  type="number"
                  value={Math.round(primary.transform.width)}
                  onChange={(e) =>
                    updateLayerTransform(primary.id, { width: parseInt(e.target.value) || 1 })
                  }
                />
              </Field>
              <Field label="Hauteur">
                <input
                  className="input"
                  type="number"
                  value={Math.round(primary.transform.height)}
                  onChange={(e) =>
                    updateLayerTransform(primary.id, { height: parseInt(e.target.value) || 1 })
                  }
                />
              </Field>
            </div>
            <Field label="Rotation">
              <input
                type="range"
                min={-180}
                max={180}
                value={primary.transform.rotation}
                onChange={(e) =>
                  updateLayerTransform(primary.id, { rotation: parseInt(e.target.value) })
                }
                onMouseUp={() => commit('Rotation')}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: 11 }}>{Math.round(primary.transform.rotation)}°</span>
            </Field>
          </Section>

          {primary.type === 'image' && (
            <Section title="Réglages couleur">
              <Slider label="Luminosité" icon={<Sun size={12} />} value={adj.brightness} min={-100} max={100} onChange={(v) => setAdj('brightness', v)} onCommit={commitAdj} />
              <Slider label="Contraste" icon={<Contrast size={12} />} value={adj.contrast} min={-100} max={100} onChange={(v) => setAdj('contrast', v)} onCommit={commitAdj} />
              <Slider label="Saturation" icon={<Droplets size={12} />} value={adj.saturation} min={-100} max={100} onChange={(v) => setAdj('saturation', v)} onCommit={commitAdj} />
              <Slider label="Exposition" value={adj.exposure} min={-2} max={2} step={0.05} onChange={(v) => setAdj('exposure', v)} onCommit={commitAdj} />
              <Slider label="Température" icon={<Thermometer size={12} />} value={adj.temperature} min={-100} max={100} onChange={(v) => setAdj('temperature', v)} onCommit={commitAdj} />
              <Slider label="Teinte" icon={<Palette size={12} />} value={adj.tint} min={-100} max={100} onChange={(v) => setAdj('tint', v)} onCommit={commitAdj} />
              <Slider label="Vibrance" value={adj.vibrance} min={-100} max={100} onChange={(v) => setAdj('vibrance', v)} onCommit={commitAdj} />
              <Slider label="Teinte (Hue)" value={adj.hue} min={-180} max={180} onChange={(v) => setAdj('hue', v)} onCommit={commitAdj} />
              <button
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8, fontSize: 12 }}
                onClick={() => {
                  updateLayer(primary.id, { adjustments: { ...DEFAULT_ADJUSTMENTS } });
                  commit('Réinitialiser réglages');
                }}
              >
                Réinitialiser
              </button>
            </Section>
          )}

          {primary.type === 'text' && primary.textStyle && (
            <Section title="Texte">
              <Field label="Contenu">
                <textarea
                  className="input"
                  rows={2}
                  value={primary.text || ''}
                  onChange={(e) => updateLayer(primary.id, { text: e.target.value })}
                  onBlur={() => commit('Modifier texte')}
                />
              </Field>
              <Field label="Taille">
                <input
                  type="range"
                  min={8}
                  max={200}
                  value={primary.textStyle.fontSize}
                  onChange={(e) =>
                    updateLayer(primary.id, {
                      textStyle: { ...primary.textStyle!, fontSize: parseInt(e.target.value) },
                    })
                  }
                  style={{ width: '100%' }}
                />
              </Field>
              <Field label="Couleur">
                <input
                  type="color"
                  value={primary.textStyle.color}
                  onChange={(e) =>
                    updateLayer(primary.id, {
                      textStyle: { ...primary.textStyle!, color: e.target.value },
                    })
                  }
                />
              </Field>
            </Section>
          )}

          {primary.type === 'shape' && primary.shapeStyle && (
            <Section title="Forme">
              <Field label="Remplissage">
                <input
                  type="color"
                  value={primary.shapeStyle.fill}
                  onChange={(e) =>
                    updateLayer(primary.id, {
                      shapeStyle: { ...primary.shapeStyle!, fill: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Contour">
                <input
                  type="color"
                  value={primary.shapeStyle.stroke}
                  onChange={(e) =>
                    updateLayer(primary.id, {
                      shapeStyle: { ...primary.shapeStyle!, stroke: e.target.value },
                    })
                  }
                />
              </Field>
            </Section>
          )}
        </>
      ) : (
        <p className="text-secondary" style={{ fontSize: 12, marginTop: 12 }}>
          Sélectionnez un calque pour voir ses propriétés.
        </p>
      )}
    </div>
  );
}

function FiltersPanel({ primary, setLayerFilter, commit }: any) {
  if (!primary || primary.type !== 'image') {
    return (
      <p className="text-secondary" style={{ fontSize: 12 }}>
        Sélectionnez un calque image pour appliquer des filtres.
      </p>
    );
  }
  return (
    <div>
      {FILTER_CATEGORIES.map((cat) => (
        <div key={cat.id} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {cat.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {FILTER_PRESETS.filter((f) => f.category === cat.id).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setLayerFilter(primary.id, f.id === 'none' ? null : f.id);
                }}
                style={{
                  padding: '8px 6px',
                  borderRadius: 6,
                  border:
                    primary.filterId === f.id || (!primary.filterId && f.id === 'none')
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  background:
                    primary.filterId === f.id || (!primary.filterId && f.id === 'none')
                      ? 'var(--accent-muted)'
                      : 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LayersPanel({
  layers,
  selectedLayerIds,
  selectLayers,
  setLayerVisibility,
  setLayerLocked,
  reorderLayer,
  removeLayers,
  duplicateLayers,
}: any) {
  const sorted = [...layers].sort((a: GraphicsLayer, b: GraphicsLayer) => b.zIndex - a.zIndex);
  return (
    <div>
      {sorted.length === 0 && (
        <p className="text-secondary" style={{ fontSize: 12 }}>Aucun calque</p>
      )}
      {sorted.map((layer: GraphicsLayer) => (
        <div
          key={layer.id}
          onClick={() => selectLayers([layer.id])}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 6,
            marginBottom: 2,
            background: selectedLayerIds.includes(layer.id) ? 'var(--accent-muted)' : 'transparent',
            cursor: 'pointer',
            border: selectedLayerIds.includes(layer.id) ? '1px solid var(--accent)' : '1px solid transparent',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerVisibility(layer.id, !layer.visible);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
          >
            {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerLocked(layer.id, !layer.locked);
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
          >
            {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {layer.name}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              reorderLayer(layer.id, 'up');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              reorderLayer(layer.id, 'down');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      ))}
      {selectedLayerIds.length > 0 && (
        <div className="flex gap-1" style={{ marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} onClick={() => duplicateLayers(selectedLayerIds)}>
            <Copy size={12} /> Dupliquer
          </button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, color: 'var(--danger)' }} onClick={() => removeLayers(selectedLayerIds)}>
            <Trash2 size={12} /> Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ history, historyIndex }: { history: any[]; historyIndex: number }) {
  return (
    <div>
      {history.length === 0 && <p className="text-secondary" style={{ fontSize: 12 }}>Aucun historique</p>}
      {[...history].reverse().map((h, i) => {
        const realIdx = history.length - 1 - i;
        return (
          <div
            key={h.id}
            style={{
              padding: '6px 8px',
              fontSize: 12,
              borderRadius: 4,
              marginBottom: 2,
              background: realIdx === historyIndex ? 'var(--accent-muted)' : 'transparent',
              color: realIdx === historyIndex ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {h.label}
            <div style={{ fontSize: 10, opacity: 0.7 }}>
              {new Date(h.timestamp).toLocaleTimeString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function Slider({
  label,
  icon,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: {
  label: string;
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}
