/**
 * Professional multi-track timeline + preview engine.
 * Connected to projectStore (real model), media import, undo/redo, playback.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Scissors, Trash2, ZoomIn, ZoomOut,
  Copy, Magnet, Upload, Undo2, Redo2, Lock, Unlock, Eye, EyeOff,
  Volume2, VolumeX, FastForward, Rewind, ChevronLeft, ChevronRight,
  Type, Film, Music, Image as ImageIcon, Gauge,
} from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { useMediaLibraryStore } from '../../stores/mediaLibraryStore';
import { useHistoryKeys } from '../../hooks/useHistoryKeys';
import { useAutoSave, useDirtyTracker } from '../../hooks/useAutoSave';
import {
  importFiles, openFilePicker, mediaToClip, ACCEPT_ALL_MEDIA,
} from '../../engine/mediaImport';
import { sourceTimeAt, resolvedEffects } from '../../engine/playback';
import { applyPostFx } from '../../engine/renderEffects';
import { getLiveMixer, resumeAudio, computeWaveform } from '../../engine/audioEngine';
import { drawSubtitles } from '../../engine/subtitles/renderSubtitle';
import { useSubtitleStore } from '../../stores/subtitleStore';
import { useUIStore } from '../../stores/uiStore';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  TimelineContextMenu,
  type TimelineContextMenuState,
} from '../../components/TimelineContextMenu';

function tc(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function TimelineEngine() {
  useAutoSave(true);
  useDirtyTracker();
  const history = useHistoryKeys();
  const notify = useUIStore((s) => s.notify);

  const {
    clips, tracks, currentTime, duration, isPlaying, selectedClipId, zoom, snapEnabled,
    setCurrentTime, setIsPlaying, setSelectedClipId, setZoom, setSnapEnabled,
    splitClip, removeClip, duplicateClip, moveClip, updateClip, updateEffects,
    setClipSpeed, setClipReverse, trimClip, mergeClips, addClip,
    setTrackLocked, setTrackHidden, setTrackMuted, stepFrame, getSelected,
    copyClip, cutClip, pasteClip, renameClip, setClipLocked, separateAudioVideo,
    clipboard,
  } = useProjectStore();

  const { assets, addImported } = useMediaLibraryStore();
  const selected = getSelected();

  const videoRef = useRef<HTMLVideoElement>(null);
  const subtitleTracks = useSubtitleStore((s) => s.tracks);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadDrag = useRef(false);
  const clipDrag = useRef<{ id: string; startX: number; origStart: number; track: number } | null>(null);
  const trimDrag = useRef<{ id: string; edge: 'start' | 'end' } | null>(null);
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const rafRef = useRef(0);

  const [importing, setImporting] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<TimelineContextMenuState | null>(null);
  const [separating, setSeparating] = useState(false);
  const [propsOpen, setPropsOpen] = useState(true);
  const pxPerSec = zoom;


  // —— Live audio mix (HTMLAudioElement — reliable with blob URLs) ——
  useEffect(() => {
    const mixer = getLiveMixer();
    if (!isPlaying) {
      mixer.stopAll();
      return;
    }
    const mutedTracks = new Set(tracks.filter((tr) => tr.muted).map((tr) => tr.id));
    const t0 = useProjectStore.getState().currentTime;
    resumeAudio()
      .then(() =>
        mixer.play(clips, t0, mutedTracks, () => useProjectStore.getState().currentTime)
      )
      .catch((err) => console.warn('audio mix start failed', err));
    return () => mixer.stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // —— Playback loop ——
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = timeRef.current + dt;
      if (next >= duration && duration > 0) {
        setIsPlaying(false);
        setCurrentTime(duration);
        return;
      }
      setCurrentTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, duration, setCurrentTime, setIsPlaying]);

  // —— Preview render ——
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const hidden = new Set(tracks.filter((t) => t.hidden).map((t) => t.id));
    const active = clips
      .filter(
        (c) =>
          (c.type === 'video' || c.type === 'image') &&
          !hidden.has(c.track) &&
          timeRef.current >= c.start &&
          timeRef.current < c.start + c.duration
      )
      .sort((a, b) => a.track - b.track);

    const drawClip = async (clip: typeof active[0]) => {
      const fx = resolvedEffects(clip, timeRef.current);
      const rel = timeRef.current - clip.start;
      let fadeMul = 1;
      if (clip.fadeIn > 0 && rel < clip.fadeIn) fadeMul = rel / clip.fadeIn;
      if (clip.fadeOut > 0 && rel > clip.duration - clip.fadeOut) {
        fadeMul = Math.min(fadeMul, (clip.duration - rel) / clip.fadeOut);
      }

      if (clip.type === 'video' && video) {
        const st = sourceTimeAt(clip, timeRef.current);
        if (st >= 0 && video.src !== clip.src) {
          video.src = clip.src;
        }
        if (st >= 0 && Math.abs(video.currentTime - st) > 0.08) {
          try {
            video.currentTime = Math.max(0, st);
          } catch { /* ignore */ }
        }
        if (video.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = fx.opacity * fadeMul;
          const crop = fx.crop || { x: 0, y: 0, w: 1, h: 1 };
          const vw = video.videoWidth || w;
          const vh = video.videoHeight || h;
          const sx = crop.x * vw;
          const sy = crop.y * vh;
          const sw = crop.w * vw;
          const sh = crop.h * vh;
          const scale = fx.scale * Math.min(w / sw, h / sh);
          const dw = sw * scale;
          const dh = sh * scale;
          const dx = (w - dw) / 2 + fx.positionX * w * 0.5;
          const dy = (h - dh) / 2 + fx.positionY * h * 0.5;
          if (fx.rotation) {
            ctx.translate(dx + dw / 2, dy + dh / 2);
            ctx.rotate((fx.rotation * Math.PI) / 180);
            ctx.translate(-(dx + dw / 2), -(dy + dh / 2));
          }
          if (fx.blur > 0) ctx.filter = `blur(${fx.blur}px)`;
          ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
          ctx.filter = 'none';
          // full VFX pipeline (grade, glitch, vignette, mask…)
          ctx.restore();
          applyPostFx(ctx, w, h, fx, timeRef.current);
          // burn-in subtitles (preview)
          for (const st of subtitleTracks) {
            if (st.visible) drawSubtitles(ctx, w, h, st, timeRef.current, 1);
          }
        }
      }
    };

    // sync primary video element to topmost video clip
    const topVideo = [...active].reverse().find((c) => c.type === 'video');
    if (topVideo && video) {
      if (video.src !== topVideo.src) video.src = topVideo.src;
      const st = sourceTimeAt(topVideo, timeRef.current);
      if (st >= 0 && Math.abs(video.currentTime - st) > 0.12) {
        try { video.currentTime = st; } catch { /* */ }
      }
      video.playbackRate = Math.abs(topVideo.speed || 1);
      if (isPlaying && video.paused) video.play().catch(() => {});
      if (!isPlaying && !video.paused) video.pause();
    }

    for (const clip of active) {
      void drawClip(clip);
    }

    // text overlays
    for (const clip of clips.filter(
      (c) =>
        c.type === 'text' &&
        !hidden.has(c.track) &&
        timeRef.current >= c.start &&
        timeRef.current < c.start + c.duration
    )) {
      const style = clip.textStyle || {
        fontSize: 48,
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: 'rgba(0,0,0,0.5)',
      };
      const rel = timeRef.current - clip.start;
      let fadeMul = 1;
      if (clip.fadeIn > 0 && rel < clip.fadeIn) fadeMul = rel / clip.fadeIn;
      if (clip.fadeOut > 0 && rel > clip.duration - clip.fadeOut) {
        fadeMul = Math.min(fadeMul, (clip.duration - rel) / clip.fadeOut);
      }
      ctx.save();
      ctx.globalAlpha = fadeMul * (clip.effects?.opacity ?? 1);
      ctx.font = `600 ${style.fontSize}px ${style.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = clip.text || '';
      const metrics = ctx.measureText(text);
      const tx = w / 2 + (clip.effects?.positionX || 0) * w * 0.5;
      const ty = h * 0.85 + (clip.effects?.positionY || 0) * h * 0.5;
      if (style.backgroundColor) {
        ctx.fillStyle = style.backgroundColor;
        const bw = metrics.width + 40;
        const bh = style.fontSize + 24;
        ctx.beginPath();
        ctx.roundRect(tx - bw / 2, ty - bh / 2, bw, bh, 8);
        ctx.fill();
      }
      ctx.fillStyle = style.color;
      ctx.fillText(text, tx, ty);
      ctx.restore();
    }
  }, [clips, tracks, currentTime, isPlaying, subtitleTracks]);

  // —— Import ——
  const handleImport = async () => {
    setImporting(true);
    try {
      const files = await openFilePicker(ACCEPT_ALL_MEDIA, true);
      if (!files.length) return;
      const imported = await importFiles(files);
      let offset = currentTime;
      for (const media of imported) {
        addImported(media);
        const track =
          media.kind === 'audio' ? 2 : media.kind === 'image' ? 5 : 0;
        const clipData = mediaToClip(media, offset, track);
        addClip(clipData as any);
        offset += media.duration || 5;
      }
      notify({
        type: 'success',
        title: `${imported.length} média(s) importé(s)`,
      });
    } catch (err: any) {
      notify({ type: 'error', title: 'Import échoué', message: String(err?.message || err) });
    } finally {
      setImporting(false);
    }
  };

  // —— Timeline interactions ——
  const timeFromX = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft - 72;
      let t = x / pxPerSec;
      if (snapEnabled) t = Math.round(t * 10) / 10;
      return Math.max(0, t);
    },
    [pxPerSec, snapEnabled]
  );

  const onTimelineMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    playheadDrag.current = true;
    setCurrentTime(timeFromX(e.clientX));
    setIsPlaying(false);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (playheadDrag.current) {
        setCurrentTime(timeFromX(e.clientX));
      }
      if (clipDrag.current) {
        const dx = e.clientX - clipDrag.current.startX;
        const dt = dx / pxPerSec;
        let newStart = Math.max(0, clipDrag.current.origStart + dt);
        if (snapEnabled) newStart = Math.round(newStart * 10) / 10;
        // live preview without history spam — commit on mouseup
        useProjectStore.setState((s) => ({
          clips: s.clips.map((c) =>
            c.id === clipDrag.current!.id ? { ...c, start: newStart } : c
          ),
        }));
      }
    };
    const onUp = () => {
      if (clipDrag.current) {
        const { id, origStart } = clipDrag.current;
        const clip = useProjectStore.getState().clips.find((c) => c.id === id);
        if (clip && Math.abs(clip.start - origStart) > 0.001) {
          // restore original then commit move for clean history
          useProjectStore.setState((s) => ({
            clips: s.clips.map((c) =>
              c.id === id ? { ...c, start: origStart } : c
            ),
          }));
          moveClip(id, clip.start);
        }
        clipDrag.current = null;
      }
      playheadDrag.current = false;
      trimDrag.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [timeFromX, pxPerSec, snapEnabled, moveClip, setCurrentTime]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const next = !useProjectStore.getState().isPlaying;
        if (next) resumeAudio().catch(() => {});
        setIsPlaying(next);
      }
      if (e.key === 's' || e.key === 'S') {
        if (selectedClipId) splitClip(selectedClipId, currentTime);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) removeClip(selectedClipId);
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedClipId) duplicateClip(selectedClipId);
      }
      if (e.key === 'ArrowLeft') stepFrame(-1);
      if (e.key === 'ArrowRight') stepFrame(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedClipId, currentTime, splitClip, removeClip, duplicateClip,
    setIsPlaying, stepFrame,
  ]);

  const totalWidth = Math.max(duration * pxPerSec + 400, 800);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <Tooltip content="Importer médias">
            <button className="btn btn-primary btn-sm" onClick={handleImport} disabled={importing}>
              <Upload size={14} /> {importing ? 'Import…' : 'Importer'}
            </button>
          </Tooltip>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <Tooltip content="Annuler (Ctrl+Z)">
            <button className="btn btn-ghost btn-icon" disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Rétablir (Ctrl+Y)">
            <button className="btn btn-ghost btn-icon" disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 size={15} />
            </button>
          </Tooltip>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <Tooltip content="Diviser (S)">
            <button
              className="btn btn-ghost btn-icon"
              disabled={!selectedClipId}
              onClick={() => selectedClipId && splitClip(selectedClipId, currentTime)}
            >
              <Scissors size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Dupliquer (Ctrl+D)">
            <button
              className="btn btn-ghost btn-icon"
              disabled={!selectedClipId}
              onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            >
              <Copy size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Supprimer (Suppr)">
            <button
              className="btn btn-ghost btn-icon"
              disabled={!selectedClipId}
              onClick={() => selectedClipId && removeClip(selectedClipId)}
            >
              <Trash2 size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Fusionner sélection (même source)">
            <button
              className="btn btn-ghost btn-sm"
              disabled={!selectedClipId}
              onClick={() => selectedClipId && mergeClips([selectedClipId])}
            >
              Fusionner
            </button>
          </Tooltip>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <Tooltip content="Magnétisme">
            <button
              className={`btn btn-ghost btn-icon ${snapEnabled ? 'active' : ''}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
              style={snapEnabled ? { color: 'var(--accent)' } : undefined}
            >
              <Magnet size={15} />
            </button>
          </Tooltip>
          <button className="btn btn-ghost btn-icon" onClick={() => setZoom(zoom - 15)}>
            <ZoomOut size={15} />
          </button>
          <span className="text-muted text-xs" style={{ width: 36, textAlign: 'center' }}>
            {zoom}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={() => setZoom(zoom + 15)}>
            <ZoomIn size={15} />
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="toolbar-group">
          <button className="btn btn-ghost btn-icon" onClick={() => setCurrentTime(0)}>
            <SkipBack size={15} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => stepFrame(-1)}>
            <ChevronLeft size={15} />
          </button>
          <button
            className="btn btn-primary btn-icon"
            onClick={async () => {
              const next = !isPlaying;
              if (next) {
                try { await resumeAudio(); } catch { /* */ }
              }
              setIsPlaying(next);
            }}
            style={{ width: 36, height: 36, borderRadius: '50%' }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => stepFrame(1)}>
            <ChevronRight size={15} />
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setCurrentTime(duration)}
          >
            <SkipForward size={15} />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              minWidth: 70,
            }}
          >
            {tc(currentTime)}
          </span>
        </div>
      </div>

      {/* Preview + properties */}
      <div className="workspace-top">
        <div className="preview-area">
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000',
              position: 'relative',
              minHeight: 0,
            }}
          >
            <video ref={videoRef} muted playsInline style={{ display: 'none' }} />
            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                background: '#000',
              }}
            />
          </div>
        </div>

        {/* Properties panel */}
        <div className="properties-panel">
          <div className="panel-header">
            <h3>Propriétés</h3>
          </div>
          <div className="panel-body">
            {!selected ? (
              <div className="empty-state">
                <Film size={28} strokeWidth={1.2} />
                <p>Sélectionnez un clip sur la timeline</p>
              </div>
            ) : (
              <>
                <div className="label">Nom</div>
                <div className="text-sm font-medium mb-2 truncate">{selected.name}</div>
                <div className="label">Type / piste</div>
                <div className="text-sm text-secondary mb-2">
                  {selected.type} · track {selected.track} · {selected.duration.toFixed(2)}s
                </div>

                {(selected.type === 'video' || selected.type === 'audio') && (
                  <>
                    <div className="slider-row">
                      <label>
                        <span><Gauge size={12} /> Vitesse</span>
                        <span>{selected.speed.toFixed(2)}×</span>
                      </label>
                      <input
                        type="range"
                        min={0.25}
                        max={4}
                        step={0.05}
                        value={selected.speed}
                        onChange={(e) => setClipSpeed(selected.id, Number(e.target.value))}
                      />
                    </div>
                    <button
                      className="btn btn-secondary btn-sm w-full mb-2"
                      onClick={() => setClipReverse(selected.id, !selected.reverse)}
                    >
                      {selected.reverse ? <FastForward size={14} /> : <Rewind size={14} />}
                      {selected.reverse ? 'Sens normal' : 'Lecture inversée'}
                    </button>
                    <div className="slider-row">
                      <label>
                        <span>Volume</span>
                        <span>{Math.round(selected.volume * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selected.volume}
                        onChange={(e) =>
                          updateClip(selected.id, { volume: Number(e.target.value) })
                        }
                      />
                    </div>
                  </>
                )}

                <div className="slider-row">
                  <label>
                    <span>Opacité</span>
                    <span>{Math.round(selected.effects.opacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selected.effects.opacity}
                    onChange={(e) =>
                      updateEffects(selected.id, { opacity: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Échelle</span>
                    <span>{selected.effects.scale.toFixed(2)}×</span>
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.05}
                    value={selected.effects.scale}
                    onChange={(e) =>
                      updateEffects(selected.id, { scale: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Rotation</span>
                    <span>{Math.round(selected.effects.rotation)}°</span>
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={selected.effects.rotation}
                    onChange={(e) =>
                      updateEffects(selected.id, { rotation: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Exposition</span>
                    <span>{(selected.effects.exposure ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={-1} max={1} step={0.05}
                    value={selected.effects.exposure ?? 0}
                    onChange={(e) => updateEffects(selected.id, { exposure: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Température</span>
                    <span>{(selected.effects.temperature ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={-1} max={1} step={0.05}
                    value={selected.effects.temperature ?? 0}
                    onChange={(e) => updateEffects(selected.id, { temperature: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Teinte</span>
                    <span>{(selected.effects.tint ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={-1} max={1} step={0.05}
                    value={selected.effects.tint ?? 0}
                    onChange={(e) => updateEffects(selected.id, { tint: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Vignette</span>
                    <span>{(selected.effects.vignette ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={selected.effects.vignette ?? 0}
                    onChange={(e) => updateEffects(selected.id, { vignette: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Glitch</span>
                    <span>{(selected.effects.glitch ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={selected.effects.glitch ?? 0}
                    onChange={(e) => updateEffects(selected.id, { glitch: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Glow</span>
                    <span>{(selected.effects.glow ?? 0).toFixed(2)}</span>
                  </label>
                  <input type="range" min={0} max={1} step={0.05}
                    value={selected.effects.glow ?? 0}
                    onChange={(e) => updateEffects(selected.id, { glow: Number(e.target.value) })} />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Luminosité</span>
                    <span>{selected.effects.brightness.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={selected.effects.brightness}
                    onChange={(e) =>
                      updateEffects(selected.id, { brightness: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Contraste</span>
                    <span>{selected.effects.contrast.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={selected.effects.contrast}
                    onChange={(e) =>
                      updateEffects(selected.id, { contrast: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Position X (PiP)</span>
                    <span>{selected.effects.positionX.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={selected.effects.positionX}
                    onChange={(e) =>
                      updateEffects(selected.id, { positionX: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Position Y (PiP)</span>
                    <span>{selected.effects.positionY.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={selected.effects.positionY}
                    onChange={(e) =>
                      updateEffects(selected.id, { positionY: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Fade in</span>
                    <span>{selected.fadeIn.toFixed(1)}s</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selected.fadeIn}
                    onChange={(e) =>
                      updateClip(selected.id, { fadeIn: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="slider-row">
                  <label>
                    <span>Fade out</span>
                    <span>{selected.fadeOut.toFixed(1)}s</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={selected.fadeOut}
                    onChange={(e) =>
                      updateClip(selected.id, { fadeOut: Number(e.target.value) })
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Media library strip + Timeline */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Library */}
        <div
          style={{
            width: 200,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 220,
          }}
        >
          <div className="panel-header" style={{ padding: '8px 10px' }}>
            <h3 style={{ fontSize: 12 }}>Médias ({assets.length})</h3>
            <button className="btn btn-ghost btn-icon" onClick={handleImport} style={{ padding: 4 }}>
              <Upload size={13} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
            {assets.length === 0 ? (
              <div className="text-muted text-xs" style={{ padding: 8, textAlign: 'center' }}>
                Importez MP4, MOV, audio, images…
              </div>
            ) : (
              assets.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-ss-media', a.id);
                  }}
                  style={{
                    display: 'flex',
                    gap: 6,
                    padding: 4,
                    borderRadius: 6,
                    cursor: 'grab',
                    marginBottom: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                  }}
                  onDoubleClick={() => {
                    const track = a.kind === 'audio' ? 2 : a.kind === 'image' ? 5 : 0;
                    addClip({
                      type: a.kind,
                      name: a.name,
                      start: currentTime,
                      duration: a.duration || 5,
                      trimStart: 0,
                      src: a.src,
                      sourceDuration: a.duration || 5,
                      track,
                      thumbnail: a.thumbnail,
                      width: a.width,
                      height: a.height,
                      mimeType: a.mimeType,
                    } as any);
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 28,
                      borderRadius: 4,
                      background: '#111',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : a.kind === 'audio' ? (
                      <Music size={14} style={{ margin: 7, color: 'var(--text-muted)' }} />
                    ) : (
                      <Film size={14} style={{ margin: 7, color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="truncate text-xs font-medium">{a.name}</div>
                    <div className="text-muted" style={{ fontSize: 10 }}>
                      {a.duration ? `${a.duration.toFixed(1)}s` : a.kind}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline tracks */}
        <div className="timeline-area" style={{ flex: 1, height: 220 }}>
          <div
            ref={timelineRef}
            style={{ flex: 1, overflow: 'auto', position: 'relative', cursor: 'default' }}
            onMouseDown={onTimelineMouseDown}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const mediaId = e.dataTransfer.getData('application/x-ss-media');
              const asset = assets.find((a) => a.id === mediaId);
              if (!asset) return;
              const t = timeFromX(e.clientX);
              const track = asset.kind === 'audio' ? 2 : asset.kind === 'image' ? 5 : 0;
              addClip({
                type: asset.kind,
                name: asset.name,
                start: t,
                duration: asset.duration || 5,
                trimStart: 0,
                src: asset.src,
                sourceDuration: asset.duration || 5,
                track,
                thumbnail: asset.thumbnail,
                width: asset.width,
                height: asset.height,
              } as any);
            }}
          >
            {/* ruler */}
            <div style={{ height: 22, position: 'relative', marginLeft: 72, width: totalWidth }}>
              {Array.from({ length: Math.ceil(duration) + 10 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * pxPerSec,
                    top: 0,
                    height: '100%',
                    borderLeft: '1px solid var(--border)',
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    paddingLeft: 3,
                    paddingTop: 4,
                  }}
                >
                  {i % 5 === 0 ? tc(i) : ''}
                </div>
              ))}
            </div>

            {tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  display: 'flex',
                  height: track.height,
                  borderBottom: '1px solid var(--border)',
                  opacity: track.hidden ? 0.35 : 1,
                }}
              >
                {/* track header */}
                <div
                  style={{
                    width: 72,
                    flexShrink: 0,
                    background: 'var(--bg-tertiary)',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '0 4px',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, width: 20 }}>{track.label}</span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 2 }}
                    onClick={() => setTrackLocked(track.id, !track.locked)}
                    title={track.locked ? 'Déverrouiller' : 'Verrouiller'}
                  >
                    {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 2 }}
                    onClick={() => setTrackHidden(track.id, !track.hidden)}
                  >
                    {track.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                  </button>
                  {track.kind === 'audio' && (
                    <button
                      className="btn btn-ghost"
                      style={{ padding: 2 }}
                      onClick={() => setTrackMuted(track.id, !track.muted)}
                    >
                      {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                    </button>
                  )}
                </div>

                {/* track lane */}
                <div style={{ position: 'relative', width: totalWidth, height: '100%' }}>
                  {clips
                    .filter((c) => c.track === track.id)
                    .map((clip) => {
                      const left = clip.start * pxPerSec;
                      const width = Math.max(8, clip.duration * pxPerSec);
                      const isSel = clip.id === selectedClipId;
                      const colors: Record<string, string> = {
                        video: '#3b6fd9',
                        audio: '#2d9f6f',
                        text: '#9b5de5',
                        image: '#d97706',
                      };
                      return (
                        <div
                          key={clip.id}
                          data-clip
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            if (e.button === 2) return; // right-click: menu only
                            if (clip.locked || track.locked) return;
                            clipDrag.current = {
                              id: clip.id,
                              startX: e.clientX,
                              origStart: clip.start,
                              track: clip.track,
                            };
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                            setCtxMenu({ x: e.clientX, y: e.clientY, clip });
                          }}
                          style={{
                            position: 'absolute',
                            left,
                            width,
                            top: 3,
                            bottom: 3,
                            background: colors[clip.type] || '#555',
                            borderRadius: 4,
                            border: isSel ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                            cursor: clip.locked ? 'not-allowed' : 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 6px',
                            fontSize: 10,
                            color: '#fff',
                            userSelect: 'none',
                            opacity: clip.muted ? 0.5 : 1,
                          }}
                          title={`${clip.name} (${clip.duration.toFixed(1)}s)`}
                        >
                          {clip.thumbnail && (
                            <img
                              src={clip.thumbnail}
                              alt=""
                              style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                opacity: 0.35,
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                          {clip.type === 'audio' && clip.waveform && clip.waveform.length > 0 && (
                            <svg
                              width="100%"
                              height="100%"
                              style={{ position: 'absolute', inset: 0, opacity: 0.7, pointerEvents: 'none' }}
                              preserveAspectRatio="none"
                              viewBox={`0 0 ${clip.waveform.length} 32`}
                            >
                              {clip.waveform.map((v, i) => (
                                <rect
                                  key={i}
                                  x={i}
                                  y={16 - v * 14}
                                  width={0.8}
                                  height={Math.max(1, v * 28)}
                                  fill="rgba(255,255,255,0.85)"
                                />
                              ))}
                            </svg>
                          )}
                          <span
                            className="truncate"
                            style={{ position: 'relative', zIndex: 1, fontWeight: 500 }}
                          >
                            {clip.name}
                            {clip.speed !== 1 ? ` ${clip.speed}×` : ''}
                            {clip.reverse ? ' ↺' : ''}
                          </span>
                          {/* trim handles */}
                          {!clip.locked && (
                            <>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 6,
                                  cursor: 'ew-resize',
                                  zIndex: 2,
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const startX = e.clientX;
                                  const orig = clip.start;
                                  const onMove = (ev: MouseEvent) => {
                                    const t = orig + (ev.clientX - startX) / pxPerSec;
                                    trimClip(clip.id, 'start', t);
                                  };
                                  const onUp = () => {
                                    window.removeEventListener('mousemove', onMove);
                                    window.removeEventListener('mouseup', onUp);
                                  };
                                  window.addEventListener('mousemove', onMove);
                                  window.addEventListener('mouseup', onUp);
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: 6,
                                  cursor: 'ew-resize',
                                  zIndex: 2,
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const startX = e.clientX;
                                  const origEnd = clip.start + clip.duration;
                                  const onMove = (ev: MouseEvent) => {
                                    const t = origEnd + (ev.clientX - startX) / pxPerSec;
                                    trimClip(clip.id, 'end', t);
                                  };
                                  const onUp = () => {
                                    window.removeEventListener('mousemove', onMove);
                                    window.removeEventListener('mouseup', onUp);
                                  };
                                  window.addEventListener('mousemove', onMove);
                                  window.addEventListener('mouseup', onUp);
                                }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            {/* playhead */}
            <div
              style={{
                position: 'absolute',
                left: 72 + currentTime * pxPerSec,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--danger)',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: 'var(--danger)',
                  borderRadius: 2,
                  transform: 'translate(-4px, 0)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <TimelineContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        currentTime={currentTime}
        hasClipboard={!!clipboard}
        busy={separating}
        onSplit={() => {
          if (!ctxMenu) return;
          splitClip(ctxMenu.clip.id, currentTime);
          notify({ type: 'info', title: 'Clip divisé au curseur' });
        }}
        onCut={() => {
          if (!ctxMenu) return;
          cutClip(ctxMenu.clip.id);
          notify({ type: 'info', title: 'Coupe', message: ctxMenu.clip.name });
        }}
        onCopy={() => {
          if (!ctxMenu) return;
          copyClip(ctxMenu.clip.id);
          notify({ type: 'info', title: 'Copié', message: ctxMenu.clip.name });
        }}
        onPaste={() => {
          const id = pasteClip(currentTime);
          if (id) notify({ type: 'success', title: 'Collé sur le playhead' });
          else notify({ type: 'warning', title: 'Presse-papiers vide' });
        }}
        onDuplicate={() => {
          if (!ctxMenu) return;
          duplicateClip(ctxMenu.clip.id);
          notify({ type: 'success', title: 'Clip dupliqué' });
        }}
        onDelete={() => {
          if (!ctxMenu) return;
          removeClip(ctxMenu.clip.id);
          notify({ type: 'info', title: 'Clip supprimé' });
        }}
        onRename={() => {
          if (!ctxMenu) return;
          const next = window.prompt('Nouveau nom du clip', ctxMenu.clip.name);
          if (next != null) renameClip(ctxMenu.clip.id, next);
        }}
        onToggleLock={() => {
          if (!ctxMenu) return;
          setClipLocked(ctxMenu.clip.id, !ctxMenu.clip.locked);
        }}
        onSeparateAudio={async () => {
          if (!ctxMenu || ctxMenu.clip.type !== 'video') return;
          setSeparating(true);
          notify({
            type: 'info',
            title: 'Extraction audio…',
            message: 'Décodage en cours (peut prendre la durée du clip).',
          });
          try {
            const audioId = await separateAudioVideo(ctxMenu.clip.id);
            if (!audioId) {
              const detail =
                (useProjectStore.getState() as any)._lastSeparateError ||
                'Impossible d’extraire l’audio (fichier sans son ou format non supporté).';
              notify({
                type: 'warning',
                title: 'Pas de piste audio',
                message: detail,
              });
            } else {
              notify({
                type: 'success',
                title: 'Audio séparé',
                message:
                  'Piste audio créée et synchronisée. La vidéo est coupée du son intégré (muted).',
              });
            }
          } catch (err: any) {
            notify({
              type: 'error',
              title: 'Séparation audio',
              message: String(err?.message || err),
            });
          } finally {
            setSeparating(false);
            setCtxMenu(null);
          }
        }}
        onShowProperties={() => {
          if (!ctxMenu) return;
          setSelectedClipId(ctxMenu.clip.id);
          setPropsOpen(true);
          notify({
            type: 'info',
            title: 'Propriétés',
            message: `${ctxMenu.clip.name} · ${ctxMenu.clip.type} · ${ctxMenu.clip.duration.toFixed(2)}s`,
          });
        }}
        onFitToTrack={() => {
          if (!ctxMenu) return;
          // Snap clip start to 0 within its track span visually — keep duration, start at 0
          moveClip(ctxMenu.clip.id, 0, ctxMenu.clip.track);
          notify({ type: 'info', title: 'Clip aligné au début de la piste' });
        }}
      />
    </div>
  );
}
