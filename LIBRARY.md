# Bibliothèque créative — ScreenStudio Pro

## Accès

Sidebar → **Modèles**

## Catégories

1. Modèles vidéo  
2. Publicité  
3. TikTok  
4. Instagram Reels  
5. YouTube Shorts  
6. Présentation  
7. Transitions  
8. Effets visuels  
9. Filtres  
10. Stickers  
11. Icônes  
12. Polices  
13. Musiques  
14. Effets sonores  
15. Animations  
16. Éléments graphiques  

## Fonctionnalités

- Recherche texte (nom, tags, description)
- Filtre par catégorie / licence (gratuit · premium)
- Tri (populaires, nom, récents, durée)
- Favoris (persistés localStorage)
- Aperçu latéral
- **Utiliser** → ouvre / applique dans l’éditeur (timeline, texte, graphismes…)
- Import / export catalogue JSON (admin)
- Ressources custom sans toucher au code

## Admin sans code

1. Bouton **Admin** dans la bibliothèque  
2. **Exporter** le catalogue actuel  
3. Éditer / ajouter des entrées dans le JSON  
4. **Importer JSON** (merge)

### Schéma minimal d’une ressource template

```json
{
  "id": "tpl-mon-modele",
  "name": "Mon modèle",
  "category": "video-templates",
  "kind": "template",
  "tags": ["intro"],
  "license": "free",
  "premium": false,
  "duration": 5,
  "color": "#4f8cff",
  "template": {
    "projectName": "Mon modèle",
    "replace": false,
    "clips": [
      {
        "type": "text",
        "name": "Titre",
        "start": 0.2,
        "duration": 3,
        "track": 3,
        "text": "Hello",
        "textStyle": { "fontSize": 48, "color": "#fff", "fontFamily": "Inter, sans-serif" }
      }
    ]
  }
}
```

## Architecture

```
src/renderer/engine/library/
  types.ts      → catégories, ressources, TemplatePayload
  catalog.ts    → catalogue par défaut
src/renderer/stores/libraryStore.ts
src/renderer/panels/TemplatesPanel.tsx
```

Les modèles timeline utilisent le même format de clips que le projectStore (texte riche, animations, etc.).

## Aperçus animés (démos)

Chaque ressource de la bibliothèque dispose d’un **aperçu canvas en boucle** :

| Type | Démo |
|------|------|
| Transitions | Scènes A→B (fade, wipe, slide, zoom, iris, flash…) |
| Filtres / effets | Grade couleur, glitch, vignette, blur… |
| Animations texte | Fade, pop, slide, machine à écrire |
| Polices | Échantillon « Aa » + nom |
| Stickers / icônes | Emoji animé |
| Musique / SFX | Forme d’onde animée |
| Modèles | Carte titre ou mockup 9:16 |

Implémentation : `src/renderer/engine/library/ResourcePreview.tsx`  
Grille + panneau latéral dans `TemplatesPanel.tsx`.
