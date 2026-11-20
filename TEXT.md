# Module Textes, Titres & Typographie — ScreenStudio Pro

## Accès

Sidebar → **Textes**

## Fonctionnalités

### Ajout de contenus
- Titres, sous-titres, textes libres
- Lower thirds, callouts, légendes, génériques
- Modèles prédéfinis (presets) par catégorie

### Typographie
- Bibliothèque de polices (sans, serif, display, mono, hand, **arabe**)
- Import de polices utilisateur (TTF / OTF / WOFF)
- Taille, graisse, italique
- Alignement (gauche / centre / droite)
- Espacement des lettres, interligne
- Couleur, opacité
- Ombres portées (couleur, flou, offset)
- Contours (stroke)
- Dégradés (préparé dans le modèle)
- Arrière-plans de texte (pastille / barre)

### Animations
- Entrée / sortie : fade, slide, scale, pop, bounce, typewriter, blur, rotate, flip, glitch…
- Durées et délais configurables
- Aperçu animé en temps réel dans le studio
- Évaluation dans le moteur de rendu (export)

### Multilingue & RTL
- Français, Anglais, **Arabe**
- Direction auto / LTR / RTL
- Polices arabes : Noto Naskh, Noto Sans Arabic, Amiri, Cairo, Tahoma
- Détection automatique des scripts RTL
- Ligatures : déléguées au moteur de texte du navigateur (Canvas + polices OpenType)

### Intégration
- Ajout direct comme clip `type: 'text'` sur la piste texte de la timeline
- Style riche (`richTextStyle`) + animation (`textAnimation`) sérialisés dans le projet
- Rendu dans `exportTimeline` via `drawRichText` + `evalTextAnimation`
- Compatible avec le modèle legacy `textStyle` (rétrocompatibilité)

## Architecture

```
src/renderer/engine/text/
  types.ts          → RichTextStyle, TextAnimation, presets types
  fonts.ts          → Bibliothèque + import FontFace + RTL detect
  presets.ts        → Modèles titres / lower-thirds / arabe…
  renderText.ts     → drawRichText + evalTextAnimation

src/renderer/panels/TextStudioPanel.tsx  → UI Studio Texte
```

## Rendu

Le même pipeline sert :
1. Aperçu live du studio (canvas 640×360)
2. Export vidéo (`exportTimeline.ts`)

Les animations sont évaluées par rapport au temps local du clip (`t - clip.start`).

## Notes

- Le positionnement utilise un repère normalisé (-1..1) centré sur le cadre.
- Pour un contrôle pixel-perfect sur la timeline, les effets `positionX/Y` du clip sont fusionnés.
- Les keyframes génériques du moteur (opacity, scale…) restent disponibles en complément.
