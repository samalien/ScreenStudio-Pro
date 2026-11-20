import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor,
  AppWindow,
  Crop,
  Mic,
  Video,
  Play,
  Square,
  Pause,
  Circle,
  MousePointer2,
} from 'lucide-react';
import type { ScreenSource } from '../../../preload/preload';
import { useProjectStore } from '../../stores/projectStore';

type CaptureMode = 'screen' | 'window' | 'region';
type RecState = 'idle' | 'countdown' | 'recording' | 'paused';

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function CaptureModule() {
  const addClip = useProjectStore((s) => s.addClip);

  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [mode, setMode] = useState<CaptureMode>('screen');
  const [mic, setMic] = useState(true);
  const [systemAudio, setSystemAudio] = useState(false);
  const [webcam, setWebcam] = useState(false);
  const [countdownSecs, setCountdownSecs] = useState(3);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');

  const [state, setState] = useState<RecState>('idle');
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCur, setDrawCur] = useState<{ x: number; y: number } | null>(null);

  const previewRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const cancelRef = useRef(false);
  const stateRef = useRef<RecState>('idle');
  stateRef.current = state;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ——— Sources ———
  const loadSources = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        setError('Ouvrez l’app via Electron (npm run dev), pas le navigateur.');
        return;
      }
      const list = await window.electronAPI.getSources();
      setSources(list);
      if (list.length && !sourceId) {
        const screen = list.find((s) => s.id.startsWith('screen:'));
        setSourceId(screen?.id || list[0].id);
      }
    } catch (e) {
      setError('Sources : ' + String(e));
    }
  }, [sourceId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const openDesktopStream = async (id: string) => {
    const tryConstraints = async (withFps: boolean) => {
      const video: any = {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: id,
          ...(withFps ? { maxFrameRate: fps } : {}),
        },
      };
      return navigator.mediaDevices.getUserMedia({ audio: false, video });
    };
    try {
      return await tryConstraints(true);
    } catch {
      return await tryConstraints(false);
    }
  };

  // Preview
  const startPreview = useCallback(async () => {
    if (!sourceId || stateRef.current !== 'idle') return;
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await openDesktopStream(sourceId);
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play().catch(() => {});
      }
      setError(null);
    } catch (e) {
      setError('Prévisualisation impossible : ' + String(e));
    }
  }, [sourceId, fps]);

  useEffect(() => {
    if (state === 'idle' && sourceId) startPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, mode]);

  // Timer during recording
  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // ——— Region drawing on preview ———
  const relPos = (e: React.MouseEvent) => {
    const box = previewBoxRef.current;
    if (!box) return { x: 0, y: 0 };
    const r = box.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(e.clientY - r.top, r.height)),
    };
  };

  const onDrawDown = (e: React.MouseEvent) => {
    if (mode !== 'region' || state !== 'idle') return;
    const p = relPos(e);
    setDrawing(true);
    setDrawStart(p);
    setDrawCur(p);
  };
  const onDrawMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    setDrawCur(relPos(e));
  };
  const onDrawUp = () => {
    if (!drawing || !drawStart || !drawCur) {
      setDrawing(false);
      return;
    }
    setDrawing(false);
    const box = previewBoxRef.current;
    if (!box) return;
    const rw = box.clientWidth;
    const rh = box.clientHeight;
    const x = Math.min(drawStart.x, drawCur.x) / rw;
    const y = Math.min(drawStart.y, drawCur.y) / rh;
    const w = Math.abs(drawCur.x - drawStart.x) / rw;
    const h = Math.abs(drawCur.y - drawStart.y) / rh;
    if (w * rw < 20 || h * rh < 20) {
      setRegion(null);
      return;
    }
    setRegion({ x, y, w, h }); // normalized 0-1 relative to preview
  };

  // ——— Recording ———
  const stopRecording = useCallback(() => {
    cancelRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch { /* */ }
    }
    setState('idle');
  }, []);

  const startRecording = async () => {
    if (!sourceId) {
      setError('Choisissez une source.');
      return;
    }
    if (mode === 'region' && !region) {
      setError('Dessinez une zone sur la prévisualisation (cliquer-glisser).');
      return;
    }

    cancelRef.current = false;
    setError(null);
    chunksRef.current = [];
    setElapsed(0);

    // Countdown
    if (countdownSecs > 0) {
      setState('countdown');
      stateRef.current = 'countdown';
      for (let i = countdownSecs; i > 0; i--) {
        if (cancelRef.current) {
          setState('idle');
          stateRef.current = 'idle';
          return;
        }
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (cancelRef.current) {
        setState('idle');
        stateRef.current = 'idle';
        return;
      }
    }

    try {
      // Stop preview to free the source
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (previewRef.current) previewRef.current.srcObject = null;
      await new Promise((r) => setTimeout(r, 120));

      const screenStream = await openDesktopStream(sourceId);
      if (!screenStream.getVideoTracks().length) {
        throw new Error('Aucune piste vidéo.');
      }

      let micStream: MediaStream | null = null;
      if (mic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
          });
        } catch {
          console.warn('Micro indisponible');
        }
      }

      let webcamStream: MediaStream | null = null;
      if (webcam) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 },
            audio: false,
          });
          if (webcamRef.current) {
            webcamRef.current.srcObject = webcamStream;
            webcamRef.current.play().catch(() => {});
          }
        } catch {
          console.warn('Webcam indisponible');
        }
      }

      // Optional system audio
      let sysAudio: MediaStreamTrack[] = [];
      if (systemAudio) {
        try {
          const sys = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
              },
            } as any,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
              },
            } as any,
          });
          sysAudio = sys.getAudioTracks();
          sys.getVideoTracks().forEach((t) => t.stop());
        } catch {
          console.warn('Audio système indisponible');
        }
      }

      // Video track (possibly cropped for region)
      let videoTrack = screenStream.getVideoTracks()[0];
      let canvasStream: MediaStream | null = null;

      if (mode === 'region' && region) {
        const v = document.createElement('video');
        v.srcObject = screenStream;
        v.muted = true;
        await v.play();
        await new Promise<void>((res) => {
          if (v.videoWidth) res();
          else v.onloadedmetadata = () => res();
        });

        const sx = Math.floor(region.x * v.videoWidth);
        const sy = Math.floor(region.y * v.videoHeight);
        const sw = Math.max(2, Math.floor(region.w * v.videoWidth));
        const sh = Math.max(2, Math.floor(region.h * v.videoHeight));

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d')!;
        const draw = () => {
          try {
            ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
          } catch { /* */ }
          animRef.current = requestAnimationFrame(draw);
        };
        draw();
        canvasStream = canvas.captureStream(fps);
        videoTrack = canvasStream.getVideoTracks()[0];
      }

      const tracks: MediaStreamTrack[] = [videoTrack, ...sysAudio];
      if (micStream) tracks.push(...micStream.getAudioTracks());
      const combined = new MediaStream(tracks);
      streamRef.current = combined;

      // Show recording stream in preview
      if (previewRef.current) {
        previewRef.current.srcObject = combined;
        previewRef.current.play().catch(() => {});
      }

      const hasAudio = combined.getAudioTracks().length > 0;
      const candidates = hasAudio
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      let mime = 'video/webm';
      for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }

      const bits = quality === 'high' ? 8e6 : quality === 'medium' ? 4e6 : 2e6;
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: bits });
      } catch {
        recorder = new MediaRecorder(combined);
      }

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setError('Erreur MediaRecorder');
        setState('idle');
      };
      recorder.onstop = async () => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 100) {
          setError('Enregistrement vide. Vérifiez les permissions d’écran.');
          setState('idle');
          return;
        }
        const url = URL.createObjectURL(blob);
        const buffer = await blob.arrayBuffer();

        const probe = document.createElement('video');
        probe.src = url;
        await new Promise<void>((r) => {
          probe.onloadedmetadata = () => r();
          probe.onerror = () => r();
          setTimeout(r, 2000);
        });
        const dur =
          isFinite(probe.duration) && probe.duration > 0 ? probe.duration : Math.max(elapsed, 1);

        addClip({
          type: 'video',
          name: `Capture ${new Date().toLocaleTimeString('fr-FR')}`,
          start: 0,
          duration: dur,
          trimStart: 0,
          src: url,
          sourceDuration: dur,
          track: 0,
          volume: 1,
        });

        const name = `ScreenStudio_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        if (window.electronAPI) {
          await window.electronAPI.saveRecording(buffer, name);
        }

        combined.getTracks().forEach((t) => t.stop());
        screenStream.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        webcamStream?.getTracks().forEach((t) => t.stop());
        canvasStream?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setElapsed(0);
        setState('idle');
        // Restart preview
        setTimeout(() => startPreview(), 200);
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setState('recording');
      stateRef.current = 'recording';
      setElapsed(0);
    } catch (e) {
      console.error(e);
      setError('Échec : ' + String(e));
      setState('idle');
      stateRef.current = 'idle';
      startPreview();
    }
  };

  const pause = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setState('paused');
    }
  };
  const resume = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setState('recording');
    }
  };

  const cancelCountdown = () => {
    cancelRef.current = true;
    setState('idle');
    stateRef.current = 'idle';
    setCount(0);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') {
        if (stateRef.current === 'countdown') cancelCountdown();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (stateRef.current === 'idle') startRecording();
        else if (stateRef.current === 'recording' || stateRef.current === 'paused') stopRecording();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (stateRef.current === 'recording') pause();
        else if (stateRef.current === 'paused') resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const filtered = sources.filter((s) => {
    if (mode === 'window') return s.id.startsWith('window:');
    return s.id.startsWith('screen:');
  });

  const regionStyle =
    region && mode === 'region'
      ? {
          left: `${region.x * 100}%`,
          top: `${region.y * 100}%`,
          width: `${region.w * 100}%`,
          height: `${region.h * 100}%`,
        }
      : drawing && drawStart && drawCur
        ? {
            left: Math.min(drawStart.x, drawCur.x),
            top: Math.min(drawStart.y, drawCur.y),
            width: Math.abs(drawCur.x - drawStart.x),
            height: Math.abs(drawCur.y - drawStart.y),
          }
        : null;

  return (
    <div className="cap">
      <header className="cap-head">
        <div>
          <h1>Capture d’écran</h1>
          <p>Écran · Fenêtre · Zone · Micro · Webcam</p>
        </div>
        <div className="cap-badges">
          {state === 'recording' && (
            <span className="badge rec">● REC {formatTime(elapsed)}</span>
          )}
          {state === 'paused' && <span className="badge pause">PAUSE {formatTime(elapsed)}</span>}
          {state === 'countdown' && <span className="badge rec">Départ dans {count}…</span>}
          {state === 'idle' && <span className="badge ok">Prêt</span>}
        </div>
      </header>

      {error && (
        <div className="cap-error">
          {error}
          <button type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="cap-body">
        <div className="cap-preview-col">
          <div
            className={`cap-preview ${mode === 'region' ? 'draw' : ''}`}
            ref={previewBoxRef}
            onMouseDown={onDrawDown}
            onMouseMove={onDrawMove}
            onMouseUp={onDrawUp}
            onMouseLeave={onDrawUp}
          >
            <video ref={previewRef} autoPlay muted playsInline className="cap-video" />
            {!streamRef.current && state === 'idle' && (
              <div className="cap-placeholder">
                <Monitor size={40} strokeWidth={1.2} />
                <p>Sélectionnez une source</p>
              </div>
            )}
            {webcam && (
              <div className="cap-webcam">
                <video ref={webcamRef} autoPlay muted playsInline />
              </div>
            )}
            {state === 'countdown' && (
              <div className="cap-count-ov">
                <span>{count}</span>
              </div>
            )}
            {regionStyle && mode === 'region' && (
              <div
                className="cap-region"
                style={
                  typeof regionStyle.left === 'string'
                    ? regionStyle
                    : {
                        left: regionStyle.left,
                        top: regionStyle.top,
                        width: regionStyle.width,
                        height: regionStyle.height,
                      }
                }
              />
            )}
            {mode === 'region' && state === 'idle' && (
              <div className="cap-region-hint">
                {region
                  ? `Zone ${(region.w * 100).toFixed(0)}% × ${(region.h * 100).toFixed(0)}% — redessinez pour changer`
                  : 'Cliquez et glissez pour sélectionner une zone'}
              </div>
            )}
          </div>

          {/* BARRE D’ENREGISTREMENT TOUJOURS VISIBLE */}
          <div className="cap-controls">
            {state === 'idle' && (
              <button type="button" className="rec-btn" onClick={startRecording}>
                <Circle size={18} fill="currentColor" />
                Enregistrer
                <kbd>Ctrl+R</kbd>
              </button>
            )}
            {state === 'recording' && (
              <>
                <button type="button" className="ctrl-btn" onClick={pause}>
                  <Pause size={16} /> Pause
                </button>
                <button type="button" className="rec-btn stop" onClick={stopRecording}>
                  <Square size={16} fill="currentColor" /> Arrêter
                </button>
              </>
            )}
            {state === 'paused' && (
              <>
                <button type="button" className="ctrl-btn primary" onClick={resume}>
                  <Play size={16} /> Reprendre
                </button>
                <button type="button" className="rec-btn stop" onClick={stopRecording}>
                  <Square size={16} fill="currentColor" /> Arrêter
                </button>
              </>
            )}
            {state === 'countdown' && (
              <button type="button" className="ctrl-btn" onClick={cancelCountdown}>
                Annuler (Échap) — {count}
              </button>
            )}
          </div>
        </div>

        <aside className="cap-side">
          <div className="card">
            <div className="card-title">Mode</div>
            <div className="modes">
              {(
                [
                  ['screen', Monitor, 'Écran'],
                  ['window', AppWindow, 'Fenêtre'],
                  ['region', Crop, 'Zone'],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`mode ${mode === id ? 'on' : ''}`}
                  onClick={() => {
                    setMode(id);
                    setRegion(null);
                    if (id === 'window' || id === 'screen') {
                      const pref = sources.find((s) =>
                        s.id.startsWith(id === 'window' ? 'window:' : 'screen:')
                      );
                      if (pref) setSourceId(pref.id);
                    } else {
                      const screen = sources.find((s) => s.id.startsWith('screen:'));
                      if (screen) setSourceId(screen.id);
                    }
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Source</div>
            <div className="sources">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`src ${sourceId === s.id ? 'on' : ''}`}
                  onClick={() => setSourceId(s.id)}
                >
                  <img src={s.thumbnail} alt="" />
                  <span>{s.name}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="muted">Aucune source</p>}
            </div>
            <button type="button" className="btn btn-ghost refresh" onClick={loadSources}>
              Actualiser
            </button>
          </div>

          <div className="card">
            <div className="card-title">Options</div>
            <label className="chk">
              <input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} />
              <Mic size={14} /> Microphone
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={systemAudio}
                onChange={(e) => setSystemAudio(e.target.checked)}
              />
              Son système
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={webcam}
                onChange={(e) => setWebcam(e.target.checked)}
              />
              <Video size={14} /> Webcam
            </label>
            <label className="chk">
              <input type="checkbox" defaultChecked />
              <MousePointer2 size={14} /> Curseur
            </label>
          </div>

          <div className="card">
            <div className="card-title">Qualité</div>
            <div className="row">
              <select
                className="select"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)}
              >
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
              <select
                className="select"
                value={quality}
                onChange={(e) => setQuality(e.target.value as 'high' | 'medium' | 'low')}
              >
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Rapide</option>
              </select>
            </div>
            <label className="lbl">Compte à rebours</label>
            <select
              className="select full"
              value={countdownSecs}
              onChange={(e) => setCountdownSecs(Number(e.target.value))}
            >
              <option value={0}>Aucun</option>
              <option value={3}>3 secondes</option>
              <option value={5}>5 secondes</option>
              <option value={10}>10 secondes</option>
            </select>
          </div>
        </aside>
      </div>

      <style>{`
        .cap {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          padding: 16px 20px;
          overflow: hidden;
        }
        .cap-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          flex-shrink: 0;
        }
        .cap-head h1 { font-size: 20px; font-weight: 600; }
        .cap-head p { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
        }
        .badge.rec { background: rgba(248,81,73,0.2); color: #f85149; animation: pulse 1.2s infinite; }
        .badge.pause { background: rgba(210,153,34,0.2); color: #d29922; }
        .badge.ok { background: rgba(63,185,80,0.15); color: #3fb950; }
        @keyframes pulse { 50% { opacity: 0.6; } }

        .cap-error {
          background: rgba(248,81,73,0.15); border: 1px solid #f85149; color: #f85149;
          padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; font-size: 13px;
          display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
        }
        .cap-error button {
          border: none; background: transparent; color: inherit; font-size: 18px; cursor: pointer;
        }

        .cap-body {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 16px;
          flex: 1;
          min-height: 0;
        }
        .cap-preview-col {
          display: flex;
          flex-direction: column;
          min-height: 0;
          gap: 12px;
        }
        .cap-preview {
          position: relative;
          flex: 1;
          min-height: 200px;
          background: #000;
          border-radius: 12px;
          border: 1px solid var(--border);
          overflow: hidden;
        }
        .cap-preview.draw { cursor: crosshair; }
        .cap-video {
          width: 100%; height: 100%; object-fit: contain; display: block;
        }
        .cap-placeholder {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px; color: var(--text-muted);
        }
        .cap-webcam {
          position: absolute; bottom: 12px; right: 12px;
          width: 140px; height: 140px; border-radius: 50%; overflow: hidden;
          border: 3px solid var(--accent); background: #000;
        }
        .cap-webcam video { width: 100%; height: 100%; object-fit: cover; }
        .cap-count-ov {
          position: absolute; inset: 0; background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
        }
        .cap-count-ov span {
          font-size: 120px; font-weight: 700; color: #fff;
          text-shadow: 0 4px 24px rgba(0,0,0,0.5);
        }
        .cap-region {
          position: absolute;
          border: 2px solid #58a6ff;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.35);
          pointer-events: none;
        }
        .cap-region-hint {
          position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.75); color: #fff; font-size: 12px;
          padding: 6px 12px; border-radius: 6px; white-space: nowrap;
        }

        /* CONTROLES TOUJOURS VISIBLES */
        .cap-controls {
          flex: 0 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .rec-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 14px 28px; border: none; border-radius: 10px;
          background: #f85149; color: #fff; font-size: 15px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          box-shadow: 0 4px 16px rgba(248,81,73,0.35);
        }
        .rec-btn:hover { background: #ff6b63; }
        .rec-btn.stop { background: #da3633; }
        .rec-btn kbd {
          font-size: 11px; opacity: 0.85; background: rgba(0,0,0,0.25);
          padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono);
        }
        .ctrl-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 20px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg-tertiary); color: var(--text-primary);
          font-size: 14px; font-family: inherit; cursor: pointer;
        }
        .ctrl-btn.primary { background: var(--accent); color: #0d1117; border-color: transparent; }

        .cap-side {
          overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
        }
        .card {
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: 10px; padding: 14px;
        }
        .card-title {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 10px;
        }
        .modes { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
        .mode {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 4px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--bg-tertiary); color: var(--text-secondary);
          font-size: 11px; font-family: inherit; cursor: pointer;
        }
        .mode.on { border-color: var(--accent); background: var(--accent-muted); color: var(--accent); }
        .sources {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
          max-height: 180px; overflow-y: auto;
        }
        .src {
          border: 2px solid transparent; border-radius: 6px; overflow: hidden;
          padding: 0; background: var(--bg-tertiary); cursor: pointer; text-align: left;
        }
        .src.on { border-color: var(--accent); }
        .src img { width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block; }
        .src span {
          display: block; font-size: 10px; color: var(--text-secondary);
          padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .refresh { width: 100%; margin-top: 8px; font-size: 12px; }
        .chk {
          display: flex; align-items: center; gap: 8px; padding: 6px 0;
          font-size: 13px; color: var(--text-secondary); cursor: pointer;
        }
        .chk input { accent-color: var(--accent); }
        .row { display: flex; gap: 8px; }
        .select { flex: 1; }
        .select.full { width: 100%; }
        .lbl {
          display: block; font-size: 12px; color: var(--text-muted); margin: 10px 0 6px;
        }
        .muted { font-size: 12px; color: var(--text-muted); }
      `}</style>
    </div>
  );
}
