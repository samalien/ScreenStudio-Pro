/**
 * Text Studio – titles, free text, presets, typography, animations, RTL.
 * Adds rich text clips to the timeline.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Underline, Sparkles, Upload, Plus, Play, Languages,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import {
  FONT_LIBRARY,
  ensureFontLoaded,
  ensureAllWebFonts,
  importFontFile,
  containsRtlScript,
} from '../engine/text/fonts';
import { TEXT_PRESETS, PRESET_CATEGORIES } from '../engine/text/presets';
import {
  DEFAULT_RICH_TEXT_STYLE,
  DEFAULT_TEXT_ANIMATION,
  type RichTextStyle,
  type TextAnimation,
  type TextAnimType,
  type TextPreset,
} from '../engine/text/types';
import { drawRichText, evalTextAnimation } from '../engine/text/renderText';

const ANIM_OPTIONS: { id: TextAnimType; label: string }[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'fade', label: 'Fondu' },
  { id: 'slide-up', label: 'Glissement ↑' },
  { id: 'slide-down', label: 'Glissement ↓' },
  { id: 'slide-left', label: 'Glissement ←' },
  { id: 'slide-right', label: 'Glissement →' },
  { id: 'scale-up', label: 'Zoom avant' },
  { id: 'scale-down', label: 'Zoom arrière' },
  { id: 'pop', label: 'Pop' },
  { id: 'bounce', label: 'Rebond' },
  { id: 'typewriter', label: 'Machine à écrire' },
  { id: 'blur-in', label: 'Flou' },
  { id: 'rotate-in', label: 'Rotation' },
  { id: 'flip', label: 'Flip' },
  { id: 'glitch', label: 'Glitch' },
];

export function TextStudioPanel() {
  const { addClip, currentTime } = useProjectStore();
  const { setView, notify } = useUIStore();
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('Votre titre ici');
  const [style, setStyle] = useState<RichTextStyle>(DEFAULT_RICH_TEXT_STYLE());
  const [anim, setAnim] = useState<TextAnimation>(DEFAULT_TEXT_ANIMATION());
  const [category, setCategory] = useState<TextPreset['category'] | 'all'>('title');
  const [duration, setDuration] = useState(4);
  const [previewTime, setPreviewTime] = useState(0.6);

  useEffect(() => {
    ensureAllWebFonts();
  }, []);

  // Live preview
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#1a1e26';
    ctx.fillRect(0, 0, w, h);
    // checker for transparency feel
    const animState = evalTextAnimation(previewTime, duration, anim, text.length);
    drawRichText(ctx, text, style, w, h, animState);
  }, [text, style, anim, previewTime, duration]);

  const updateStyle = <K extends keyof RichTextStyle>(key: K, value: RichTextStyle[K]) => {
    setStyle((s) => ({ ...s, [key]: value }));
  };

  const applyPreset = (preset: TextPreset) => {
    setText(preset.text);
    setStyle({ ...DEFAULT_RICH_TEXT_STYLE(), ...preset.style });
    if (preset.animation) {
      setAnim({ ...DEFAULT_TEXT_ANIMATION(), ...preset.animation });
    }
    // Auto direction for Arabic
    if (preset.style.direction === 'rtl' || containsRtlScript(preset.text)) {
      updateStyle('direction', 'rtl');
    }
  };

  const addToTimeline = () => {
    // Also keep legacy textStyle for older code paths
    const legacy = {
      fontSize: style.fontSize,
      color: style.color,
      fontFamily: style.fontFamily,
      backgroundColor: style.background?.enabled ? style.background.color : 'transparent',
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      align: style.align,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      direction: style.direction,
      opacity: style.opacity,
      positionX: style.positionX,
      positionY: style.positionY,
      strokeColor: style.stroke?.color,
      strokeWidth: style.stroke?.width,
      shadowColor: style.shadow?.color,
      shadowBlur: style.shadow?.blur,
      shadowOffsetX: style.shadow?.offsetX,
      shadowOffsetY: style.shadow?.offsetY,
    };

    addClip({
      type: 'text',
      name: text.slice(0, 32) || 'Texte',
      start: currentTime,
      duration,
      trimStart: 0,
      src: '',
      sourceDuration: duration,
      track: 3, // text track
      volume: 1,
      text,
      textStyle: legacy as any,
      richTextStyle: structuredClone(style),
      textAnimation: structuredClone(anim),
      fadeIn: 0,
      fadeOut: 0,
    } as any);

    setView('editor');
    notify({ type: 'success', title: 'Texte ajouté à la timeline' });
  };

  const onImportFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const item = await importFontFile(file);
      updateStyle('fontFamily', item.family);
      notify({ type: 'success', title: `Police « ${item.label} » importée` });
    } catch (err: any) {
      notify({ type: 'error', title: 'Import police échoué', message: String(err.message || err) });
    }
  };

  const filteredPresets =
    category === 'all' ? TEXT_PRESETS : TEXT_PRESETS.filter((p) => p.category === category);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px 8px', flexShrink: 0 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <Type size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Studio Texte & Titres</h1>
        </div>
        <p className="text-secondary" style={{ fontSize: 12 }}>
          Titres, textes libres, animations, polices et support RTL (العربية)
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
        {/* Left – presets */}
        <div
          style={{
            width: 260,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Modèles
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>
              Tous
            </Chip>
            {PRESET_CATEGORIES.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredPresets.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="card"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>
                  {p.nameEn} · {p.category}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center – preview + text input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-tertiary)',
              padding: 16,
              minHeight: 200,
            }}
          >
            <canvas
              ref={previewRef}
              width={640}
              height={360}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: 8,
                boxShadow: 'var(--shadow)',
                background: '#1a1e26',
              }}
            />
          </div>
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <textarea
              className="input"
              rows={2}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (containsRtlScript(e.target.value)) {
                  setStyle((s) => ({ ...s, direction: 'rtl' }));
                }
              }}
              placeholder="Saisissez votre texte… (العربية supportée)"
              dir={style.direction === 'rtl' ? 'rtl' : 'ltr'}
              style={{ width: '100%', fontSize: 15, resize: 'vertical' }}
            />
            <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
              <label className="text-secondary" style={{ fontSize: 11 }}>
                Durée (s)
              </label>
              <input
                className="input"
                type="number"
                min={0.5}
                max={60}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value) || 4)}
                style={{ width: 70 }}
              />
              <label className="text-secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                Aperçu anim.
              </label>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.05}
                value={previewTime}
                onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={addToTimeline}>
                <Plus size={14} /> Ajouter à la timeline
              </button>
            </div>
          </div>
        </div>

        {/* Right – properties */}
        <div
          style={{
            width: 300,
            borderLeft: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 12,
            flexShrink: 0,
          }}
        >
          <Section title="Police">
            <select
              className="input"
              value={style.fontFamily}
              onChange={(e) => {
                const font = FONT_LIBRARY.find((f) => f.family === e.target.value);
                if (font) ensureFontLoaded(font);
                updateStyle('fontFamily', e.target.value);
              }}
              style={{ width: '100%', marginBottom: 6 }}
            >
              {FONT_LIBRARY.map((f) => (
                <option key={f.id} value={f.family}>
                  {f.label} {f.supportsRtl ? '(RTL)' : ''}
                </option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: 11 }}
              onClick={() => fontInputRef.current?.click()}
            >
              <Upload size={12} /> Importer une police…
            </button>
            <input
              ref={fontInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              hidden
              onChange={onImportFont}
            />
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <Field label="Taille">
                <input
                  type="range"
                  min={12}
                  max={160}
                  value={style.fontSize}
                  onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: 11 }}>{style.fontSize}px</span>
              </Field>
            </div>
            <div className="flex gap-1" style={{ marginTop: 6 }}>
              <ToggleBtn
                active={Number(style.fontWeight) >= 700}
                onClick={() =>
                  updateStyle('fontWeight', Number(style.fontWeight) >= 700 ? 400 : 700)
                }
              >
                <Bold size={14} />
              </ToggleBtn>
              <ToggleBtn
                active={style.fontStyle === 'italic'}
                onClick={() =>
                  updateStyle('fontStyle', style.fontStyle === 'italic' ? 'normal' : 'italic')
                }
              >
                <Italic size={14} />
              </ToggleBtn>
              <ToggleBtn
                active={style.align === 'left'}
                onClick={() => updateStyle('align', 'left')}
              >
                <AlignLeft size={14} />
              </ToggleBtn>
              <ToggleBtn
                active={style.align === 'center'}
                onClick={() => updateStyle('align', 'center')}
              >
                <AlignCenter size={14} />
              </ToggleBtn>
              <ToggleBtn
                active={style.align === 'right'}
                onClick={() => updateStyle('align', 'right')}
              >
                <AlignRight size={14} />
              </ToggleBtn>
            </div>
          </Section>

          <Section title="Couleur & style">
            <div className="flex gap-2 items-center">
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Couleur</label>
              <input
                type="color"
                value={style.color}
                onChange={(e) => updateStyle('color', e.target.value)}
              />
            </div>
            <Slider
              label="Espacement lettres"
              value={style.letterSpacing}
              min={-5}
              max={30}
              onChange={(v) => updateStyle('letterSpacing', v)}
            />
            <Slider
              label="Interligne"
              value={style.lineHeight}
              min={0.8}
              max={2.5}
              step={0.05}
              onChange={(v) => updateStyle('lineHeight', v)}
            />
            <Slider
              label="Opacité"
              value={style.opacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateStyle('opacity', v)}
            />
          </Section>

          <Section title="Ombre">
            <label className="flex items-center gap-2" style={{ fontSize: 12, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!style.shadow}
                onChange={(e) =>
                  updateStyle(
                    'shadow',
                    e.target.checked
                      ? { color: '#000000', blur: 8, offsetX: 0, offsetY: 4, opacity: 0.55 }
                      : null
                  )
                }
              />
              Activer l’ombre
            </label>
            {style.shadow && (
              <>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={style.shadow.color}
                    onChange={(e) =>
                      updateStyle('shadow', { ...style.shadow!, color: e.target.value })
                    }
                  />
                  <Slider
                    label="Flou"
                    value={style.shadow.blur}
                    min={0}
                    max={40}
                    onChange={(v) => updateStyle('shadow', { ...style.shadow!, blur: v })}
                  />
                </div>
              </>
            )}
          </Section>

          <Section title="Contour">
            <label className="flex items-center gap-2" style={{ fontSize: 12, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!style.stroke}
                onChange={(e) =>
                  updateStyle(
                    'stroke',
                    e.target.checked ? { color: '#000000', width: 3 } : null
                  )
                }
              />
              Activer le contour
            </label>
            {style.stroke && (
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={style.stroke.color}
                  onChange={(e) =>
                    updateStyle('stroke', { ...style.stroke!, color: e.target.value })
                  }
                />
                <Slider
                  label="Épaisseur"
                  value={style.stroke.width}
                  min={0.5}
                  max={12}
                  step={0.5}
                  onChange={(v) => updateStyle('stroke', { ...style.stroke!, width: v })}
                />
              </div>
            )}
          </Section>

          <Section title="Arrière-plan texte">
            <label className="flex items-center gap-2" style={{ fontSize: 12, marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={!!style.background?.enabled}
                onChange={(e) =>
                  updateStyle(
                    'background',
                    e.target.checked
                      ? {
                          enabled: true,
                          color: '#000000',
                          opacity: 0.6,
                          paddingX: 18,
                          paddingY: 8,
                          borderRadius: 6,
                        }
                      : null
                  )
                }
              />
              Activer le fond
            </label>
            {style.background?.enabled && (
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={style.background.color}
                  onChange={(e) =>
                    updateStyle('background', {
                      ...style.background!,
                      color: e.target.value,
                    })
                  }
                />
              </div>
            )}
          </Section>

          <Section title="Position">
            <Slider
              label="Position X"
              value={style.positionX}
              min={-1}
              max={1}
              step={0.01}
              onChange={(v) => updateStyle('positionX', v)}
            />
            <Slider
              label="Position Y"
              value={style.positionY}
              min={-1}
              max={1}
              step={0.01}
              onChange={(v) => updateStyle('positionY', v)}
            />
          </Section>

          <Section title="Direction / RTL">
            <div className="flex gap-1">
              {(['auto', 'ltr', 'rtl'] as const).map((d) => (
                <ToggleBtn
                  key={d}
                  active={style.direction === d}
                  onClick={() => updateStyle('direction', d)}
                >
                  {d === 'auto' ? 'Auto' : d === 'rtl' ? 'RTL العربية' : 'LTR'}
                </ToggleBtn>
              ))}
            </div>
          </Section>

          <Section title="Animation d’entrée">
            <select
              className="input"
              value={anim.enter}
              onChange={(e) => setAnim((a) => ({ ...a, enter: e.target.value as TextAnimType }))}
              style={{ width: '100%', marginBottom: 6 }}
            >
              {ANIM_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Slider
              label="Durée entrée (s)"
              value={anim.enterDuration}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => setAnim((a) => ({ ...a, enterDuration: v }))}
            />
          </Section>

          <Section title="Animation de sortie">
            <select
              className="input"
              value={anim.exit}
              onChange={(e) => setAnim((a) => ({ ...a, exit: e.target.value as TextAnimType }))}
              style={{ width: '100%', marginBottom: 6 }}
            >
              {ANIM_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Slider
              label="Durée sortie (s)"
              value={anim.exitDuration}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => setAnim((a) => ({ ...a, exitDuration: v }))}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="flex justify-between" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        <span>{typeof value === 'number' ? +value.toFixed(2) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 12,
        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'var(--accent-muted)' : 'var(--bg-elevated)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 8px',
        borderRadius: 6,
        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
