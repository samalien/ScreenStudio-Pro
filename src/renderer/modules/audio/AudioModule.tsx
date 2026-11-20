import React, { useRef, useState } from 'react';
import { Volume2, Mic, Music, Activity, Upload, Square, Circle, Waves } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

export function AudioModule() {
  const { clips, selectedClipId, currentTime, addClip, updateClip, setSelectedClipId } =
    useProjectStore();
  const audioClips = clips.filter((c) => c.type === 'audio' || c.type === 'video');
  const selected = clips.find((c) => c.id === selectedClipId);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const importAudio = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      let offset = currentTime;
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const audio = document.createElement('audio');
        audio.src = url;
        audio.preload = 'metadata';
        await new Promise<void>((r) => {
          audio.onloadedmetadata = () => r();
          audio.onerror = () => r();
          setTimeout(r, 3000);
        });
        const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
        addClip({
          type: 'audio',
          name: file.name,
          start: offset,
          duration: dur,
          trimStart: 0,
          src: url,
          sourceDuration: dur,
          track: 2,
          volume: 0.7,
        });
        offset += dur;
      }
    };
    input.click();
  };

  const startVoiceOver = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const duration = Math.max(elapsed, 1);
        addClip({
          type: 'audio',
          name: `Voice-over ${new Date().toLocaleTimeString('fr-FR')}`,
          start: currentTime,
          duration,
          trimStart: 0,
          src: url,
          sourceDuration: duration,
          track: 2,
          volume: 1,
        });
        setElapsed(0);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      alert('Micro inaccessible : ' + String(err));
    }
  };

  const stopVoiceOver = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  const applyFadePreset = (fadeIn: number, fadeOut: number) => {
    if (!selected) return;
    updateClip(selected.id, { fadeIn, fadeOut });
  };

  return (
    <div className="audio-module">
      <div className="audio-header">
        <div>
          <h1>Module Audio</h1>
          <p className="text-secondary text-sm">Musique, voice-over, volume et fondus</p>
        </div>
      </div>

      <div className="audio-grid">
        <div className="card">
          <div className="card-title">
            <Upload size={14} style={{ marginRight: 6 }} /> Importer de l’audio
          </div>
          <p className="text-muted text-sm mb-2">MP3, WAV, OGG, M4A sur la piste Audio.</p>
          <button className="btn btn-primary" onClick={importAudio}>
            <Music size={16} /> Importer musique / SFX
          </button>
        </div>

        <div className="card">
          <div className="card-title">
            <Mic size={14} style={{ marginRight: 6 }} /> Voice-over
          </div>
          <p className="text-muted text-sm mb-2">Enregistre le micro sur la timeline.</p>
          {!recording ? (
            <button className="btn btn-danger" onClick={startVoiceOver}>
              <Circle size={14} fill="currentColor" /> Enregistrer voice-over
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={stopVoiceOver}>
              <Square size={14} fill="currentColor" /> Arrêter ({elapsed}s)
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <Volume2 size={14} style={{ marginRight: 6 }} /> Clip sélectionné
          </div>
          {!selected ? (
            <p className="text-muted text-sm">Sélectionnez un clip dans Montage.</p>
          ) : (
            <>
              <p className="text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
              <label className="text-sm text-secondary">Volume</label>
              <input
                type="range" min={0} max={1} step={0.05} value={selected.volume}
                onChange={(e) => updateClip(selected.id, { volume: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div className="flex gap-2 mt-3">
                <button className="btn btn-ghost" onClick={() => applyFadePreset(0.5, 0.5)}>Fade 0.5s</button>
                <button className="btn btn-ghost" onClick={() => applyFadePreset(1, 1)}>Fade 1s</button>
                <button className="btn btn-ghost" onClick={() => applyFadePreset(0, 0)}>Sans fade</button>
              </div>
              <div className="mt-3">
                <label className="text-sm text-secondary">Fade in (s)</label>
                <input className="input" type="number" min={0} max={10} step={0.1} value={selected.fadeIn}
                  onChange={(e) => updateClip(selected.id, { fadeIn: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div className="mt-2">
                <label className="text-sm text-secondary">Fade out (s)</label>
                <input className="input" type="number" min={0} max={10} step={0.1} value={selected.fadeOut}
                  onChange={(e) => updateClip(selected.id, { fadeOut: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 4 }} />
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <Activity size={14} style={{ marginRight: 6 }} /> Pistes du projet
          </div>
          <div className="clip-list">
            {audioClips.length === 0 && <p className="text-muted text-sm">Aucune piste.</p>}
            {audioClips.map((c) => (
              <button key={c.id} className={`clip-pick ${selectedClipId === c.id ? 'active' : ''}`}
                onClick={() => setSelectedClipId(c.id)}>
                {c.type === 'audio' ? <Waves size={14} /> : <Volume2 size={14} />}
                <span>{c.name}<small> · {c.duration.toFixed(1)}s · vol {(c.volume * 100).toFixed(0)}%</small></span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .audio-module { padding: 24px; height: 100%; overflow: auto; }
        .audio-header { margin-bottom: 20px; }
        .audio-header h1 { font-size: 22px; font-weight: 600; }
        .audio-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 960px; }
        .clip-list { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow: auto; }
        .clip-pick {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius);
          color: var(--text-secondary); cursor: pointer; font-size: 13px; font-family: inherit; text-align: left;
        }
        .clip-pick small { color: var(--text-muted); font-size: 11px; }
        .clip-pick.active { border-color: var(--accent); background: var(--accent-muted); color: var(--accent); }
      `}</style>
    </div>
  );
}
