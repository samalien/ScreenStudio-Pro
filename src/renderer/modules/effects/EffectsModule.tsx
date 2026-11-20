import React from 'react';
import { Sparkles, ZoomIn, EyeOff, Palette, Sun, Contrast, Droplets, Aperture } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

export function EffectsModule() {
  const { clips, selectedClipId, updateEffects, setSelectedClipId } = useProjectStore();
  const selected = clips.find((c) => c.id === selectedClipId);
  const videoClips = clips.filter((c) => c.type === 'video');
  const fx = selected?.effects;

  return (
    <div className="effects-module">
      <div className="effects-header">
        <div>
          <h1>Effets professionnels</h1>
          <p className="text-secondary text-sm">
            Effets appliqués au clip sélectionné et pris en compte à l’export
          </p>
        </div>
      </div>

      <div className="effects-layout">
        <div className="card">
          <div className="card-title">Clip cible</div>
          {videoClips.length === 0 ? (
            <p className="text-muted text-sm">Aucun clip vidéo. Enregistrez ou importez d’abord.</p>
          ) : (
            <div className="clip-list">
              {videoClips.map((c) => (
                <button
                  key={c.id}
                  className={`clip-pick ${selectedClipId === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedClipId(c.id)}
                >
                  <Sparkles size={14} />
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && fx ? (
          <>
            <div className="card">
              <div className="card-title">
                <Palette size={14} style={{ marginRight: 6 }} /> Couleur
              </div>
              <SliderRow icon={<Sun size={14} />} label="Luminosité" value={fx.brightness} min={-1} max={1} step={0.05} onChange={(v) => updateEffects(selected.id, { brightness: v })} />
              <SliderRow icon={<Contrast size={14} />} label="Contraste" value={fx.contrast} min={-1} max={1} step={0.05} onChange={(v) => updateEffects(selected.id, { contrast: v })} />
              <SliderRow icon={<Droplets size={14} />} label="Saturation" value={fx.saturation} min={-1} max={1} step={0.05} onChange={(v) => updateEffects(selected.id, { saturation: v })} />
            </div>

            <div className="card">
              <div className="card-title">
                <Aperture size={14} style={{ marginRight: 6 }} /> Transform & flou
              </div>
              <SliderRow icon={<ZoomIn size={14} />} label="Zoom" value={fx.scale} min={0.5} max={2.5} step={0.05} onChange={(v) => updateEffects(selected.id, { scale: v })} />
              <SliderRow icon={<EyeOff size={14} />} label="Flou" value={fx.blur} min={0} max={20} step={1} onChange={(v) => updateEffects(selected.id, { blur: v })} />
              <SliderRow label="Opacité" value={fx.opacity} min={0} max={1} step={0.05} onChange={(v) => updateEffects(selected.id, { opacity: v })} />
            </div>

            <div className="card">
              <div className="card-title">
                <EyeOff size={14} style={{ marginRight: 6 }} /> Masquage (mosaïque)
              </div>
              <p className="text-muted text-sm mb-2">Zone mosaïque pour masquer des infos sensibles.</p>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    updateEffects(selected.id, {
                      mosaicRegions: [...fx.mosaicRegions, { x: 0.3, y: 0.3, w: 0.4, h: 0.15 }],
                    })
                  }
                >
                  + Zone centrale
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => updateEffects(selected.id, { mosaicRegions: [] })}
                  disabled={!fx.mosaicRegions.length}
                >
                  Effacer ({fx.mosaicRegions.length})
                </button>
              </div>
            </div>

            <div className="card">
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() =>
                  updateEffects(selected.id, {
                    brightness: 0,
                    contrast: 0,
                    saturation: 0,
                    blur: 0,
                    opacity: 1,
                    scale: 1,
                    mosaicRegions: [],
                  })
                }
              >
                Réinitialiser les effets
              </button>
            </div>
          </>
        ) : (
          <div className="card">
            <p className="text-muted text-sm">Sélectionnez un clip vidéo pour éditer ses effets.</p>
          </div>
        )}
      </div>

      <style>{`
        .effects-module { padding: 24px; height: 100%; overflow: auto; }
        .effects-header { margin-bottom: 20px; }
        .effects-header h1 { font-size: 22px; font-weight: 600; }
        .effects-layout {
          display: grid;
          grid-template-columns: 260px 1fr 1fr;
          gap: 16px;
          max-width: 1100px;
        }
        .clip-list { display: flex; flex-direction: column; gap: 6px; }
        .clip-pick {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; background: var(--bg-tertiary);
          border: 1px solid var(--border); border-radius: var(--radius);
          color: var(--text-secondary); cursor: pointer; font-size: 13px;
          font-family: inherit; text-align: left;
        }
        .clip-pick.active {
          border-color: var(--accent); background: var(--accent-muted); color: var(--accent);
        }
        .slider-row {
          display: grid; grid-template-columns: 20px 90px 1fr 40px;
          align-items: center; gap: 8px; margin-bottom: 12px;
          font-size: 12px; color: var(--text-secondary);
        }
        .slider-row input[type="range"] { width: 100%; accent-color: var(--accent); }
        .slider-val { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); text-align: right; }
      `}</style>
    </div>
  );
}

function SliderRow({
  icon, label, value, min, max, step, onChange,
}: {
  icon?: React.ReactNode; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <span>{icon}</span>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-val">{value.toFixed(2)}</span>
    </div>
  );
}
