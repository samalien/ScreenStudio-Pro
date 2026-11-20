/**
 * Professional audio studio panel — import, record, extract, effects, mix controls.
 */

import React, { useState, useRef } from 'react';
import {
  Mic, Upload, Music, Volume2, Scissors,
  Sparkles, Square, Film,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useMediaLibraryStore } from '../stores/mediaLibraryStore';
import { useUIStore } from '../stores/uiStore';
import {
  importFiles, openFilePicker, mediaToClip, ACCEPT_ALL_MEDIA,
} from '../engine/mediaImport';
import {
  computeWaveform, extractAudioFromVideo, recordMicrophone, resumeAudio,
} from '../engine/audioEngine';
import { AUDIO_EFFECT_PRESETS, applyAudioPreset } from '../engine/audioLibrary';
import { defaultAudioSettings } from '../engine/types';

export function AudioStudioPanel() {
  const {
    clips, selectedClipId, currentTime, addClip, updateClip, splitClip,
    mergeClips, setSelectedClipId, setClipSpeed,
  } = useProjectStore();
  const { addImported } = useMediaLibraryStore();
  const notify = useUIStore((s) => s.notify);
  const setView = useUIStore((s) => s.setView);

  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const stopSignal = useRef({ stopped: false });
  const recTimer = useRef<number | null>(null);

  const audioClips = clips.filter((c) => c.type === 'audio' || c.type === 'video');
  const selected = clips.find((c) => c.id === selectedClipId);
  const audio =
    selected?.audio ||
    (selected && (selected.type === 'audio' || selected.type === 'video')
      ? defaultAudioSettings()
      : null);

  const importAudio = async () => {
    try {
      await resumeAudio();
      const files = await openFilePicker('audio/*,.mp3,.wav,.aac,.ogg,.flac,.m4a', true);
      if (!files.length) return;
      const imported = await importFiles(files);
      let offset = currentTime;
      for (const m of imported) {
        if (m.kind !== 'audio' && m.kind !== 'video') continue;
        const peaks = await computeWaveform(m.src, 96);
        m.waveform = peaks;
        addImported(m);
        const data = mediaToClip(m, offset, 2);
        addClip({ ...data, waveform: peaks, audio: defaultAudioSettings() } as any);
        offset += m.duration || 5;
      }
      notify({ type: 'success', title: 'Audio importé' });
      setView('editor');
    } catch (err: any) {
      notify({ type: 'error', title: 'Import audio', message: String(err?.message || err) });
    }
  };

  const startRec = async () => {
    try {
      await resumeAudio();
      stopSignal.current = { stopped: false };
      setRecording(true);
      setRecElapsed(0);
      const t0 = Date.now();
      recTimer.current = window.setInterval(() => setRecElapsed((Date.now() - t0) / 1000), 200);
      const result = await recordMicrophone(() => {}, stopSignal.current);
      if (recTimer.current) clearInterval(recTimer.current);
      setRecording(false);
      const peaks = await computeWaveform(result.url, 96);
      addClip({
        type: 'audio',
        name: `Voix off ${new Date().toLocaleTimeString('fr-FR')}`,
        start: currentTime,
        duration: result.duration,
        trimStart: 0,
        src: result.url,
        sourceDuration: result.duration,
        track: 2,
        volume: 1,
        waveform: peaks,
        audio: defaultAudioSettings(),
      } as any);
      notify({ type: 'success', title: 'Voix off enregistrée', message: `${result.duration.toFixed(1)}s` });
      setView('editor');
    } catch (err: any) {
      setRecording(false);
      if (recTimer.current) clearInterval(recTimer.current);
      notify({ type: 'error', title: 'Micro inaccessible', message: String(err?.message || err) });
    }
  };

  const stopRec = () => {
    stopSignal.current.stopped = true;
  };

  const extractFromSelectedVideo = async () => {
    if (!selected || selected.type !== 'video' || !selected.src) {
      notify({ type: 'warning', title: 'Sélectionnez un clip vidéo' });
      return;
    }
    try {
      notify({ type: 'info', title: 'Extraction audio…' });
      const result = await extractAudioFromVideo(selected.src);
      if (!result) {
        notify({ type: 'error', title: 'Impossible d’extraire l’audio' });
        return;
      }
      const peaks = await computeWaveform(result.url, 96);
      addClip({
        type: 'audio',
        name: `Audio · ${selected.name}`,
        start: selected.start,
        duration: Math.min(result.duration, selected.duration),
        trimStart: 0,
        src: result.url,
        sourceDuration: result.duration,
        track: 4,
        volume: 1,
        waveform: peaks,
        audio: defaultAudioSettings(),
      } as any);
      notify({ type: 'success', title: 'Piste audio extraite' });
      setView('editor');
    } catch (err: any) {
      notify({ type: 'error', title: 'Extraction échouée', message: String(err?.message || err) });
    }
  };

  const patchAudio = (partial: Partial<NonNullable<typeof audio>>) => {
    if (!selected) return;
    updateClip(selected.id, {
      audio: { ...(selected.audio || defaultAudioSettings()), ...partial },
    });
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 28px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Music size={20} color="var(--success)" />
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Studio audio</h1>
        </div>
        <p className="text-secondary text-sm" style={{ marginBottom: 20 }}>
          Import, voix off, extraction, EQ, noise gate, réverb — mixées sur la timeline et dans l’export
          via Web Audio API.
        </p>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={importAudio}>
            <Upload size={14} /> Importer audio
          </button>
          {!recording ? (
            <button className="btn btn-secondary" onClick={startRec}>
              <Mic size={14} /> Enregistrer voix off
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stopRec}>
              <Square size={14} /> Stop ({recElapsed.toFixed(1)}s)
            </button>
          )}
          <button className="btn btn-secondary" onClick={extractFromSelectedVideo}>
            <Film size={14} /> Extraire de la vidéo
          </button>
          <button
            className="btn btn-secondary"
            disabled={!selectedClipId}
            onClick={() => selectedClipId && splitClip(selectedClipId, currentTime)}
          >
            <Scissors size={14} /> Découper (S)
          </button>
        </div>

        {/* Clip list */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Pistes audio / vidéo avec son ({audioClips.length})</div>
          {audioClips.length === 0 ? (
            <p className="text-muted text-sm">Aucun clip audio. Importez ou enregistrez.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {audioClips.map((c) => (
                <button
                  key={c.id}
                  className={`btn ${selectedClipId === c.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setSelectedClipId(c.id)}
                >
                  <Volume2 size={14} />
                  <span className="truncate">{c.name}</span>
                  <span className="text-muted text-xs" style={{ marginLeft: 'auto' }}>
                    {c.duration.toFixed(1)}s · vol {Math.round((c.volume || 0) * 100)}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mixer for selected */}
        {selected && audio && (selected.type === 'audio' || selected.type === 'video') && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Mix — {selected.name}</div>
            <div className="slider-row">
              <label>
                <span>Volume</span>
                <span>{Math.round((selected.volume || 0) * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={selected.volume ?? 1}
                onChange={(e) => updateClip(selected.id, { volume: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Balance (pan)</span>
                <span>{(audio.pan || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={audio.pan || 0}
                onChange={(e) => patchAudio({ pan: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Fade in</span>
                <span>{(selected.fadeIn || 0).toFixed(1)}s</span>
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={selected.fadeIn || 0}
                onChange={(e) => updateClip(selected.id, { fadeIn: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Fade out</span>
                <span>{(selected.fadeOut || 0).toFixed(1)}s</span>
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={selected.fadeOut || 0}
                onChange={(e) => updateClip(selected.id, { fadeOut: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Vitesse</span>
                <span>{(selected.speed || 1).toFixed(2)}×</span>
              </label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={selected.speed || 1}
                onChange={(e) => setClipSpeed(selected.id, Number(e.target.value))}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Pitch (demi-tons)</span>
                <span>{audio.pitch || 0}</span>
              </label>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={audio.pitch || 0}
                onChange={(e) => patchAudio({ pitch: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Basses (EQ)</span>
                <span>{(audio.lowGain || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={audio.lowGain || 0}
                onChange={(e) => patchAudio({ lowGain: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Médiums</span>
                <span>{(audio.midGain || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={audio.midGain || 0}
                onChange={(e) => patchAudio({ midGain: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Aigus</span>
                <span>{(audio.highGain || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={audio.highGain || 0}
                onChange={(e) => patchAudio({ highGain: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Noise gate</span>
                <span>{(audio.noiseGate || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audio.noiseGate || 0}
                onChange={(e) => patchAudio({ noiseGate: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Réverbération</span>
                <span>{(audio.reverb || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audio.reverb || 0}
                onChange={(e) => patchAudio({ reverb: Number(e.target.value) })}
              />
            </div>
            <div className="slider-row">
              <label>
                <span>Écho</span>
                <span>{(audio.echo || 0).toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audio.echo || 0}
                onChange={(e) => patchAudio({ echo: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!audio.normalize}
                onChange={(e) => patchAudio({ normalize: e.target.checked })}
              />
              Normalisation peak
            </label>
          </div>
        )}

        {/* Effects library */}
        <div className="card">
          <div className="card-title">
            <Sparkles size={14} /> Bibliothèque d’effets audio
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
              gap: 8,
            }}
          >
            {AUDIO_EFFECT_PRESETS.map((p) => (
              <button
                key={p.id}
                className="btn btn-secondary"
                style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: 10 }}
                disabled={!selected || (selected.type !== 'audio' && selected.type !== 'video')}
                onClick={() => {
                  if (!selected) return;
                  updateClip(selected.id, {
                    audio: applyAudioPreset(selected.audio, p),
                  });
                  notify({ type: 'success', title: p.name });
                }}
              >
                <strong style={{ fontSize: 12 }}>{p.name}</strong>
                <span className="text-muted" style={{ fontSize: 10 }}>
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
