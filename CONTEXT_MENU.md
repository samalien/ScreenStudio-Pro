# Menu contextuel timeline & séparation audio/vidéo — v0.8.4

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/renderer/components/TimelineContextMenu.tsx` | **Créé** — menu clic droit |
| `src/renderer/stores/projectStore.ts` | **Modifié** — clipboard, rename, lock clip, `separateAudioVideo` |
| `src/renderer/modules/workspace/TimelineEngine.tsx` | **Modifié** — branchement `onContextMenu` + actions |

## Séparation audio/vidéo (réelle)

1. `extractAudioFromVideo(src)` décode la piste audio via **Web Audio API** → WAV blob.
2. Nouveau clip `type: 'audio'` sur piste A1/A2, **même `start`**, durée / `trimStart` alignés sur le clip vidéo.
3. Clip vidéo marqué `muted: true` pour éviter le double son à la lecture / export.
4. Opération enregistrée dans **Undo/Redo** (`commit`).
5. Si décodage impossible (pas d’audio) → notification, aucun clip créé.

## Menu

- Séparer audio/vidéo (vidéo uniquement)
- Diviser au curseur
- Couper / Copier / Coller / Dupliquer / Supprimer
- Renommer / Verrouiller
- Propriétés / Ajuster à la piste
- Fermeture : clic extérieur, Échap
- Position corrigée près des bords de fenêtre

## Export

Le mixage export (`mixTimelineAudio`) lit les clips `audio` et `video` non mutés → après séparation, seul le clip audio détaché contribue.
