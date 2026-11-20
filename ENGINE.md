# Moteur de montage vidéo — ScreenStudio Pro v0.7

## Architecture du moteur

```
renderer/engine/
  types.ts          → Clip, Track, Keyframe, ProjectSnapshot
  mediaImport.ts    → import réel (metadata, thumbnails, waveforms)
  history.ts        → pile Undo/Redo (snapshots)
  playback.ts       → sourceTime, effets interpolés, keyframes

renderer/stores/projectStore.ts  → API d'édition + commit() historique
renderer/modules/workspace/TimelineEngine.tsx → UI moteur
```

## Opérations réelles (non simulées)

| Opération | Implémentation |
|-----------|----------------|
| Import MP4/MOV/WebM/audio/image | File API + HTMLVideo/Audio metadata + canvas thumbnail |
| Split | Recalcule trimStart / duration sur 2 clips |
| Trim start/end | Ajuste start, duration, trimStart (source offset) |
| Move / drag | Position timeline + track |
| Speed / reverse | Recalcule durée timeline, lecture sourceTimeAt() |
| Duplicate / delete / merge | Mutations modèle + history |
| Lock / hide / mute tracks | Flags piste |
| Opacity, scale, rotation, crop, PiP | effects sur clip, rendus canvas |
| Keyframes | Structure + evalKeyframe linéaire |
| Undo / Redo | HistoryEngine snapshots (Ctrl+Z / Ctrl+Y) |
| Auto-save | useAutoSave → ProjectService .ssproj |
| Preview | Canvas + video element synchronisé (trim, speed, effets) |

## Persistance

`toDocument()` / `loadSnapshot()` sérialisent clips + tracks + settings.
Les blob: URLs ne survivent pas au redémarrage : ré-importer les médias ou brancher FFmpeg/copie fichiers dans userData/media (préparé côté main).

## FFmpeg

Le service main `FFmpegService` (stub) est prêt pour transcode / probe natif.
L'import et la preview fonctionnent déjà via APIs navigateur.

## Raccourcis

- Espace : play/pause
- S : split
- Suppr : supprimer
- Ctrl+D : dupliquer
- Ctrl+Z / Ctrl+Y : undo/redo
- ← → : frame prev/next
