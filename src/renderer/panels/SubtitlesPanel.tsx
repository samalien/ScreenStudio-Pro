/**
 * Subtitles studio — STT, edit, style, translate, SRT/VTT, Arabic RTL.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Languages, Plus, Trash2, Download, Upload, Mic, Wand2,
  Type, Eye, EyeOff,
} from 'lucide-react';
import { useSubtitleStore } from '../stores/subtitleStore';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import {
  STT_PROVIDERS,
  getSTTProvider,
  withIds,
} from '../engine/subtitles/sttProviders';
import { LANGUAGE_LABELS, type SubtitleLanguage } from '../engine/subtitles/types';

export function SubtitlesPanel() {
  const {
    tracks, activeTrackId, selectedCueId, busy, progress,
    createTrack, removeTrack, setActiveTrack, setSelectedCue,
    updateCue, removeCue, addCue, updateTrackStyle, setTrackVisible,
    setCues, importFromTranscript, importSRT, exportSRT, exportVTT,
    translateTrack, setBusy,
  } = useSubtitleStore();
  const { clips, currentTime, duration } = useProjectStore();
  const notify = useUIStore((s) => s.notify);

  const [sttId, setSttId] = useState('energy-vad');
  const [lang, setLang] = useState<SubtitleLanguage>('fr');
  const [targetLang, setTargetLang] = useState<SubtitleLanguage>('en');
  const [transcript, setTranscript] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const track = tracks.find((t) => t.id === activeTrackId) || tracks[0];
  const selected = track?.cues.find((c) => c.id === selectedCueId);

  const audioSourceUrl = useMemo(() => {
    const a = clips.find((c) => c.type === 'audio' && c.src);
    if (a) return a.src;
    const v = clips.find((c) => c.type === 'video' && c.src);
    return v?.src;
  }, [clips]);

  const ensureTrack = () => {
    if (track) return track.id;
    return createTrack(`Sous-titres ${LANGUAGE_LABELS[lang]}`, lang);
  };

  const runSTT = async () => {
    const provider = getSTTProvider(sttId);
    if (!provider) return;
    const id = ensureTrack();
    abortRef.current = new AbortController();
    setBusy(true, 'Transcription…');
    try {
      const result = await provider.transcribe({
        audioUrl: audioSourceUrl,
        language: lang,
        live: sttId === 'webspeech',
        signal: abortRef.current.signal,
        onProgress: (p) => setBusy(true, p.message),
      });
      setCues(id, withIds(result.cues));
      useSubtitleStore.getState().setTrackLanguage(id, result.language);
      notify({
        type: 'success',
        title: 'Transcription terminée',
        message: `${result.cues.length} cue(s) · ${provider.label}`,
      });
    } catch (err: any) {
      notify({ type: 'error', title: 'STT', message: String(err?.message || err) });
    } finally {
      setBusy(false, '');
    }
  };

  const applyTranscript = () => {
    const id = ensureTrack();
    importFromTranscript(id, transcript, duration || 60);
    notify({ type: 'success', title: 'Sous-titres générés depuis le texte' });
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const id = ensureTrack();
    if (file.name.endsWith('.vtt')) {
      // crude: strip WEBVTT header and parse as srt-like
      importSRT(id, text.replace(/^WEBVTT\n*/i, '').replace(/\./g, ','));
    } else {
      importSRT(id, text);
    }
    notify({ type: 'success', title: 'Fichier importé' });
  };

  const doTranslate = async () => {
    if (!track) {
      notify({ type: 'warning', title: 'Créez une piste d’abord' });
      return;
    }
    try {
      const newId = await translateTrack(track.id, targetLang);
      notify({
        type: 'success',
        title: 'Traduction créée',
        message: newId ? `Nouvelle piste ${targetLang}` : '',
      });
    } catch (err: any) {
      notify({ type: 'error', title: 'Traduction', message: String(err?.message || err) });
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Languages size={18} color="var(--accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Sous-titres & traduction</h1>
        </div>
        <p className="text-secondary text-sm">
          Transcription, édition, style, arabe RTL, export SRT/VTT, incrustation preview & export.
        </p>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {/* Tracks */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div className="card-title" style={{ margin: 0 }}>Pistes</div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => createTrack(`Sous-titres ${LANGUAGE_LABELS[lang]}`, lang)}
            >
              <Plus size={14} /> Nouvelle piste
            </button>
          </div>
          {tracks.length === 0 ? (
            <p className="text-muted text-sm">Aucune piste — créez-en une ou lancez une transcription.</p>
          ) : (
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {tracks.map((t) => (
                <button
                  key={t.id}
                  className={`btn btn-sm ${activeTrackId === t.id || (!activeTrackId && track?.id === t.id) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTrack(t.id)}
                >
                  {t.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  {t.label} ({t.cues.length})
                </button>
              ))}
            </div>
          )}
          {track && (
            <div className="flex gap-2 mt-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setTrackVisible(track.id, !track.visible)}
              >
                {track.visible ? 'Masquer' : 'Afficher'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => removeTrack(track.id)}>
                <Trash2 size={12} /> Supprimer piste
              </button>
            </div>
          )}
        </div>

        {/* STT */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">Reconnaissance vocale</div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            <select
              className="input"
              style={{ width: 220 }}
              value={sttId}
              onChange={(e) => setSttId(e.target.value)}
            >
              {STT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.remote ? ' (réseau)' : ''}
                </option>
              ))}
            </select>
            <select
              className="input"
              style={{ width: 140 }}
              value={lang}
              onChange={(e) => setLang(e.target.value as SubtitleLanguage)}
            >
              {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={busy} onClick={runSTT}>
              {sttId === 'webspeech' ? <Mic size={14} /> : <Wand2 size={14} />}
              {busy ? progress || '…' : 'Lancer'}
            </button>
            {busy && (
              <button
                className="btn btn-secondary"
                onClick={() => abortRef.current?.abort()}
              >
                Stop
              </button>
            )}
          </div>
          <p className="text-muted text-xs">
            • Segments : découpe automatique selon l’énergie audio (à remplir manuellement)
            <br />• Web Speech : micro en direct (Chromium)
            <br />• Whisper API : clé dans localStorage <code>ssp_stt_api_key</code>
          </p>
          {!audioSourceUrl && (
            <p className="text-sm" style={{ color: 'var(--warning)', marginTop: 6 }}>
              Aucun média audio/vidéo dans le projet — importez un fichier pour la détection de segments.
            </p>
          )}
        </div>

        {/* Manual transcript */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">Texte → sous-titres</div>
          <textarea
            className="input"
            rows={4}
            placeholder="Collez une transcription complète…"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            style={{ width: '100%', resize: 'vertical', marginBottom: 8 }}
            dir="auto"
          />
          <button className="btn btn-secondary" onClick={applyTranscript} disabled={!transcript.trim()}>
            <Type size={14} /> Générer les cues (durée projet)
          </button>
        </div>

        {/* Cue list + editor */}
        {track && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>
                Cues ({track.cues.length})
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() =>
                  addCue(track.id, {
                    start: currentTime,
                    end: currentTime + 2,
                    text: '',
                  })
                }
              >
                <Plus size={12} /> Cue à {currentTime.toFixed(1)}s
              </button>
            </div>
            <div style={{ maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
              {track.cues.map((c) => (
                <button
                  key={c.id}
                  className={`btn btn-ghost ${selectedCueId === c.id ? 'btn-primary' : ''}`}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    marginBottom: 2,
                    direction: c.language === 'ar' ? 'rtl' : 'ltr',
                  }}
                  onClick={() => setSelectedCue(c.id)}
                >
                  <span className="text-muted text-xs" style={{ minWidth: 90 }}>
                    {c.start.toFixed(1)}–{c.end.toFixed(1)}
                  </span>
                  <span className="truncate">{c.text || '…'}</span>
                </button>
              ))}
            </div>

            {selected && (
              <div>
                <div className="label">Texte</div>
                <textarea
                  className="input"
                  rows={3}
                  dir="auto"
                  value={selected.text}
                  onChange={(e) => updateCue(track.id, selected.id, { text: e.target.value })}
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  <label className="text-xs">
                    Début
                    <input
                      className="input"
                      type="number"
                      step={0.1}
                      value={selected.start}
                      onChange={(e) =>
                        updateCue(track.id, selected.id, { start: Number(e.target.value) })
                      }
                      style={{ width: 90, marginLeft: 6 }}
                    />
                  </label>
                  <label className="text-xs">
                    Fin
                    <input
                      className="input"
                      type="number"
                      step={0.1}
                      value={selected.end}
                      onChange={(e) =>
                        updateCue(track.id, selected.id, { end: Number(e.target.value) })
                      }
                      style={{ width: 90, marginLeft: 6 }}
                    />
                  </label>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeCue(track.id, selected.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Style */}
        {track && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Style</div>
            <div className="slider-row">
              <label>
                <span>Taille</span>
                <span>{track.style.fontSize}px</span>
              </label>
              <input
                type="range"
                min={20}
                max={96}
                value={track.style.fontSize}
                onChange={(e) => updateTrackStyle(track.id, { fontSize: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
              <label className="text-xs">
                Couleur
                <input
                  type="color"
                  value={track.style.color}
                  onChange={(e) => updateTrackStyle(track.id, { color: e.target.value })}
                  style={{ marginLeft: 6 }}
                />
              </label>
              <label className="text-xs">
                Contour
                <input
                  type="checkbox"
                  checked={track.style.outline}
                  onChange={(e) => updateTrackStyle(track.id, { outline: e.target.checked })}
                  style={{ marginLeft: 6 }}
                />
              </label>
              <label className="text-xs">
                Ombre
                <input
                  type="checkbox"
                  checked={track.style.shadow}
                  onChange={(e) => updateTrackStyle(track.id, { shadow: e.target.checked })}
                  style={{ marginLeft: 6 }}
                />
              </label>
              <select
                className="input"
                style={{ width: 140 }}
                value={track.style.animation}
                onChange={(e) =>
                  updateTrackStyle(track.id, { animation: e.target.value as any })
                }
              >
                <option value="none">Sans anim</option>
                <option value="fade">Fondu</option>
                <option value="pop">Pop</option>
                <option value="slide-up">Slide up</option>
              </select>
              <select
                className="input"
                style={{ width: 100 }}
                value={track.style.direction}
                onChange={(e) =>
                  updateTrackStyle(track.id, { direction: e.target.value as any })
                }
              >
                <option value="auto">Dir auto</option>
                <option value="ltr">LTR</option>
                <option value="rtl">RTL</option>
              </select>
              <select
                className="input"
                style={{ width: 120 }}
                value={track.style.align}
                onChange={(e) =>
                  updateTrackStyle(track.id, { align: e.target.value as any })
                }
              >
                <option value="center">Centre</option>
                <option value="left">Gauche</option>
                <option value="right">Droite</option>
              </select>
            </div>
            <div className="slider-row">
              <label>
                <span>Position verticale</span>
                <span>{Math.round(track.style.positionY * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.01}
                value={track.style.positionY}
                onChange={(e) =>
                  updateTrackStyle(track.id, { positionY: Number(e.target.value) })
                }
              />
            </div>
          </div>
        )}

        {/* Translate + export */}
        <div className="card">
          <div className="card-title">
            <Languages size={14} /> Traduction & export
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            <select
              className="input"
              style={{ width: 160 }}
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as SubtitleLanguage)}
            >
              {Object.entries(LANGUAGE_LABELS)
                .filter(([k]) => k !== 'auto')
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
            <button className="btn btn-primary" disabled={!track || busy} onClick={doTranslate}>
              Traduire la piste
            </button>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              disabled={!track}
              onClick={() => track && exportSRT(track.id)}
            >
              <Download size={14} /> SRT
            </button>
            <button
              className="btn btn-secondary"
              disabled={!track}
              onClick={() => track && exportVTT(track.id)}
            >
              <Download size={14} /> VTT
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Import SRT/VTT
              <input
                type="file"
                accept=".srt,.vtt,text/plain"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
