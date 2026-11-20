/**
 * Professional effects library — browse presets, apply to selected clip,
 * with live-oriented cards and category tabs.
 */

import React, { useState } from 'react';
import { Sparkles, RotateCcw, Wand2 } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import {
  EFFECT_CATEGORIES,
  EFFECT_PRESETS,
  applyPresetToEffects,
  getPresetById,
  type EffectCategory,
  type EffectPreset,
} from '../engine/effectsLibrary';
import { buildMotionKeyframes } from '../engine/playback';
import { defaultEffects } from '../engine/types';
import { v4 as uuidv4 } from 'uuid';

export function EffectsLibraryPanel() {
  const { clips, selectedClipId, updateEffects, updateClip, setSelectedClipId } =
    useProjectStore();
  const notify = useUIStore((s) => s.notify);
  const [category, setCategory] = useState<EffectCategory | 'all'>('filters');
  const selected = clips.find((c) => c.id === selectedClipId);
  const videoClips = clips.filter((c) => c.type === 'video' || c.type === 'image' || c.type === 'text');

  const list =
    category === 'all'
      ? EFFECT_PRESETS
      : EFFECT_PRESETS.filter((p) => p.category === category);

  const applyPreset = (preset: EffectPreset) => {
    if (!selected) {
      notify({ type: 'warning', title: 'Sélectionnez un clip sur la timeline' });
      return;
    }
    const nextFx = applyPresetToEffects(selected.effects || defaultEffects(), preset);
    updateEffects(selected.id, nextFx);

    // Motion presets → keyframes
    if (preset.animIn || preset.animOut) {
      const motionKfs = buildMotionKeyframes(
        selected.duration,
        preset.animIn,
        preset.animOut
      );
      const kept = (selected.keyframes || []).filter(
        (k) => !motionKfs.some((m) => m.property === k.property)
      );
      updateClip(selected.id, { keyframes: [...kept, ...motionKfs] });
    }

    notify({ type: 'success', title: `Effet « ${preset.name} » appliqué` });
  };

  const reset = () => {
    if (!selected) return;
    updateEffects(selected.id, defaultEffects());
    updateClip(selected.id, { keyframes: [] });
    notify({ type: 'info', title: 'Effets réinitialisés' });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <Sparkles size={18} color="var(--purple)" />
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Effets & filtres</h1>
        </div>
        <p className="text-secondary text-sm">
          Appliquez un preset au clip sélectionné. Les paramètres restent modifiables et sont
          enregistrés dans le projet.
        </p>
      </div>

      {/* Target clip */}
      <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
        <div className="label">Clip cible</div>
        {videoClips.length === 0 ? (
          <p className="text-muted text-sm">Aucun clip — importez un média d’abord.</p>
        ) : (
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            {videoClips.map((c) => (
              <button
                key={c.id}
                className={`btn btn-sm ${selectedClipId === c.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedClipId(c.id)}
              >
                {c.name.slice(0, 18)}
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="flex gap-2 mt-2">
            <span className="badge badge-accent">
              {selected.effects?.filterId || 'Aucun filtre'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              <RotateCcw size={12} /> Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="tabs" style={{ flexShrink: 0 }}>
        <button
          className={`tab ${category === 'all' ? 'active' : ''}`}
          onClick={() => setCategory('all')}
        >
          Tous
        </button>
        {EFFECT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`tab ${category === c.id ? 'active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          {list.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                textAlign: 'left',
                border:
                  selected?.effects?.filterId === preset.id
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
              }}
              title={preset.description}
            >
              <div
                style={{
                  height: 72,
                  background: preset.preview,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wand2 size={20} color="rgba(255,255,255,0.7)" />
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{preset.name}</div>
                <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                  {preset.description.slice(0, 42)}
                  {preset.description.length > 42 ? '…' : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
