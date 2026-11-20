/**
 * Unified generative AI studio.
 * Never pretends success without a real provider response.
 */

import React, { useMemo, useState } from 'react';
import {
  Sparkles, Settings2, Play, Square,
  Download, PlusCircle, AlertTriangle, Loader2, Key,
} from 'lucide-react';
import { useAIStore } from '../stores/aiStore';
import { useProjectStore } from '../stores/projectStore';
import { useMediaLibraryStore } from '../stores/mediaLibraryStore';
import { useUIStore } from '../stores/uiStore';
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  type AICapability,
  type AIProviderId,
} from '../engine/ai/types';
import { ALL_PROVIDERS } from '../engine/ai/providers';
import { defaultAudioSettings, defaultEffects } from '../engine/types';
import { computeWaveform } from '../engine/audioEngine';

const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

export function AIPanel() {
  const {
    configs,
    jobs,
    spentUsd,
    selectedCapability,
    selectedProviderId,
    setCapability,
    setProviderId,
    updateConfig,
    saveAllConfigs,
    resolveProvider,
    runJob,
    cancelJob,
  } = useAIStore();
  const { addClip, currentTime, clips } = useProjectStore();
  const { addImported } = useMediaLibraryStore();
  const notify = useUIStore((s) => s.notify);
  const setView = useUIStore((s) => s.setView);

  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState('');
  const [language, setLanguage] = useState('fr');
  const [voiceId, setVoiceId] = useState('alloy');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [running, setRunning] = useState(false);

  const resolved = resolveProvider(selectedCapability);
  const mediaSources = useMemo(
    () => clips.filter((c) => c.src && (c.type === 'video' || c.type === 'image' || c.type === 'audio')),
    [clips]
  );

  const providersForCap = ALL_PROVIDERS.filter((p) =>
    p.capabilities.includes(selectedCapability)
  );

  const importResultToTimeline = async (jobId: string) => {
    const job = useAIStore.getState().jobs.find((j) => j.id === jobId);
    if (!job?.result || job.status !== 'succeeded') return;
    const r = job.result;

    if (r.type === 'image' && r.url) {
      addImported({
        id: `ai-${jobId}`,
        name: `IA image ${new Date().toLocaleTimeString('fr-FR')}`,
        kind: 'image',
        src: r.url,
        duration: 5,
        width: r.width,
        height: r.height,
      } as any);
      addClip({
        type: 'image',
        name: 'IA · image',
        start: currentTime,
        duration: 5,
        trimStart: 0,
        src: r.url,
        sourceDuration: 5,
        track: 0,
        volume: 1,
        width: r.width,
        height: r.height,
      } as any);
      notify({ type: 'success', title: 'Image ajoutée à la timeline' });
      setView('editor');
      return;
    }

    if (r.type === 'video' && r.url) {
      addClip({
        type: 'video',
        name: 'IA · vidéo',
        start: currentTime,
        duration: r.duration || 4,
        trimStart: 0,
        src: r.url,
        sourceDuration: r.duration || 4,
        track: 0,
        volume: 1,
      } as any);
      notify({ type: 'success', title: 'Vidéo ajoutée à la timeline' });
      setView('editor');
      return;
    }

    if (r.type === 'audio' && r.url) {
      let duration = r.duration || 5;
      try {
        const peaks = await computeWaveform(r.url, 64);
        addClip({
          type: 'audio',
          name: 'IA · voix',
          start: currentTime,
          duration,
          trimStart: 0,
          src: r.url,
          sourceDuration: duration,
          track: 2,
          volume: 1,
          waveform: peaks,
          audio: defaultAudioSettings(),
          effects: defaultEffects(),
        } as any);
      } catch {
        addClip({
          type: 'audio',
          name: 'IA · voix',
          start: currentTime,
          duration,
          trimStart: 0,
          src: r.url,
          sourceDuration: duration,
          track: 2,
          volume: 1,
        } as any);
      }
      notify({ type: 'success', title: 'Audio ajouté à la timeline' });
      setView('editor');
      return;
    }

    if (r.type === 'text' && r.text) {
      try {
        await navigator.clipboard.writeText(r.text);
      } catch {
        /* */
      }
      notify({ type: 'success', title: 'Texte copié dans le presse-papiers' });
    }
  };

  const launch = async () => {
    setRunning(true);
    try {
      const job = await runJob(
        {
          capability: selectedCapability,
          prompt: prompt.trim() || undefined,
          negativePrompt: negative.trim() || undefined,
          sourceUrl: sourceUrl || undefined,
          language,
          voiceId,
          width: 1024,
          height: 1024,
          durationSec: 4,
        },
        selectedProviderId
      );

      if (job.status === 'succeeded') {
        notify({
          type: 'success',
          title: 'Génération terminée',
          message: `${CAPABILITY_LABELS[job.capability]} · ${job.providerId}`,
        });
      } else if (job.status === 'needs_config') {
        notify({ type: 'warning', title: 'Configuration requise', message: job.error });
        setShowSettings(true);
      } else if (job.status === 'failed') {
        notify({ type: 'error', title: 'Échec IA', message: job.error });
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <div className="flex items-center gap-2">
            <Sparkles size={18} color="var(--purple)" />
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Studio IA générative</h1>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings2 size={14} /> {showSettings ? 'Création' : 'Clés API'}
          </button>
        </div>
        <p className="text-secondary text-sm">
          Fournisseurs branchables (OpenAI, Stability, ElevenLabs, Replicate, navigateur). Aucun
          résultat n’est inventé sans réponse réelle du service.
        </p>
        <div className="text-muted text-xs" style={{ marginTop: 4 }}>
          Coût estimé cumulé (local) : ${spentUsd.toFixed(3)}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        {showSettings ? (
          <div className="card">
            <div className="card-title">
              <Key size={14} /> Configuration des fournisseurs
            </div>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Les clés sont stockées uniquement dans le localStorage de cette machine.
            </p>
            {configs.map((c) => (
              <div
                key={c.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <strong>{c.label}</strong>
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => updateConfig(c.id, { enabled: e.target.checked })}
                    />
                    Actif
                  </label>
                </div>
                {c.id !== 'browser' && (
                  <input
                    className="input"
                    type="password"
                    placeholder={`Clé API ${c.label}`}
                    value={c.apiKey || ''}
                    onChange={(e) => updateConfig(c.id, { apiKey: e.target.value })}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                )}
                {c.id === 'openai' && (
                  <input
                    className="input"
                    placeholder="Base URL (optionnel)"
                    value={c.baseUrl || ''}
                    onChange={(e) => updateConfig(c.id, { baseUrl: e.target.value })}
                    style={{ width: '100%', marginBottom: 6 }}
                  />
                )}
                <div className="text-muted text-xs">
                  Capacités : {c.capabilities.map((x) => CAPABILITY_LABELS[x]).join(' · ')}
                </div>
              </div>
            ))}
            <button
              className="btn btn-primary"
              onClick={() => {
                saveAllConfigs();
                notify({ type: 'success', title: 'Configuration enregistrée' });
              }}
            >
              Enregistrer les clés
            </button>
          </div>
        ) : (
          <>
            {CAPABILITY_GROUPS.map((g) => (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <div className="text-xs text-muted" style={{ marginBottom: 6, fontWeight: 600 }}>
                  {g.label}
                </div>
                <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                  {g.items.map((cap) => (
                    <button
                      key={cap}
                      className={`btn btn-sm ${selectedCapability === cap ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCapability(cap)}
                    >
                      {CAPABILITY_LABELS[cap]}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-title">Paramètres — {CAPABILITY_LABELS[selectedCapability]}</div>

              <div className="label">Fournisseur</div>
              <select
                className="input"
                style={{ width: '100%', marginBottom: 10 }}
                value={selectedProviderId}
                onChange={(e) => setProviderId(e.target.value as AIProviderId | 'auto')}
              >
                <option value="auto">Auto (premier configuré)</option>
                {providersForCap.map((p) => {
                  const cfg = configs.find((c) => c.id === p.id);
                  const ok = cfg && (p.id === 'browser' || !!cfg.apiKey);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {!ok ? ' — clé manquante' : ''}
                    </option>
                  );
                })}
              </select>

              {resolved ? (
                <div className="text-xs" style={{ marginBottom: 8, color: 'var(--success)' }}>
                  Prêt : {resolved.config.label}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ marginBottom: 8, color: 'var(--warning)' }}
                >
                  <AlertTriangle size={14} />
                  Aucun fournisseur prêt — configurez une clé API.
                </div>
              )}

              <div className="label">Prompt / texte</div>
              <textarea
                className="input"
                rows={4}
                dir="auto"
                placeholder="Décrivez ce que vous voulez générer…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
              />

              {(selectedCapability === 'text-to-image' ||
                selectedCapability === 'image-to-image') && (
                <>
                  <div className="label">Prompt négatif (optionnel)</div>
                  <input
                    className="input"
                    value={negative}
                    onChange={(e) => setNegative(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </>
              )}

              {selectedCapability === 'text-to-speech' && (
                <>
                  <div className="label">Voix</div>
                  <select
                    className="input"
                    style={{ width: '100%', marginBottom: 8 }}
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                  >
                    {OPENAI_VOICES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <div className="label">Langue</div>
                  <select
                    className="input"
                    style={{ width: '100%', marginBottom: 8 }}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                    <option value="es">Español</option>
                  </select>
                </>
              )}

              {(selectedCapability === 'image-to-video' ||
                selectedCapability === 'image-to-image' ||
                selectedCapability === 'bg-remove' ||
                selectedCapability === 'upscale' ||
                selectedCapability === 'speech-to-text' ||
                selectedCapability === 'scene-detect' ||
                selectedCapability === 'lip-sync') && (
                <>
                  <div className="label">Source (média projet ou URL)</div>
                  <select
                    className="input"
                    style={{ width: '100%', marginBottom: 6 }}
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  >
                    <option value="">—</option>
                    {mediaSources.map((m) => (
                      <option key={m.id} value={m.src}>
                        {m.name} ({m.type})
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Ou collez une URL https…"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                </>
              )}

              <button className="btn btn-primary" disabled={running} onClick={launch}>
                {running ? <Loader2 size={14} /> : <Play size={14} />}
                Lancer la génération
              </button>
            </div>

            <div className="card">
              <div className="card-title">Tâches</div>
              {jobs.length === 0 ? (
                <p className="text-muted text-sm">Aucune tâche pour l’instant.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {jobs.slice(0, 12).map((j) => (
                    <div
                      key={j.id}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-sm">{CAPABILITY_LABELS[j.capability]}</strong>
                        <span className="text-xs text-muted">
                          {j.providerId} · {j.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted">{j.message}</div>
                      {j.status === 'running' && (
                        <div
                          style={{
                            height: 4,
                            background: 'var(--border)',
                            borderRadius: 2,
                            marginTop: 6,
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.round(j.progress * 100)}%`,
                              height: '100%',
                              background: 'var(--accent)',
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      )}
                      {j.error && (
                        <div className="text-xs" style={{ color: 'var(--danger)', marginTop: 4 }}>
                          {j.error}
                        </div>
                      )}
                      {j.status === 'succeeded' && j.result && (
                        <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                          {j.result.url && j.result.type === 'image' && (
                            <img
                              src={j.result.url}
                              alt=""
                              style={{
                                maxWidth: 160,
                                maxHeight: 100,
                                borderRadius: 6,
                                objectFit: 'cover',
                              }}
                            />
                          )}
                          {j.result.url && j.result.type === 'audio' && (
                            <audio src={j.result.url} controls style={{ height: 32 }} />
                          )}
                          {j.result.url && j.result.type === 'video' && (
                            <video
                              src={j.result.url}
                              controls
                              style={{ maxWidth: 200, maxHeight: 120 }}
                            />
                          )}
                          {j.result.text && (
                            <pre
                              className="text-xs"
                              style={{
                                whiteSpace: 'pre-wrap',
                                maxHeight: 120,
                                overflow: 'auto',
                                margin: 0,
                                flex: 1,
                              }}
                            >
                              {j.result.text}
                            </pre>
                          )}
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => importResultToTimeline(j.id)}
                          >
                            <PlusCircle size={12} /> Ajouter / copier
                          </button>
                          {j.result.url && (
                            <a
                              className="btn btn-sm btn-secondary"
                              href={j.result.url}
                              download
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download size={12} />
                            </a>
                          )}
                        </div>
                      )}
                      {j.status === 'running' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 4 }}
                          onClick={() => cancelJob(j.id)}
                        >
                          <Square size={12} /> Annuler
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
