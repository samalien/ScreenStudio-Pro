# Éditeur Graphique & Retouche Photo — ScreenStudio Pro

Module professionnel de création et retouche d’images intégré à ScreenStudio Pro (v0.7.4+).

## Accès

Sidebar → **Graphismes** (icône stylo).

## Fonctionnalités livrées

### Import & formats
- PNG, JPG, JPEG, WebP, GIF, SVG
- Glisser-déposer ou bouton Importer
- Ajout automatique à la bibliothèque multimédia

### Transformations
- Recadrage (outil Crop)
- Rotation (90° et libre via slider)
- Redimensionnement (poignées + champs numériques)
- Déplacement libre (sélection / outil Move)

### Réglages couleur (non destructifs)
- Luminosité, Contraste, Saturation
- Exposition, Température, Teinte (Tint)
- Vibrance, Hue
- Réinitialisation en un clic

### Filtres prédéfinis
- Basiques, Cinématique, Vintage, N&B, Instagram, Artistique
- Application non destructive (filterId + adjustments)

### Calques
- Image, Texte, Formes (rectangle, ellipse, triangle, étoile)
- Stickers / emojis
- Visibilité, verrouillage, réordonnancement
- Opacité, blend mode (préparé)

### Texte & formes
- Texte libre (police, taille, couleur, alignement)
- Formes vectorielles avec remplissage / contour

### Historique
- Undo / Redo (Ctrl+Z / Ctrl+Y) jusqu’à 50 états
- Panneau Historique

### Export
- PNG (transparence), JPG, WebP
- Qualité réglable
- Téléchargement + ajout à la bibliothèque média
- **Envoi direct vers la timeline vidéo** (clip image)

### Intégration projet
- Bibliothèque multimédia (`mediaLibraryStore`)
- Timeline (`projectStore.addClip`)
- Même design system et thème clair/sombre

## Architecture

```
src/renderer/
  modules/graphics/
    GraphicsEditor.tsx     # Workspace principal
    types.ts
    filters/
      adjustments.ts       # Moteur couleur + CSS filter
      filtersLibrary.ts    # Presets
  stores/graphicsStore.ts  # État + historique + calques
  panels/GraphicsPanel.tsx # Point d’entrée (vue « graphics »)
```

## Raccourcis

| Raccourci        | Action                |
|------------------|-----------------------|
| Ctrl+Z           | Annuler               |
| Ctrl+Y / Ctrl+Shift+Z | Rétablir        |
| Ctrl+D           | Dupliquer calque      |
| Suppr            | Supprimer calque      |
| V                | Outil sélection       |
| T                | Outil texte           |
| C                | Outil crop            |
| R                | Rotation 90°          |
| Ctrl+0           | Zoom ajuster          |
| Ctrl++ / Ctrl+-  | Zoom ±                |

## Fonctionnalités avancées (IA / FFmpeg)

Les capacités suivantes s’appuient sur les providers IA déjà présents ou sur le futur FFmpegService :

- Suppression d’arrière-plan → provider Replicate / AIService
- Remplacement d’arrière-plan → même pipeline
- Suppression d’objets (inpainting)
- Amélioration de résolution (upscale)
- Génération d’images IA → panneau IA existant (OpenAI DALL·E, Stability, etc.)

Le cadre (calques, historique, export, intégration timeline) est prêt pour brancher ces opérations sans refonte.

## Presets de canevas

Full HD, 4K, Instagram Post/Story, YouTube Thumbnail, TikTok, Twitter/X, Facebook Cover, A4, Carré 1000…

## Notes techniques

- Rendu Canvas 2D (preview rapide via CSS filters, export via toBlob)
- Ajustements pixel-perfect disponibles dans `applyAdjustmentsToImageData` pour un export haute qualité futur
- Pas de dépendance externe lourde (tout en TypeScript + Canvas natif)
