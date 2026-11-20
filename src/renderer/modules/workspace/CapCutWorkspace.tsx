import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, Trash2, ZoomIn, ZoomOut,
  Type, Film, Magnet, FolderOpen, Copy, Image as ImageIcon, Music,
  ChevronLeft, ChevronRight, Upload, Sparkles, Blend, Subtitles,
  Volume2, Filter,
} from 'lucide-react';
import { useProjectStore, type Clip, type TransitionType, type ClipEffects } from '../../stores/projectStore';
import { useMediaLibraryStore, type MediaAsset } from '../../stores/mediaLibraryStore';
import { useKeyboardShortcuts, EDITOR_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

type LibTab = 'media' | 'audio' | 'text' | 'effects' | 'transitions' | 'filters';

const TRACKS = [
  { id: 0, label: 'V1' },
  { id: 1, label: 'V2' },
  { id: 2, label: 'A1' },
  { id: 4, label: 'A2' },
  { id: 3, label: 'T1' },
];

const TRANSITIONS: { id: TransitionType; name: string; icon: string }[] = [
  { id: 'none', name: 'Aucune', icon: '·' },
  { id: 'fade', name: 'Fondu', icon: '◑' },
  { id: 'crossfade', name: 'Crossfade', icon: '⇄' },
  { id: 'dissolve', name: 'Dissolve', icon: '✧' },
  { id: 'slide-left', name: 'Glissement ←', icon: '←' },
  { id: 'slide-right', name: 'Glissement →', icon: '→' },
  { id: 'slide-up', name: 'Glissement ↑', icon: '↑' },
  { id: 'zoom-in', name: 'Zoom avant', icon: '＋' },
  { id: 'zoom-out', name: 'Zoom arrière', icon: '－' },
  { id: 'wipe', name: 'Balayage', icon: '▮' },
  { id: 'flash', name: 'Flash', icon: '⚡' },
];

const TEXT_FONTS = [
  'Inter, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Impact, sans-serif',
  'Comic Sans MS, cursive',
  'Arial Black, sans-serif',
  'Times New Roman, serif',
  'Verdana, sans-serif',
];

const TEXT_PRESETS: {
  name: string;
  text: string;
  textStyle: NonNullable<Clip['textStyle']>;
  fadeIn?: number;
  fadeOut?: number;
}[] = [
  {
    name: 'Titre blanc',
    text: 'Titre principal',
    textStyle: { fontSize: 56, color: '#ffffff', fontFamily: 'Inter, sans-serif', backgroundColor: 'rgba(0,0,0,0.55)' },
    fadeIn: 0.3, fadeOut: 0.3,
  },
  {
    name: 'Sous-titre',
    text: 'Sous-titre élégant',
    textStyle: { fontSize: 32, color: '#e6edf3', fontFamily: 'Georgia, serif', backgroundColor: 'rgba(0,0,0,0.4)' },
  },
  {
    name: 'Impact',
    text: 'ATTENTION',
    textStyle: { fontSize: 64, color: '#ffcc00', fontFamily: 'Impact, sans-serif', backgroundColor: 'transparent' },
  },
  {
    name: 'Code / tech',
    text: 'console.log("hello")',
    textStyle: { fontSize: 28, color: '#3fb950', fontFamily: 'Courier New, monospace', backgroundColor: 'rgba(13,17,23,0.85)' },
  },
  {
    name: 'Minimal',
    text: 'Simple & clean',
    textStyle: { fontSize: 40, color: '#58a6ff', fontFamily: 'Inter, sans-serif', backgroundColor: 'transparent' },
  },
  {
    name: 'Cinéma',
    text: 'UNE HISTOIRE',
    textStyle: { fontSize: 48, color: '#ffffff', fontFamily: 'Times New Roman, serif', backgroundColor: 'rgba(0,0,0,0.7)' },
  },
  {
    name: 'Fun',
    text: 'C\'est parti !',
    textStyle: { fontSize: 44, color: '#ff7b72', fontFamily: 'Comic Sans MS, cursive', backgroundColor: 'rgba(0,0,0,0.35)' },
  },
  {
    name: 'Badge',
    text: 'NOUVEAU',
    textStyle: { fontSize: 28, color: '#0d1117', fontFamily: 'Arial Black, sans-serif', backgroundColor: '#58a6ff' },
  },
];

const FILTER_PRESETS = [
  { name: 'Normal', brightness: 0, contrast: 0, saturation: 0 },
  { name: 'Vif', brightness: 0.05, contrast: 0.15, saturation: 0.25 },
  { name: 'Cinéma', brightness: -0.05, contrast: 0.2, saturation: -0.1 },
  { name: 'N&B', brightness: 0, contrast: 0.1, saturation: -1 },
  { name: 'Chaud', brightness: 0.08, contrast: 0.05, saturation: 0.15 },
  { name: 'Froid', brightness: 0, contrast: 0.05, saturation: -0.2 },
];

const EFFECT_PRESETS: { name: string; effects: Partial<ClipEffects> }[] = [
  { name: 'Zoom 1.25×', effects: { scale: 1.25 } },
  { name: 'Zoom 1.5×', effects: { scale: 1.5 } },
  { name: 'Flou léger', effects: { blur: 4 } },
  { name: 'Flou fort', effects: { blur: 10 } },
  { name: 'Transparent 70%', effects: { opacity: 0.7 } },
  { name: 'Mosaïque centre', effects: { mosaicRegions: [{ x: 0.3, y: 0.3, w: 0.4, h: 0.2 }] } },
];

type DragPayload =
  | { type: 'transition'; value: TransitionType }
  | { type: 'filter'; brightness: number; contrast: number; saturation: number }
  | { type: 'effect'; effects: Partial<ClipEffects> }
  | { type: 'media'; assetId: string };

function tc(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}

export function CapCutWorkspace() {
  const {
    clips, currentTime, duration, isPlaying, selectedClipId, zoom, snapEnabled,
    setCurrentTime, setIsPlaying, setSelectedClipId, setZoom, setSnapEnabled,
    splitClip, removeClip, updateClip, updateEffects, addClip, duplicateClip,
  } = useProjectStore();
  const { assets, addAsset } = useMediaLibraryStore();

  const [libTab, setLibTab] = useState<LibTab>('media');
  const [textDraft, setTextDraft] = useState('Votre titre');
  const [textFont, setTextFont] = useState(TEXT_FONTS[0]);
  const [textSize, setTextSize] = useState(48);
  const [textColor, setTextColor] = useState('#ffffff');
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadDrag = useRef(false);
  const clipDrag = useRef<{ id: string; startX: number; orig: number } | null>(null);
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;

  const selected = clips.find((c) => c.id === selectedClipId);

  // ——— Live preview with effects on canvas ———
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      const active = clips.find(
        (c) => c.type === 'video' && timeRef.current >= c.start && timeRef.current < c.start + c.duration
      );

      if (active && video.readyState >= 2) {
        const fx = active.effects;
        const scale = fx?.scale || 1;
        let fadeMul = 1;
        const rel = timeRef.current - active.start;
        if (active.fadeIn > 0 && rel < active.fadeIn) fadeMul = rel / active.fadeIn;
        if (active.fadeOut > 0 && rel > active.duration - active.fadeOut) {
          fadeMul = Math.min(fadeMul, (active.duration - rel) / active.fadeOut);
        }

        const vw = video.videoWidth || w;
        const vh = video.videoHeight || h;
        const base = Math.min(w / vw, h / vh) * scale;
        const dw = vw * base;
        const dh = vh * base;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;

        ctx.save();
        ctx.globalAlpha = (fx?.opacity ?? 1) * fadeMul;
        if (fx?.blur > 0) ctx.filter = `blur(${fx.blur}px)`;
        ctx.drawImage(video, dx, dy, dw, dh);
        ctx.filter = 'none';
        ctx.restore();

        // Color grade
        if (fx && (fx.brightness || fx.contrast || fx.saturation)) {
          try {
            const img = ctx.getImageData(0, 0, w, h);
            const d = img.data;
            const b = fx.brightness * 255;
            const c = fx.contrast + 1;
            const s = fx.saturation + 1;
            for (let i = 0; i < d.length; i += 4) {
              let r = d[i] + b;
              let g = d[i + 1] + b;
              let bl = d[i + 2] + b;
              r = (r - 128) * c + 128;
              g = (g - 128) * c + 128;
              bl = (bl - 128) * c + 128;
              const gray = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
              d[i] = Math.max(0, Math.min(255, gray + (r - gray) * s));
              d[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * s));
              d[i + 2] = Math.max(0, Math.min(255, gray + (bl - gray) * s));
            }
            ctx.putImageData(img, 0, 0);
          } catch { /* security / size */ }
        }

        // Mosaic
        if (fx?.mosaicRegions?.length) {
          const block = 12;
          for (const region of fx.mosaicRegions) {
            const rx = Math.floor(region.x * w);
            const ry = Math.floor(region.y * h);
            const rw = Math.floor(region.w * w);
            const rh = Math.floor(region.h * h);
            for (let y = ry; y < ry + rh; y += block) {
              for (let x = rx; x < rx + rw; x += block) {
                try {
                  const sample = ctx.getImageData(x, y, 1, 1).data;
                  ctx.fillStyle = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
                  ctx.fillRect(x, y, Math.min(block, rx + rw - x), Math.min(block, ry + rh - y));
                } catch { /* */ }
              }
            }
          }
        }
      }

      // Text overlays
      for (const t of clips) {
        if (t.type !== 'text') continue;
        if (timeRef.current < t.start || timeRef.current >= t.start + t.duration) continue;
        const style = t.textStyle || { fontSize: 48, color: '#fff', fontFamily: 'Inter', backgroundColor: 'rgba(0,0,0,0.5)' };
        let fadeMul = 1;
        const rel = timeRef.current - t.start;
        if (t.fadeIn > 0 && rel < t.fadeIn) fadeMul = rel / t.fadeIn;
        if (t.fadeOut > 0 && rel > t.duration - t.fadeOut) fadeMul = Math.min(fadeMul, (t.duration - rel) / t.fadeOut);
        ctx.save();
        ctx.globalAlpha = fadeMul;
        const fontSize = Math.max(14, (style.fontSize || 48) * (w / 900));
        ctx.font = `600 ${fontSize}px ${style.fontFamily || 'Inter, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = t.text || '';
        const metrics = ctx.measureText(text);
        const tx = w / 2;
        const ty = h * 0.88;
        if (style.backgroundColor) {
          ctx.fillStyle = style.backgroundColor;
          const bw = metrics.width + 24;
          const bh = fontSize + 16;
          ctx.beginPath();
          ctx.roundRect(tx - bw / 2, ty - bh / 2, bw, bh, 6);
          ctx.fill();
        }
        ctx.fillStyle = style.color || '#fff';
        ctx.fillText(text, tx, ty);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [clips]);

  // Sync hidden video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const active = clips.find(
      (c) => c.type === 'video' && currentTime >= c.start && currentTime < c.start + c.duration
    );
    if (active) {
      if (video.src !== active.src) {
        video.src = active.src;
        video.load();
      }
      const local = currentTime - active.start + active.trimStart;
      if (Math.abs(video.currentTime - local) > 0.12) video.currentTime = local;
      if (isPlaying && video.paused) video.play().catch(() => {});
      if (!isPlaying && !video.paused) video.pause();
    } else if (!video.paused) video.pause();
  }, [currentTime, isPlaying, clips]);

  // Playback clock
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = timeRef.current + dt;
      if (next >= duration && duration > 0) {
        setIsPlaying(false);
        setCurrentTime(duration);
      } else setCurrentTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration, setIsPlaying, setCurrentTime]);

  // Resize canvas to stage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(180, Math.floor(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const importFiles = async (accept: string, kind: 'video' | 'audio' | 'image') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      for (const file of Array.from(input.files)) {
        const url = URL.createObjectURL(file);
        let duration = 5;
        if (kind !== 'image') {
          const el = document.createElement(kind === 'audio' ? 'audio' : 'video');
          el.src = url;
          el.preload = 'metadata';
          await new Promise<void>((r) => {
            el.onloadedmetadata = () => r();
            el.onerror = () => r();
            setTimeout(r, 3000);
          });
          if (isFinite(el.duration) && el.duration > 0) duration = el.duration;
        }
        addAsset({ kind, name: file.name, src: url, duration });
      }
    };
    input.click();
  };

  const addAssetToTimeline = (asset: MediaAsset, track?: number) => {
    const t = track ?? (asset.kind === 'audio' ? 2 : asset.kind === 'image' ? 1 : 0);
    addClip({
      type: asset.kind === 'image' ? 'image' : asset.kind,
      name: asset.name,
      start: currentTime,
      duration: asset.duration,
      trimStart: 0,
      src: asset.src,
      sourceDuration: asset.duration,
      track: t,
      volume: asset.kind === 'audio' ? 0.8 : 1,
    });
  };

  const addTextClip = () => {
    addClip({
      type: 'text',
      name: textDraft.slice(0, 24),
      start: currentTime,
      duration: 3,
      trimStart: 0,
      src: '',
      sourceDuration: 3,
      track: 3,
      volume: 1,
      text: textDraft,
      textStyle: {
        fontSize: 52,
        color: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: 'rgba(0,0,0,0.5)',
      },
      fadeIn: 0.25,
      fadeOut: 0.25,
    });
  };

  // ——— Drag & drop ———
  const onDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData('application/screenstudio', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const applyPayloadToClip = (clipId: string, payload: DragPayload) => {
    setSelectedClipId(clipId);
    if (payload.type === 'transition') {
      const clip = clips.find((c) => c.id === clipId);
      if (!clip) return;
      // Transition de sortie sur ce clip + entrée sur le suivant de la même piste
      updateClip(clipId, {
        transitionOut: payload.value,
        fadeOut: payload.value === 'none' ? 0 : 0.6,
      });
      const next = clips
        .filter((c) => c.track === clip.track && c.start >= clip.start + clip.duration - 0.05)
        .sort((a, b) => a.start - b.start)[0];
      if (next) {
        updateClip(next.id, {
          transitionIn: payload.value,
          fadeIn: payload.value === 'none' ? 0 : 0.6,
        });
      } else {
        // Pas de suivant : transition d'entrée aussi
        updateClip(clipId, {
          transitionIn: payload.value,
          fadeIn: payload.value === 'none' ? 0 : 0.6,
        });
      }
    } else if (payload.type === 'filter') {
      updateEffects(clipId, {
        brightness: payload.brightness,
        contrast: payload.contrast,
        saturation: payload.saturation,
      });
    } else if (payload.type === 'effect') {
      updateEffects(clipId, payload.effects);
    } else if (payload.type === 'media') {
      const asset = assets.find((a) => a.id === payload.assetId);
      if (asset) addAssetToTimeline(asset);
    }
  };

  const onClipDragOver = (e: React.DragEvent, clipId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverClipId(clipId);
  };

  const onClipDrop = (e: React.DragEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverClipId(null);
    try {
      const raw = e.dataTransfer.getData('application/screenstudio');
      if (!raw) return;
      const payload = JSON.parse(raw) as DragPayload;
      applyPayloadToClip(clipId, payload);
    } catch { /* */ }
  };

  const onTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverClipId(null);
    try {
      const raw = e.dataTransfer.getData('application/screenstudio');
      if (!raw) return;
      const payload = JSON.parse(raw) as DragPayload;
      if (payload.type === 'media') {
        const asset = assets.find((a) => a.id === payload.assetId);
        if (asset) addAssetToTimeline(asset);
        return;
      }
      // Apply to selected or first video clip under playhead
      const target =
        selectedClipId ||
        clips.find(
          (c) =>
            c.type === 'video' &&
            currentTime >= c.start &&
            currentTime < c.start + c.duration
        )?.id;
      if (target) applyPayloadToClip(target, payload);
    } catch { /* */ }
  };

  // Timeline interactions
  const onTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    setCurrentTime(Math.max(0, x / zoom));
  };

  const onPlayheadDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    playheadDrag.current = true;
    const move = (ev: MouseEvent) => {
      if (!timelineRef.current || !playheadDrag.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      setCurrentTime(Math.max(0, (ev.clientX - rect.left + timelineRef.current.scrollLeft) / zoom));
    };
    const up = () => {
      playheadDrag.current = false;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onClipDown = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    clipDrag.current = { id: clip.id, startX: e.clientX, orig: clip.start };
    const move = (ev: MouseEvent) => {
      if (!clipDrag.current) return;
      let s = clipDrag.current.orig + (ev.clientX - clipDrag.current.startX) / zoom;
      if (snapEnabled) s = Math.round(s * 10) / 10;
      updateClip(clipDrag.current.id, { start: Math.max(0, s) });
    };
    const up = () => {
      clipDrag.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleSplit = useCallback(() => {
    if (selectedClipId) splitClip(selectedClipId, currentTime);
  }, [selectedClipId, currentTime, splitClip]);
  const handleDelete = useCallback(() => {
    if (selectedClipId) removeClip(selectedClipId);
  }, [selectedClipId, removeClip]);

  useKeyboardShortcuts(
    useMemo(
      () => [
        { ...EDITOR_SHORTCUTS.playPause, handler: () => setIsPlaying(!isPlaying) },
        { ...EDITOR_SHORTCUTS.split, handler: handleSplit },
        { ...EDITOR_SHORTCUTS.delete, handler: handleDelete },
        { ...EDITOR_SHORTCUTS.deleteBackspace, handler: handleDelete },
        { ...EDITOR_SHORTCUTS.zoomIn, handler: () => setZoom(zoom + 15) },
        { ...EDITOR_SHORTCUTS.zoomOut, handler: () => setZoom(zoom - 15) },
      ],
      [isPlaying, handleSplit, handleDelete, zoom, setIsPlaying, setZoom]
    ),
    true
  );

  const timelineWidth = Math.max(duration * zoom + 300, 1000);
  const mediaAssets = assets.filter((a) => a.kind === 'video' || a.kind === 'image');
  const audioAssets = assets.filter((a) => a.kind === 'audio');

  const tabs: { id: LibTab; label: string; icon: React.ReactNode }[] = [
    { id: 'media', label: 'Médias', icon: <Film size={14} /> },
    { id: 'audio', label: 'Son', icon: <Volume2 size={14} /> },
    { id: 'text', label: 'Texte', icon: <Type size={14} /> },
    { id: 'effects', label: 'Effets', icon: <Sparkles size={14} /> },
    { id: 'transitions', label: 'Transitions', icon: <Blend size={14} /> },
    { id: 'filters', label: 'Filtres', icon: <Filter size={14} /> },
  ];

  return (
    <div className="cc">
      <div className="cc-top">
        {/* Library */}
        <aside className="cc-lib">
          <div className="cc-tabs">
            {tabs.map((t) => (
              <button key={t.id} className={`cc-tab ${libTab === t.id ? 'on' : ''}`} onClick={() => setLibTab(t.id)}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="cc-lib-body">
            {libTab === 'media' && (
              <>
                <div className="cc-lib-actions">
                  <button className="btn btn-primary btn-xs" onClick={() => importFiles('video/*,image/*', 'video')}>
                    <Upload size={12} /> Importer
                  </button>
                </div>
                <div className="cc-grid">
                  {mediaAssets.length === 0 && <p className="cc-empty">Importez des médias</p>}
                  {mediaAssets.map((a) => (
                    <button
                      key={a.id}
                      className="cc-card"
                      draggable
                      onDragStart={(e) => onDragStart(e, { type: 'media', assetId: a.id })}
                      onDoubleClick={() => addAssetToTimeline(a)}
                    >
                      <div className="cc-card-thumb">
                        {a.kind === 'image' ? <img src={a.src} alt="" /> : <Film size={20} />}
                      </div>
                      <span className="cc-card-name">{a.name}</span>
                      <span className="cc-card-dur">{tc(a.duration).slice(0, 5)}</span>
                    </button>
                  ))}
                </div>
                <p className="cc-hint">Glissez sur la timeline ou double-clic</p>
              </>
            )}

            {libTab === 'audio' && (
              <>
                <div className="cc-lib-actions">
                  <button className="btn btn-primary btn-xs" onClick={() => importFiles('audio/*', 'audio')}>
                    <Music size={12} /> Importer audio
                  </button>
                </div>
                <div className="cc-list">
                  {audioAssets.map((a) => (
                    <button
                      key={a.id}
                      className="cc-row"
                      draggable
                      onDragStart={(e) => onDragStart(e, { type: 'media', assetId: a.id })}
                      onDoubleClick={() => addAssetToTimeline(a, 2)}
                    >
                      <Music size={14} />
                      <span>{a.name}</span>
                      <em>{tc(a.duration).slice(0, 5)}</em>
                    </button>
                  ))}
                </div>
              </>
            )}

            {libTab === 'text' && (
              <div className="cc-text-panel">
                <label>Motifs de texte</label>
                <div className="cc-list" style={{ marginBottom: 10 }}>
                  {TEXT_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className="cc-row"
                      onClick={() => {
                        addClip({
                          type: 'text',
                          name: p.name,
                          start: currentTime,
                          duration: 3,
                          trimStart: 0,
                          src: '',
                          sourceDuration: 3,
                          track: 3,
                          volume: 1,
                          text: p.text,
                          textStyle: { ...p.textStyle },
                          fadeIn: p.fadeIn ?? 0.2,
                          fadeOut: p.fadeOut ?? 0.2,
                        });
                      }}
                    >
                      <Type size={14} />
                      <span style={{ fontFamily: p.textStyle.fontFamily, fontSize: 12 }}>{p.name}</span>
                    </button>
                  ))}
                </div>
                <label>Texte libre</label>
                <input className="input" value={textDraft} onChange={(e) => setTextDraft(e.target.value)} />
                <label>Police</label>
                <select
                  className="select"
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  {TEXT_FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f.split(',')[0]}</option>
                  ))}
                </select>
                <label>Taille</label>
                <input
                  type="range"
                  min={18}
                  max={96}
                  step={2}
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{textSize}px</div>
                <label>Couleur</label>
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: '100%', height: 32, border: 'none', background: 'transparent' }} />
                <button
                  type="button"
                  className="btn btn-primary btn-xs"
                  style={{ marginTop: 10, width: '100%' }}
                  onClick={() => {
                    addClip({
                      type: 'text',
                      name: textDraft.slice(0, 24),
                      start: currentTime,
                      duration: 3,
                      trimStart: 0,
                      src: '',
                      sourceDuration: 3,
                      track: 3,
                      volume: 1,
                      text: textDraft,
                      textStyle: {
                        fontSize: textSize,
                        color: textColor,
                        fontFamily: textFont,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                      },
                      fadeIn: 0.25,
                      fadeOut: 0.25,
                    });
                  }}
                >
                  <Subtitles size={12} /> Ajouter à la timeline
                </button>
              </div>
            )}

            {libTab === 'transitions' && (
              <div className="cc-list">
                <p className="cc-hint">Glissez une transition sur un clip de la timeline</p>
                {TRANSITIONS.map((tr) => (
                  <button
                    key={tr.id}
                    className="cc-row draggable"
                    draggable
                    onDragStart={(e) => onDragStart(e, { type: 'transition', value: tr.id })}
                    onClick={() => {
                      if (selectedClipId) applyPayloadToClip(selectedClipId, { type: 'transition', value: tr.id });
                    }}
                  >
                    <span style={{ width: 18, textAlign: 'center' }}>{tr.icon}</span>
                    <span>{tr.name}</span>
                  </button>
                ))}
              </div>
            )}

            {libTab === 'filters' && (
              <div className="cc-list">
                <p className="cc-hint">Glissez un filtre sur un clip — aperçu immédiat</p>
                {FILTER_PRESETS.map((f) => (
                  <button
                    key={f.name}
                    className="cc-row draggable"
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, {
                        type: 'filter',
                        brightness: f.brightness,
                        contrast: f.contrast,
                        saturation: f.saturation,
                      })
                    }
                    onClick={() => {
                      if (selectedClipId) {
                        updateEffects(selectedClipId, {
                          brightness: f.brightness,
                          contrast: f.contrast,
                          saturation: f.saturation,
                        });
                      }
                    }}
                  >
                    <Filter size={14} />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            )}

            {libTab === 'effects' && (
              <div className="cc-list">
                <p className="cc-hint">Glissez un effet sur un clip — aperçu live</p>
                {EFFECT_PRESETS.map((ef) => (
                  <button
                    key={ef.name}
                    className="cc-row draggable"
                    draggable
                    onDragStart={(e) => onDragStart(e, { type: 'effect', effects: ef.effects })}
                    onClick={() => {
                      if (selectedClipId) updateEffects(selectedClipId, ef.effects);
                    }}
                  >
                    <Sparkles size={14} />
                    <span>{ef.name}</span>
                  </button>
                ))}
                {selected?.type === 'video' && (
                  <div className="cc-effects" style={{ marginTop: 12 }}>
                    <label>Zoom {selected.effects.scale.toFixed(2)}×</label>
                    <input type="range" min={0.5} max={2.5} step={0.05} value={selected.effects.scale}
                      onChange={(e) => updateEffects(selected.id, { scale: Number(e.target.value) })} />
                    <label>Flou {selected.effects.blur}px</label>
                    <input type="range" min={0} max={20} step={1} value={selected.effects.blur}
                      onChange={(e) => updateEffects(selected.id, { blur: Number(e.target.value) })} />
                    <label>Opacité {selected.effects.opacity.toFixed(2)}</label>
                    <input type="range" min={0} max={1} step={0.05} value={selected.effects.opacity}
                      onChange={(e) => updateEffects(selected.id, { opacity: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Preview center */}
        <section className="cc-preview">
          <div className="cc-stage">
            <video ref={videoRef} playsInline muted style={{ display: 'none' }} />
            <canvas ref={canvasRef} className="cc-canvas" />
            {clips.length === 0 && (
              <div className="cc-stage-empty">
                <Film size={36} strokeWidth={1.2} />
                <p>Importez un média puis double-cliquez</p>
              </div>
            )}
          </div>
          {/* Transport TOUJOURS visible */}
          <div className="cc-transport">
            <button type="button" className="tb" onClick={() => setCurrentTime(0)} title="Début">
              <SkipBack size={15} />
            </button>
            <button
              type="button"
              className="tb tb-main"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause' : 'Lecture'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button type="button" className="tb" onClick={() => setCurrentTime(duration)} title="Fin">
              <SkipForward size={15} />
            </button>
            <span className="tc">
              {tc(currentTime)} / {tc(duration)}
            </span>
          </div>
        </section>

        {/* Details */}
        <aside className="cc-details">
          <div className="cc-details-title">Détails</div>
          {!selected ? (
            <p className="cc-empty">Sélectionnez un clip</p>
          ) : (
            <div className="cc-details-body">
              <div className="dd-name">{selected.name}</div>
              <div className="dd-meta">
                {selected.type} · {selected.duration.toFixed(1)}s · piste {selected.track}
              </div>
              {selected.type === 'text' && (
                <>
                  <label>Texte</label>
                  <input className="input" value={selected.text || ''}
                    onChange={(e) => updateClip(selected.id, {
                      text: e.target.value,
                      name: e.target.value.slice(0, 24) || selected.name,
                    })} />
                  <label>Police</label>
                  <select className="select"
                    value={selected.textStyle?.fontFamily || TEXT_FONTS[0]}
                    onChange={(e) => updateClip(selected.id, {
                      textStyle: { ...(selected.textStyle || { fontSize: 48, color: '#fff', fontFamily: TEXT_FONTS[0] }), fontFamily: e.target.value },
                    })}>
                    {TEXT_FONTS.map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
                  </select>
                  <label>Taille {selected.textStyle?.fontSize || 48}px</label>
                  <input type="range" min={18} max={96} step={2}
                    value={selected.textStyle?.fontSize || 48}
                    onChange={(e) => updateClip(selected.id, {
                      textStyle: { ...(selected.textStyle || { fontSize: 48, color: '#fff', fontFamily: TEXT_FONTS[0] }), fontSize: Number(e.target.value) },
                    })} />
                  <label>Couleur</label>
                  <input type="color" value={selected.textStyle?.color || '#ffffff'}
                    onChange={(e) => updateClip(selected.id, {
                      textStyle: { ...(selected.textStyle || { fontSize: 48, color: '#fff', fontFamily: TEXT_FONTS[0] }), color: e.target.value },
                    })} style={{ width: '100%', height: 28, border: 'none', background: 'transparent' }} />
                </>
              )}
              <label>Volume</label>
              <input type="range" min={0} max={1} step={0.05} value={selected.volume}
                onChange={(e) => updateClip(selected.id, { volume: Number(e.target.value) })} />
              <label>Vitesse</label>
              <select className="select" value={selected.speed || 1}
                onChange={(e) => {
                  const speed = Number(e.target.value);
                  const used = selected.duration * (selected.speed || 1);
                  updateClip(selected.id, { speed, duration: used / speed });
                }}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <option key={s} value={s}>{s}×</option>
                ))}
              </select>
              <label>Transition in</label>
              <select className="select" value={selected.transitionIn || 'none'}
                onChange={(e) => updateClip(selected.id, {
                  transitionIn: e.target.value as TransitionType,
                  fadeIn: e.target.value === 'none' ? 0 : 0.5,
                })}>
                {TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label>Transition out</label>
              <select className="select" value={selected.transitionOut || 'none'}
                onChange={(e) => updateClip(selected.id, {
                  transitionOut: e.target.value as TransitionType,
                  fadeOut: e.target.value === 'none' ? 0 : 0.5,
                })}>
                {TRANSITIONS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label>Piste</label>
              <select className="select" value={selected.track}
                onChange={(e) => updateClip(selected.id, { track: Number(e.target.value) })}>
                {TRACKS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}
        </aside>
      </div>

      {/* Timeline toolbar */}
      <div className="cc-tl-bar">
        <div className="tb-group">
          <button type="button" className="tb" onClick={handleSplit} disabled={!selectedClipId}><Scissors size={13} /></button>
          <button type="button" className="tb" onClick={handleDelete} disabled={!selectedClipId}><Trash2 size={13} /></button>
          <button type="button" className="tb" onClick={() => selectedClipId && duplicateClip(selectedClipId)} disabled={!selectedClipId}><Copy size={13} /></button>
          <span className="sep" />
          <button type="button" className="tb" onClick={() => importFiles('video/*,image/*,audio/*', 'video')}><FolderOpen size={13} /></button>
          <button type="button" className="tb" onClick={addTextClip}><Type size={13} /></button>
        </div>
        <div className="tb-group">
          <button type="button" className={`tb ${snapEnabled ? 'on' : ''}`} onClick={() => setSnapEnabled(!snapEnabled)}><Magnet size={13} /></button>
          <button type="button" className="tb" onClick={() => setZoom(zoom - 15)}><ZoomOut size={13} /></button>
          <span className="z">{Math.round(zoom)}</span>
          <button type="button" className="tb" onClick={() => setZoom(zoom + 15)}><ZoomIn size={13} /></button>
          <button type="button" className="tb" onClick={() => setCurrentTime(Math.max(0, currentTime - 1 / 30))}><ChevronLeft size={13} /></button>
          <button type="button" className="tb" onClick={() => setCurrentTime(currentTime + 1 / 30)}><ChevronRight size={13} /></button>
        </div>
      </div>

      {/* Timeline */}
      <div
        className="cc-timeline"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={onTimelineDrop}
      >
        <div className="cc-track-labels">
          {TRACKS.map((t) => (
            <div key={t.id} className="cc-tl-label">{t.label}</div>
          ))}
        </div>
        <div className="cc-tl-scroll" ref={timelineRef} onClick={onTimelineClick}>
          <div className="cc-tl-inner" style={{ width: timelineWidth }}>
            <div className="cc-ruler">
              {Array.from({ length: Math.ceil(Math.max(duration, 10)) + 1 }).map((_, i) => (
                <div key={i} className="cc-ruler-mark" style={{ left: i * zoom }}>
                  <span>{tc(i).slice(0, 5)}</span>
                </div>
              ))}
            </div>
            {TRACKS.map((t) => (
              <div key={t.id} className="cc-track">
                {(() => {
                  const trackClips = clips
                    .filter((c) => c.track === t.id)
                    .sort((a, b) => a.start - b.start);
                  return trackClips.map((clip, idx) => {
                    const next = trackClips[idx + 1];
                    const hasTr =
                      clip.transitionOut &&
                      clip.transitionOut !== 'none' &&
                      next &&
                      Math.abs(next.start - (clip.start + clip.duration)) < 0.35;
                    const trMeta = TRANSITIONS.find((x) => x.id === clip.transitionOut);
                    return (
                      <React.Fragment key={clip.id}>
                        <div
                          className={`cc-clip cc-clip-${clip.type} ${selectedClipId === clip.id ? 'sel' : ''} ${dragOverClipId === clip.id ? 'drop-target' : ''}`}
                          style={{ left: clip.start * zoom, width: Math.max(clip.duration * zoom, 6) }}
                          onMouseDown={(e) => onClipDown(e, clip)}
                          onDragOver={(e) => onClipDragOver(e, clip.id)}
                          onDragLeave={() => setDragOverClipId(null)}
                          onDrop={(e) => onClipDrop(e, clip.id)}
                        >
                          <span>{clip.name}</span>
                          {clip.transitionIn && clip.transitionIn !== 'none' && (
                            <i className="tr-in" title={clip.transitionIn}>↗</i>
                          )}
                          {clip.transitionOut && clip.transitionOut !== 'none' && (
                            <i className="tr-out" title={clip.transitionOut}>↘</i>
                          )}
                        </div>
                        {hasTr && (
                          <div
                            className="cc-transition-chip"
                            style={{
                              left: (clip.start + clip.duration) * zoom - 12,
                            }}
                            title={`Transition : ${trMeta?.name || clip.transitionOut}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                            }}
                          >
                            {trMeta?.icon || '◆'}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            ))}
            <div className="cc-playhead" style={{ left: currentTime * zoom }} onMouseDown={onPlayheadDown}>
              <div className="cc-ph-head" />
              <div className="cc-ph-line" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cc {
          display: flex; flex-direction: column; height: 100%;
          min-height: 0; overflow: hidden; background: #0f1115;
        }
        .cc-top {
          display: grid;
          grid-template-columns: 240px minmax(0, 1fr) 220px;
          flex: 1 1 auto;
          min-height: 0;
          max-height: calc(100% - 240px);
          border-bottom: 1px solid var(--border);
        }
        .cc-lib {
          display: flex; flex-direction: column; border-right: 1px solid var(--border);
          background: #12151c; min-height: 0; overflow: hidden;
        }
        .cc-tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .cc-tab {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 6px 6px; border: none; background: transparent; color: var(--text-muted);
          border-radius: 6px; cursor: pointer; font-size: 9px; font-family: inherit; min-width: 48px;
        }
        .cc-tab:hover { background: var(--bg-elevated); color: var(--text-primary); }
        .cc-tab.on { background: var(--accent-muted); color: var(--accent); }
        .cc-lib-body { flex: 1; overflow: auto; padding: 8px; min-height: 0; }
        .cc-lib-actions { display: flex; gap: 6px; margin-bottom: 8px; }
        .btn-xs { padding: 5px 10px; font-size: 11px; }
        .cc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cc-card {
          background: #1a1f27; border: 1px solid var(--border); border-radius: 8px;
          padding: 0; overflow: hidden; cursor: grab; text-align: left; color: inherit; font-family: inherit;
        }
        .cc-card:hover { border-color: var(--accent); }
        .cc-card-thumb {
          aspect-ratio: 16/10; background: #0d1117; display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); overflow: hidden;
        }
        .cc-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .cc-card-name { display: block; font-size: 10px; padding: 4px 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cc-card-dur { display: block; font-size: 9px; color: var(--text-muted); padding: 0 6px 6px; }
        .cc-list { display: flex; flex-direction: column; gap: 4px; }
        .cc-row {
          display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 6px;
          border: 1px solid transparent; background: #1a1f27; color: var(--text-secondary);
          cursor: pointer; font-size: 12px; font-family: inherit; text-align: left;
        }
        .cc-row.draggable { cursor: grab; }
        .cc-row em { margin-left: auto; font-style: normal; font-size: 10px; color: var(--text-muted); }
        .cc-row:hover { border-color: var(--accent); color: var(--accent); }
        .cc-empty { font-size: 12px; color: var(--text-muted); padding: 12px 4px; }
        .cc-hint { font-size: 10px; color: var(--text-muted); margin-top: 8px; }
        .cc-text-panel label, .cc-effects label {
          display: block; font-size: 11px; color: var(--text-muted); margin: 8px 0 4px;
        }
        .cc-effects input[type="range"] { width: 100%; accent-color: var(--accent); }

        /* Preview: column with fixed transport */
        .cc-preview {
          display: flex; flex-direction: column; min-width: 0; min-height: 0;
          background: #0a0c10; overflow: hidden;
        }
        .cc-stage {
          flex: 1 1 auto; position: relative; margin: 8px 12px 0;
          background: #000; border-radius: 8px; border: 1px solid var(--border);
          overflow: hidden; min-height: 120px;
        }
        .cc-canvas { width: 100%; height: 100%; display: block; }
        .cc-stage-empty {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; color: var(--text-muted); font-size: 13px;
          pointer-events: none;
        }
        .cc-transport {
          flex: 0 0 48px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 0 12px; border-top: 1px solid var(--border); background: #12151c;
        }
        .tc { font-family: var(--font-mono); font-size: 12px; margin-left: 12px; color: var(--text-secondary); }

        .cc-details {
          border-left: 1px solid var(--border); background: #12151c; overflow: auto; padding: 12px; min-height: 0;
        }
        .cc-details-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--text-muted); margin-bottom: 10px;
        }
        .dd-name { font-weight: 600; font-size: 13px; word-break: break-all; }
        .dd-meta { font-size: 11px; color: var(--text-muted); margin: 6px 0 12px; }
        .cc-details-body label { display: block; font-size: 11px; color: var(--text-muted); margin: 8px 0 3px; }
        .cc-details-body input[type="range"] { width: 100%; accent-color: var(--accent); }
        .cc-details-body .select, .cc-details-body .input { width: 100%; font-size: 12px; padding: 5px 8px; }

        .cc-tl-bar {
          flex: 0 0 36px;
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 10px; background: #12151c; border-bottom: 1px solid var(--border);
        }
        .tb-group { display: flex; align-items: center; gap: 2px; }
        .tb {
          width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
          border: none; background: transparent; color: var(--text-secondary); border-radius: 6px; cursor: pointer;
        }
        .tb:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); }
        .tb:disabled { opacity: 0.35; cursor: not-allowed; }
        .tb.on { color: var(--accent); background: var(--accent-muted); }
        .tb-main {
          width: 40px; height: 40px; background: var(--accent); color: #0d1117; border-radius: 50%;
        }
        .tb-main:hover { background: var(--accent-hover); color: #0d1117; }
        .sep { width: 1px; height: 14px; background: var(--border); margin: 0 4px; }
        .z { font-size: 10px; color: var(--text-muted); min-width: 24px; text-align: center; }

        .cc-timeline {
          flex: 0 0 200px;
          display: flex; background: #0d1117; min-height: 0;
        }
        .cc-track-labels { width: 36px; flex-shrink: 0; border-right: 1px solid var(--border); padding-top: 18px; }
        .cc-tl-label {
          height: 36px; display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; color: var(--text-muted); border-bottom: 1px solid var(--border);
        }
        .cc-tl-scroll { flex: 1; overflow: auto; position: relative; }
        .cc-tl-inner { position: relative; min-height: 100%; }
        .cc-ruler {
          height: 18px; position: sticky; top: 0; z-index: 5;
          background: #161b22; border-bottom: 1px solid var(--border);
        }
        .cc-ruler-mark { position: absolute; top: 0; height: 100%; border-left: 1px solid var(--border); padding-left: 3px; }
        .cc-ruler-mark span { font-size: 9px; color: var(--text-muted); font-family: var(--font-mono); }
        .cc-track { position: relative; height: 36px; border-bottom: 1px solid var(--border); background: #0d1117; }
        .cc-track:nth-child(odd) { background: #12151c; }
        .cc-clip {
          position: absolute; top: 4px; height: 28px; border-radius: 3px; padding: 0 6px;
          font-size: 10px; font-weight: 500; overflow: hidden; cursor: grab;
          display: flex; align-items: center; border: 1px solid transparent; user-select: none;
        }
        .cc-clip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cc-clip.sel { border-color: #fff; z-index: 2; }
        .cc-clip.drop-target {
          outline: 2px solid #58a6ff; outline-offset: 1px;
          box-shadow: 0 0 12px rgba(88,166,255,0.5);
        }
        .cc-clip-video { background: linear-gradient(90deg, #1f6feb, #388bfd); color: #fff; }
        .cc-clip-audio { background: linear-gradient(90deg, #238636, #3fb950); color: #fff; }
        .cc-clip-text { background: linear-gradient(90deg, #8957e5, #a371f7); color: #fff; }
        .cc-clip-image { background: linear-gradient(90deg, #bf4b8a, #db61a2); color: #fff; }
        .cc-clip i.tr-in, .cc-clip i.tr-out {
          font-style: normal; font-size: 9px; opacity: 0.9; margin-left: 2px;
        }
        .cc-transition-chip {
          position: absolute;
          top: 6px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f0883e, #db6d28);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4;
          border: 2px solid #0d1117;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(240,136,62,0.45);
        }
        .cc-transition-chip:hover { transform: scale(1.1); }
        .cc-playhead { position: absolute; top: 0; bottom: 0; width: 2px; z-index: 10; cursor: ew-resize; }
        .cc-ph-head {
          position: absolute; top: 0; left: -5px; width: 0; height: 0;
          border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #f85149;
        }
        .cc-ph-line { position: absolute; top: 6px; bottom: 0; left: 0; width: 2px; background: #f85149; }
      `}</style>
    </div>
  );
}
