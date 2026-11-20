import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut,
  Type,
  Film,
  Magnet,
  Plus,
  FolderOpen,
  Copy,
  Image as ImageIcon,
  Music,
  FastForward,
  Rewind,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useProjectStore, type Clip, type TransitionType } from '../../stores/projectStore';
import { useKeyboardShortcuts, EDITOR_SHORTCUTS } from '../../hooks/useKeyboardShortcuts';

const TRACK_HEIGHT = 44;
const TRACK_LABELS = [
  { name: 'Vidéo 1', track: 0 },
  { name: 'Vidéo 2', track: 1 },
  { name: 'Audio 1', track: 2 },
  { name: 'Audio 2', track: 4 },
  { name: 'Texte', track: 3 },
];

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f
    .toString()
    .padStart(2, '0')}`;
}

export function EditorModule() {
  const {
    clips,
    currentTime,
    duration,
    isPlaying,
    selectedClipId,
    zoom,
    snapEnabled,
    setCurrentTime,
    setIsPlaying,
    setSelectedClipId,
    setZoom,
    setSnapEnabled,
    splitClip,
    removeClip,
    updateClip,
    addClip,
    duplicateClip,
  } = useProjectStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadDragging = useRef(false);
  const clipDragging = useRef<{ id: string; startX: number; origStart: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [showAddText, setShowAddText] = useState(false);
  const [targetTrack, setTargetTrack] = useState(0);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const selectedClip = clips.find((c) => c.id === selectedClipId);

  // Sync video preview
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
      const localTime = currentTime - active.start + active.trimStart;
      if (Math.abs(video.currentTime - localTime) > 0.15) video.currentTime = localTime;
      if (isPlaying && video.paused) video.play().catch(() => {});
      if (!isPlaying && !video.paused) video.pause();
    } else if (!video.paused) {
      video.pause();
    }
  }, [currentTime, isPlaying, clips]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = currentTimeRef.current + dt;
      if (next >= duration && duration > 0) {
        setIsPlaying(false);
        setCurrentTime(duration);
      } else {
        setCurrentTime(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, duration, setIsPlaying, setCurrentTime]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
    setCurrentTime(Math.max(0, x / zoom));
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    playheadDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!timelineRef.current || !playheadDragging.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left + timelineRef.current.scrollLeft;
      setCurrentTime(Math.max(0, x / zoom));
    };
    const onUp = () => {
      playheadDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleClipMouseDown = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    setSelectedClipId(clip.id);
    clipDragging.current = { id: clip.id, startX: e.clientX, origStart: clip.start };
    const onMove = (ev: MouseEvent) => {
      if (!clipDragging.current) return;
      const dx = ev.clientX - clipDragging.current.startX;
      let newStart = clipDragging.current.origStart + dx / zoom;
      if (snapEnabled) newStart = Math.round(newStart * 10) / 10;
      updateClip(clipDragging.current.id, { start: Math.max(0, newStart) });
    };
    const onUp = () => {
      clipDragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSplit = useCallback(() => {
    if (selectedClipId) splitClip(selectedClipId, currentTime);
  }, [selectedClipId, currentTime, splitClip]);

  const handleDelete = useCallback(() => {
    if (selectedClipId) removeClip(selectedClipId);
  }, [selectedClipId, removeClip]);

  const importMedia = (kind: 'video' | 'audio' | 'image') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (kind === 'video') input.accept = 'video/*';
    else if (kind === 'audio') input.accept = 'audio/*';
    else input.accept = 'image/*';

    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      let offset = currentTime;
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);

        if (kind === 'image') {
          addClip({
            type: 'image',
            name: file.name,
            start: offset,
            duration: 5,
            trimStart: 0,
            src: url,
            sourceDuration: 5,
            track: targetTrack === 3 ? 1 : targetTrack,
            volume: 1,
          });
          offset += 5;
          continue;
        }

        const media = document.createElement(kind === 'audio' ? 'audio' : 'video');
        media.src = url;
        media.preload = 'metadata';
        await new Promise<void>((r) => {
          media.onloadedmetadata = () => r();
          media.onerror = () => r();
          setTimeout(r, 3000);
        });
        const dur = isFinite(media.duration) && media.duration > 0 ? media.duration : 5;
        const track =
          kind === 'audio'
            ? targetTrack === 4
              ? 4
              : 2
            : targetTrack <= 1
              ? targetTrack
              : 0;
        addClip({
          type: kind,
          name: file.name,
          start: offset,
          duration: dur,
          trimStart: 0,
          src: url,
          sourceDuration: dur,
          track,
          volume: kind === 'audio' ? 0.8 : 1,
        });
        offset += dur;
      }
    };
    input.click();
  };

  const handleAddText = () => {
    if (!textInput.trim()) return;
    addClip({
      type: 'text',
      name: textInput.slice(0, 28),
      start: currentTime,
      duration: 3,
      trimStart: 0,
      src: '',
      sourceDuration: 3,
      track: 3,
      volume: 1,
      text: textInput,
      textStyle: {
        fontSize: 48,
        color: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        backgroundColor: 'rgba(0,0,0,0.55)',
      },
      fadeIn: 0.3,
      fadeOut: 0.3,
    });
    setTextInput('');
    setShowAddText(false);
  };

  const setTransition = (side: 'in' | 'out', value: TransitionType) => {
    if (!selectedClipId) return;
    if (side === 'in') {
      updateClip(selectedClipId, {
        transitionIn: value,
        fadeIn: value === 'none' ? 0 : Math.max(selectedClip?.fadeIn || 0, 0.5),
      });
    } else {
      updateClip(selectedClipId, {
        transitionOut: value,
        fadeOut: value === 'none' ? 0 : Math.max(selectedClip?.fadeOut || 0, 0.5),
      });
    }
  };

  const shortcuts = useMemo(
    () => [
      { ...EDITOR_SHORTCUTS.playPause, handler: () => setIsPlaying(!isPlaying) },
      { ...EDITOR_SHORTCUTS.split, handler: handleSplit },
      { ...EDITOR_SHORTCUTS.delete, handler: handleDelete },
      { ...EDITOR_SHORTCUTS.deleteBackspace, handler: handleDelete },
      { ...EDITOR_SHORTCUTS.zoomIn, handler: () => setZoom(zoom + 15) },
      { ...EDITOR_SHORTCUTS.zoomOut, handler: () => setZoom(zoom - 15) },
      { key: 'ArrowRight', handler: () => setCurrentTime(currentTime + 1 / 30) },
      { key: 'ArrowLeft', handler: () => setCurrentTime(Math.max(0, currentTime - 1 / 30)) },
    ],
    [isPlaying, handleSplit, handleDelete, zoom, currentTime, setIsPlaying, setZoom, setCurrentTime]
  );
  useKeyboardShortcuts(shortcuts, true);

  const timelineWidth = Math.max(duration * zoom + 240, 900);
  const activeTexts = clips.filter(
    (c) => c.type === 'text' && currentTime >= c.start && currentTime < c.start + c.duration
  );

  return (
    <div className="editor">
      {/* —— Zone preview (hauteur limitée) —— */}
      <div className="editor-top">
        <div className="preview-stage">
          <video ref={videoRef} className="preview-video" playsInline />
          {activeTexts.map((t) => (
            <div
              key={t.id}
              className="text-overlay"
              style={{
                fontSize: (t.textStyle?.fontSize || 48) * 0.45,
                color: t.textStyle?.color || '#fff',
                fontFamily: t.textStyle?.fontFamily,
                background: t.textStyle?.backgroundColor,
              }}
            >
              {t.text}
            </div>
          ))}
          {clips.length === 0 && (
            <div className="preview-empty">
              <Film size={32} strokeWidth={1.2} />
              <p>Timeline vide</p>
              <p className="hint">Importez un média ou enregistrez une capture</p>
            </div>
          )}
        </div>

        {/* Propriétés clip */}
        <div className="props-panel">
          <div className="props-title">Propriétés</div>
          {!selectedClip ? (
            <p className="muted">Aucun clip sélectionné</p>
          ) : (
            <>
              <div className="prop-name">{selectedClip.name}</div>
              <div className="prop-meta">
                {selectedClip.start.toFixed(1)}s → {(selectedClip.start + selectedClip.duration).toFixed(1)}s
                <br />
                Durée {selectedClip.duration.toFixed(1)}s · Piste {selectedClip.track}
              </div>

              {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                <>
                  <label>Volume</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedClip.volume}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { volume: Number(e.target.value) })
                    }
                  />
                  <label>Vitesse</label>
                  <select
                    className="select"
                    value={selectedClip.speed || 1}
                    onChange={(e) => {
                      const speed = Number(e.target.value);
                      const sourceUsed = selectedClip.duration * (selectedClip.speed || 1);
                      updateClip(selectedClip.id, {
                        speed,
                        duration: sourceUsed / speed,
                      });
                    }}
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <option key={s} value={s}>
                        {s}×
                      </option>
                    ))}
                  </select>
                </>
              )}

              {selectedClip.type === 'text' && (
                <>
                  <label>Texte</label>
                  <input
                    className="input"
                    value={selectedClip.text || ''}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        text: e.target.value,
                        name: e.target.value.slice(0, 28),
                      })
                    }
                  />
                </>
              )}

              <label>Transition entrée</label>
              <select
                className="select"
                value={selectedClip.transitionIn || 'none'}
                onChange={(e) => setTransition('in', e.target.value as TransitionType)}
              >
                <option value="none">Aucune</option>
                <option value="fade">Fondu</option>
                <option value="crossfade">Crossfade</option>
                <option value="dissolve">Dissolve</option>
              </select>

              <label>Transition sortie</label>
              <select
                className="select"
                value={selectedClip.transitionOut || 'none'}
                onChange={(e) => setTransition('out', e.target.value as TransitionType)}
              >
                <option value="none">Aucune</option>
                <option value="fade">Fondu</option>
                <option value="crossfade">Crossfade</option>
                <option value="dissolve">Dissolve</option>
              </select>

              <label>Fade in (s)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={selectedClip.fadeIn || 0}
                onChange={(e) =>
                  updateClip(selectedClip.id, { fadeIn: Number(e.target.value) })
                }
              />
              <label>Fade out (s)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={selectedClip.fadeOut || 0}
                onChange={(e) =>
                  updateClip(selectedClip.id, { fadeOut: Number(e.target.value) })
                }
              />

              <label>Piste</label>
              <select
                className="select"
                value={selectedClip.track}
                onChange={(e) =>
                  updateClip(selectedClip.id, { track: Number(e.target.value) })
                }
              >
                {TRACK_LABELS.map((t) => (
                  <option key={t.track} value={t.track}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* —— Toolbar compacte —— */}
      <div className="toolbar">
        <div className="tb-group">
          <button className="tb" onClick={() => setCurrentTime(0)} title="Début">
            <SkipBack size={13} />
          </button>
          <button className="tb" onClick={() => setCurrentTime(Math.max(0, currentTime - 1))} title="-1s">
            <Rewind size={13} />
          </button>
          <button
            className="tb tb-play"
            onClick={() => setIsPlaying(!isPlaying)}
            title="Lecture (Espace)"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className="tb" onClick={() => setCurrentTime(currentTime + 1)} title="+1s">
            <FastForward size={13} />
          </button>
          <button className="tb" onClick={() => setCurrentTime(duration)} title="Fin">
            <SkipForward size={13} />
          </button>
          <span className="tc">{formatTimecode(currentTime)}</span>
          <span className="tc-sep">/</span>
          <span className="tc muted">{formatTimecode(duration)}</span>
        </div>

        <div className="tb-group">
          <button className="tb" onClick={handleSplit} disabled={!selectedClipId} title="Diviser (S)">
            <Scissors size={13} />
          </button>
          <button className="tb" onClick={handleDelete} disabled={!selectedClipId} title="Supprimer">
            <Trash2 size={13} />
          </button>
          <button
            className="tb"
            onClick={() => selectedClipId && duplicateClip(selectedClipId)}
            disabled={!selectedClipId}
            title="Dupliquer"
          >
            <Copy size={13} />
          </button>
          <span className="tb-sep" />
          <button className="tb" onClick={() => setShowAddText(true)} title="Texte">
            <Type size={13} />
          </button>
          <button className="tb" onClick={() => importMedia('video')} title="Importer vidéo">
            <Film size={13} />
          </button>
          <button className="tb" onClick={() => importMedia('audio')} title="Importer audio">
            <Music size={13} />
          </button>
          <button className="tb" onClick={() => importMedia('image')} title="Importer image">
            <ImageIcon size={13} />
          </button>
          <button className="tb" onClick={() => importMedia('video')} title="Importer…">
            <FolderOpen size={13} />
          </button>
        </div>

        <div className="tb-group">
          <Layers size={12} className="muted" />
          <select
            className="select select-sm"
            value={targetTrack}
            onChange={(e) => setTargetTrack(Number(e.target.value))}
            title="Piste d’insertion"
          >
            {TRACK_LABELS.map((t) => (
              <option key={t.track} value={t.track}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="tb-sep" />
          <button
            className={`tb ${snapEnabled ? 'on' : ''}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Magnétisme"
          >
            <Magnet size={13} />
          </button>
          <button className="tb" onClick={() => setZoom(zoom - 15)} title="Zoom -">
            <ZoomOut size={13} />
          </button>
          <span className="zoom-lbl">{Math.round(zoom)}</span>
          <button className="tb" onClick={() => setZoom(zoom + 15)} title="Zoom +">
            <ZoomIn size={13} />
          </button>
          <button className="tb" onClick={() => setCurrentTime(Math.max(0, currentTime - 1 / 30))} title="Frame -">
            <ChevronLeft size={13} />
          </button>
          <button className="tb" onClick={() => setCurrentTime(currentTime + 1 / 30)} title="Frame +">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {showAddText && (
        <div className="text-bar">
          <input
            className="input"
            placeholder="Titre ou sous-titre…"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddText}>
            <Plus size={12} /> Ajouter
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddText(false)}>
            Annuler
          </button>
        </div>
      )}

      {/* —— Timeline (hauteur fixe, scroll interne) —— */}
      <div className="timeline-wrap">
        <div className="track-labels">
          {TRACK_LABELS.map((t) => (
            <div key={t.track} className="track-label" style={{ height: TRACK_HEIGHT }}>
              {t.name}
            </div>
          ))}
        </div>

        <div className="timeline-scroll" ref={timelineRef} onClick={handleTimelineClick}>
          <div className="timeline-inner" style={{ width: timelineWidth }}>
            <div className="ruler">
              {Array.from({ length: Math.ceil(Math.max(duration, 8)) + 1 }).map((_, i) => (
                <div key={i} className="ruler-mark" style={{ left: i * zoom }}>
                  <span>{formatTimecode(i).slice(0, 5)}</span>
                </div>
              ))}
            </div>

            {TRACK_LABELS.map((t) => (
              <div key={t.track} className="track" style={{ height: TRACK_HEIGHT }}>
                {clips
                  .filter((c) => c.track === t.track)
                  .map((clip) => (
                    <div
                      key={clip.id}
                      className={`clip clip-${clip.type} ${
                        selectedClipId === clip.id ? 'selected' : ''
                      }`}
                      style={{
                        left: clip.start * zoom,
                        width: Math.max(clip.duration * zoom, 6),
                      }}
                      onMouseDown={(e) => handleClipMouseDown(e, clip)}
                      title={`${clip.name} (${clip.duration.toFixed(1)}s)`}
                    >
                      {(clip.transitionIn && clip.transitionIn !== 'none') && (
                        <span className="tr-badge left">↗</span>
                      )}
                      <span className="clip-name">{clip.name}</span>
                      {(clip.transitionOut && clip.transitionOut !== 'none') && (
                        <span className="tr-badge right">↘</span>
                      )}
                    </div>
                  ))}
              </div>
            ))}

            <div
              className="playhead"
              style={{ left: currentTime * zoom }}
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="playhead-head" />
              <div className="playhead-line" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .editor {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: var(--bg-primary);
          overflow: hidden;
        }

        /* Preview + props : hauteur max contrôlée */
        .editor-top {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: 10px;
          padding: 10px 12px 0;
          flex: 0 0 auto;
          max-height: 42%;
          min-height: 160px;
        }
        .preview-stage {
          position: relative;
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border);
          aspect-ratio: 16/9;
          max-height: 100%;
          margin: 0 auto;
          width: 100%;
        }
        .preview-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .preview-empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: var(--text-muted);
          font-size: 13px;
        }
        .preview-empty .hint { font-size: 11px; opacity: 0.7; }
        .text-overlay {
          position: absolute;
          bottom: 10%;
          left: 50%;
          transform: translateX(-50%);
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 600;
          pointer-events: none;
          white-space: nowrap;
          max-width: 90%;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .props-panel {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          overflow-y: auto;
          font-size: 12px;
        }
        .props-title {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 8px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .prop-name {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
          word-break: break-all;
        }
        .prop-meta {
          color: var(--text-muted);
          font-size: 11px;
          margin-bottom: 10px;
          line-height: 1.4;
        }
        .props-panel label {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          margin: 8px 0 3px;
        }
        .props-panel input[type="range"] {
          width: 100%;
          accent-color: var(--accent);
        }
        .props-panel .select,
        .props-panel .input {
          width: 100%;
          font-size: 12px;
          padding: 5px 8px;
        }
        .muted { color: var(--text-muted); font-size: 12px; }

        /* Toolbar compacte */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 4px 10px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          min-height: 36px;
        }
        .tb-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .tb {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: 5px;
          cursor: pointer;
          padding: 0;
        }
        .tb:hover:not(:disabled) {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }
        .tb:disabled { opacity: 0.35; cursor: not-allowed; }
        .tb.on {
          color: var(--accent);
          background: var(--accent-muted);
        }
        .tb-play {
          width: 32px;
          height: 32px;
          background: var(--accent);
          color: #0d1117;
          border-radius: 6px;
        }
        .tb-play:hover:not(:disabled) {
          background: var(--accent-hover);
          color: #0d1117;
        }
        .tb-sep {
          width: 1px;
          height: 16px;
          background: var(--border);
          margin: 0 4px;
        }
        .tc {
          font-family: var(--font-mono);
          font-size: 11px;
          margin-left: 6px;
          font-variant-numeric: tabular-nums;
        }
        .tc-sep { color: var(--text-muted); margin: 0 2px; font-size: 11px; }
        .zoom-lbl {
          font-size: 10px;
          color: var(--text-muted);
          min-width: 28px;
          text-align: center;
        }
        .select-sm {
          font-size: 11px;
          padding: 3px 6px;
          max-width: 90px;
        }
        .btn-sm {
          padding: 4px 10px;
          font-size: 12px;
        }

        .text-bar {
          display: flex;
          gap: 6px;
          padding: 6px 10px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .text-bar .input { flex: 1; font-size: 12px; padding: 5px 8px; }

        /* Timeline : prend le reste, scroll interne */
        .timeline-wrap {
          display: flex;
          flex: 1;
          min-height: 0;
          background: var(--bg-secondary);
          overflow: hidden;
        }
        .track-labels {
          width: 72px;
          flex-shrink: 0;
          border-right: 1px solid var(--border);
          padding-top: 20px;
          overflow: hidden;
        }
        .track-label {
          display: flex;
          align-items: center;
          padding: 0 8px;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          border-bottom: 1px solid var(--border);
        }
        .timeline-scroll {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        .timeline-inner {
          position: relative;
          min-height: 100%;
        }
        .ruler {
          height: 20px;
          position: relative;
          border-bottom: 1px solid var(--border);
          background: var(--bg-tertiary);
          position: sticky;
          top: 0;
          z-index: 5;
        }
        .ruler-mark {
          position: absolute;
          top: 0;
          height: 100%;
          border-left: 1px solid var(--border);
          padding-left: 3px;
        }
        .ruler-mark span {
          font-size: 9px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }
        .track {
          position: relative;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .track:nth-child(odd) { background: var(--bg-primary); }

        .clip {
          position: absolute;
          top: 5px;
          height: calc(100% - 10px);
          border-radius: 3px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 500;
          overflow: hidden;
          cursor: grab;
          display: flex;
          align-items: center;
          gap: 2px;
          user-select: none;
          border: 1px solid transparent;
        }
        .clip:active { cursor: grabbing; }
        .clip.selected {
          border-color: #fff;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.25);
          z-index: 2;
        }
        .clip-video { background: linear-gradient(135deg, #1f6feb, #388bfd); color: #fff; }
        .clip-audio { background: linear-gradient(135deg, #238636, #3fb950); color: #fff; }
        .clip-text { background: linear-gradient(135deg, #8957e5, #a371f7); color: #fff; }
        .clip-image { background: linear-gradient(135deg, #bf4b8a, #db61a2); color: #fff; }
        .clip-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .tr-badge {
          font-size: 9px;
          opacity: 0.85;
          flex-shrink: 0;
        }

        .playhead {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          z-index: 10;
          cursor: ew-resize;
        }
        .playhead-head {
          position: absolute;
          top: 0;
          left: -5px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #f85149;
        }
        .playhead-line {
          position: absolute;
          top: 6px;
          bottom: 0;
          left: 0;
          width: 2px;
          background: #f85149;
        }
      `}</style>
    </div>
  );
}
