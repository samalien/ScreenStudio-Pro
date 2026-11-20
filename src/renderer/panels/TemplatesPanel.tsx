/**
 * Creative Library – templates, effects, stickers, fonts, music, etc.
 * Search, categories, favorites, preview, apply to editor, admin import.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutTemplate, Search, Star, Download, Upload, Plus,
  Film, Sparkles, Type, Music, Sticker, Shapes, Shuffle, Palette,
  Wand2, Volume2, PenTool, Crown, X, Check, Heart,
} from 'lucide-react';
import { useLibraryStore, applyTemplateToProject } from '../stores/libraryStore';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import type { LibraryResource } from '../engine/library/types';
import { ResourcePreview } from '../engine/library/ResourcePreview';

const CAT_ICONS: Record<string, React.ReactNode> = {
  'video-templates': <Film size={16} />,
  'ad-templates': <Sparkles size={16} />,
  tiktok: <Film size={16} />,
  reels: <Film size={16} />,
  shorts: <Film size={16} />,
  presentation: <LayoutTemplate size={16} />,
  transitions: <Shuffle size={16} />,
  effects: <Wand2 size={16} />,
  filters: <Palette size={16} />,
  stickers: <Sticker size={16} />,
  icons: <Shapes size={16} />,
  fonts: <Type size={16} />,
  music: <Music size={16} />,
  sfx: <Volume2 size={16} />,
  animations: <Sparkles size={16} />,
  graphics: <PenTool size={16} />,
};

export function TemplatesPanel() {
  const {
    filters,
    setQuery,
    setCategory,
    setFilter,
    getFiltered,
    getCategories,
    toggleFavorite,
    isFavorite,
    selectedId,
    select,
    importCatalogJson,
    exportCatalogJson,
    addCustomResource,
  } = useLibraryStore();

  const { addClip, clearProject, currentTime } = useProjectStore();
  const { setView, notify, setProjectMeta } = useUIStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [preview, setPreview] = useState<LibraryResource | null>(null);

  const categories = getCategories();
  const resources = getFiltered();

  const counts = useMemo(() => {
    const state = useLibraryStore.getState();
    const all = state.catalog.resources.concat(state.customResources);
    const map: Record<string, number> = { all: all.length };
    categories.forEach((c) => {
      map[c.id] = all.filter((r) => r.category === c.id).length;
    });
    return map;
  }, [categories, resources.length]);

  const applyResource = (res: LibraryResource) => {
    if (res.kind === 'template' && res.template) {
      applyTemplateToProject(res.template, {
        addClip,
        clearProject,
        setProjectMeta,
        currentTime,
      });
      setView('editor');
      notify({ type: 'success', title: `Modèle « ${res.name} » appliqué` });
      return;
    }

    if (res.kind === 'sticker' || res.kind === 'icon') {
      addClip({
        type: 'text',
        name: res.name,
        start: currentTime,
        duration: 3,
        trimStart: 0,
        src: '',
        sourceDuration: 3,
        track: 3,
        volume: 1,
        text: res.asset || res.name,
        textStyle: {
          fontSize: res.kind === 'sticker' ? 72 : 48,
          color: '#ffffff',
          fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
        },
      } as any);
      setView('editor');
      notify({ type: 'success', title: `${res.name} ajouté à la timeline` });
      return;
    }

    if (res.kind === 'transition' && res.engineId) {
      notify({
        type: 'info',
        title: 'Transition',
        message: `Sélectionnez un clip puis appliquez « ${res.name} » (${res.engineId}) dans les propriétés.`,
      });
      setView('editor');
      return;
    }

    if (res.kind === 'effect' || res.kind === 'filter') {
      notify({
        type: 'info',
        title: res.kind === 'filter' ? 'Filtre' : 'Effet',
        message: `« ${res.name} » — sélectionnez un clip (id: ${res.engineId}).`,
      });
      setView('editor');
      return;
    }

    if (res.kind === 'font') {
      setView('text');
      notify({ type: 'success', title: 'Police', message: `« ${res.name} » prête dans le Studio Texte` });
      return;
    }

    if (res.kind === 'audio') {
      notify({
        type: 'info',
        title: 'Audio',
        message: 'Importez un fichier audio correspondant via la bibliothèque média.',
      });
      return;
    }

    if (res.kind === 'animation') {
      setView('text');
      notify({
        type: 'info',
        title: 'Animation texte',
        message: `Choisissez l'animation « ${res.engineId} » dans le Studio Texte.`,
      });
      return;
    }

    if (res.kind === 'graphic') {
      setView('graphics');
      notify({ type: 'info', title: 'Graphisme', message: "Ouvrez l'éditeur graphique pour ajouter la forme." });
      return;
    }

    notify({ type: 'info', title: res.name });
  };

  const onImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importCatalogJson(text, 'merge');
    if (result.ok) {
      notify({ type: 'success', title: 'Catalogue importé', message: `${result.count} ressources` });
      setAdminOpen(false);
    } else {
      notify({ type: 'error', title: 'Import échoué', message: result.error });
    }
  };

  const onExportCatalog = () => {
    const json = exportCatalogJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenstudio-library-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ type: 'success', title: 'Catalogue exporté' });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 10px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <LayoutTemplate size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>Bibliothèque créative</h1>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setAdminOpen(true)}>
            <Upload size={14} /> Admin
          </button>
        </div>
        <div className="flex gap-2 items-center">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              className="input"
              placeholder="Rechercher modèles, effets, stickers, polices…"
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 32, width: '100%' }}
            />
          </div>
          <select
            className="input"
            value={filters.license}
            onChange={(e) => setFilter('license', e.target.value as any)}
            style={{ width: 120 }}
          >
            <option value="all">Toutes licences</option>
            <option value="free">Gratuit</option>
            <option value="premium">Premium</option>
          </select>
          <select
            className="input"
            value={filters.sort}
            onChange={(e) => setFilter('sort', e.target.value as any)}
            style={{ width: 120 }}
          >
            <option value="popular">Populaires</option>
            <option value="name">Nom</option>
            <option value="newest">Récents</option>
            <option value="duration">Durée</option>
          </select>
          <button
            className={`btn ${filters.favoritesOnly ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('favoritesOnly', !filters.favoritesOnly)}
            title="Favoris uniquement"
          >
            <Heart size={14} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: 200,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: '10px 8px',
            flexShrink: 0,
            background: 'var(--bg-secondary)',
          }}
        >
          <CatBtn
            active={filters.category === 'all'}
            onClick={() => setCategory('all')}
            icon={<LayoutTemplate size={16} />}
            label="Tout"
            count={counts.all}
          />
          {categories.map((c) => (
            <CatBtn
              key={c.id}
              active={filters.category === c.id}
              onClick={() => setCategory(c.id)}
              icon={CAT_ICONS[c.id] || <Sparkles size={16} />}
              label={c.label}
              count={counts[c.id] || 0}
            />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {resources.length === 0 && (
            <div className="text-secondary" style={{ textAlign: 'center', padding: 48 }}>
              Aucune ressource trouvée
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {resources.map((res) => (
              <ResourceCard
                key={res.id}
                res={res}
                favorite={isFavorite(res.id)}
                selected={selectedId === res.id}
                onSelect={() => {
                  select(res.id);
                  setPreview(res);
                }}
                onFavorite={() => toggleFavorite(res.id)}
                onUse={() => applyResource(res)}
              />
            ))}
          </div>
        </div>

        {preview && (
          <div
            style={{
              width: 280,
              borderLeft: '1px solid var(--border)',
              padding: 16,
              overflowY: 'auto',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Aperçu</span>
              <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => setPreview(null)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <ResourcePreview
                resource={preview}
                size="panel"
                style={{ width: '100%', height: 180 }}
              />
              <p className="text-secondary" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>
                {preview.kind === 'transition'
                  ? 'Lecture en boucle de la transition (scène A → B) avant application.'
                  : preview.kind === 'filter' || preview.kind === 'effect'
                    ? 'Démonstration animée du filtre / effet sur une scène exemple.'
                    : preview.kind === 'animation'
                      ? 'Aperçu de l’animation de texte en boucle.'
                      : preview.kind === 'audio'
                        ? 'Visualisation d’onde (musique / effet sonore).'
                        : preview.kind === 'font'
                          ? 'Rendu de la police (échantillon Aa).'
                          : 'Aperçu animé de la ressource avant utilisation.'}
              </p>
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{preview.name}</h3>
            {preview.nameEn && (
              <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>
                {preview.nameEn}
              </div>
            )}
            {preview.description && (
              <p className="text-secondary" style={{ fontSize: 12, marginBottom: 10 }}>
                {preview.description}
              </p>
            )}
            <Meta label="Catégorie" value={preview.category} />
            <Meta label="Type" value={preview.kind} />
            <Meta
              label="Licence"
              value={
                preview.premium ? (
                  <span style={{ color: 'var(--warning)' }}>
                    <Crown size={12} style={{ display: 'inline', verticalAlign: -2 }} /> Premium
                  </span>
                ) : (
                  preview.license || 'free'
                )
              }
            />
            {preview.duration != null && <Meta label="Durée" value={`${preview.duration}s`} />}
            {preview.tags?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {preview.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 10,
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={() => applyResource(preview)}
            >
              <Check size={14} /> Utiliser dans l'éditeur
            </button>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 6 }}
              onClick={() => toggleFavorite(preview.id)}
            >
              <Star size={14} fill={isFavorite(preview.id) ? 'currentColor' : 'none'} />{' '}
              {isFavorite(preview.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
          </div>
        )}
      </div>

      {adminOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setAdminOpen(false)}
        >
          <div className="card" style={{ width: 420, padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>Administration bibliothèque</h3>
            <p className="text-secondary" style={{ fontSize: 12, marginBottom: 16 }}>
              Importez un fichier JSON de catalogue pour ajouter des modèles sans modifier le code.
              Format : {'{ version, categories?, resources: [...] }'}
            </p>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportCatalog} />
            <div className="flex gap-2" style={{ marginBottom: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Importer JSON
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onExportCatalog}>
                <Download size={14} /> Exporter
              </button>
            </div>
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginBottom: 8 }}
              onClick={() => {
                const id = addCustomResource({
                  name: 'Mon modèle custom',
                  category: 'video-templates',
                  kind: 'template',
                  tags: ['custom'],
                  license: 'free',
                  premium: false,
                  duration: 5,
                  color: '#3ecf8e',
                  description: 'Ajouté via admin',
                  template: {
                    replace: false,
                    clips: [
                      {
                        type: 'text',
                        name: 'Custom',
                        start: 0.2,
                        duration: 4,
                        track: 3,
                        text: 'Modèle personnalisé',
                        textStyle: { fontSize: 48, color: '#fff', fontFamily: 'Inter, sans-serif' },
                      },
                    ],
                  },
                });
                notify({ type: 'success', title: 'Ressource custom ajoutée', message: id });
              }}
            >
              <Plus size={14} /> Ajouter un modèle exemple
            </button>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setAdminOpen(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--accent-muted)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        marginBottom: 2,
      }}
    >
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function ResourceCard({
  res,
  favorite,
  selected,
  onSelect,
  onFavorite,
  onUse,
}: {
  res: LibraryResource;
  favorite: boolean;
  selected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onUse: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 10,
        border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div
        style={{
          height: 90,
          position: 'relative',
          overflow: 'hidden',
          background: '#0a0c10',
        }}
      >
        <ResourcePreview resource={res} size="thumb" style={{ width: '100%', height: '100%' }} />
        {res.premium && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              fontSize: 10,
              background: 'var(--warning)',
              color: '#111',
              padding: '1px 5px',
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            PRO
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'rgba(0,0,0,0.35)',
            border: 'none',
            borderRadius: 6,
            padding: 4,
            color: favorite ? '#f0b429' : '#fff',
            cursor: 'pointer',
          }}
        >
          <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{res.name}</div>
        <div className="text-secondary" style={{ fontSize: 10, marginBottom: 6 }}>
          {res.kind}
          {res.duration != null ? ` · ${res.duration}s` : ''}
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: 11, padding: '4px 8px' }}
          onClick={(e) => {
            e.stopPropagation();
            onUse();
          }}
        >
          Utiliser
        </button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
      <span className="text-secondary">{label}</span>
      <span>{value}</span>
    </div>
  );
}
