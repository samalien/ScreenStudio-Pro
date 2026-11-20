# Exportation & rendu multimédia — ScreenStudio Pro

## Pipeline

1. **Composition** (renderer) : canvas frame-by-frame  
   - Clips vidéo / image + effets (`renderEffects`)  
   - Textes riches + animations (`drawRichText`)  
   - Sous-titres  
   - Mix audio multipiste offline (`mixTimelineAudio`)
2. **Encodage** : MediaRecorder → WebM (VP8/VP9 + Opus) ou MP4 si supporté  
3. **FFmpeg système** (optionnel) : probe, thumbnails, transcode, concat

## Formats

| Type | Formats |
|------|---------|
| Vidéo | WebM (natif), MP4 / MOV / GIF (via FFmpeg si dispo, sinon WebM) |
| Audio | WAV (natif offline), MP3/AAC via FFmpeg |
| Image | PNG, JPG, WebP |

## Résolutions

480p · 720p · 1080p · 2K/1440p · 4K · 9:16 · 1:1

## Modes

- Projet complet  
- Sélection temporelle (range)  
- Audio seul  
- Frame unique (image)

## Fonctionnalités UI

- Estimation de taille  
- Barre de progression réelle  
- Annulation (AbortController)  
- Qualité / bitrate / FPS configurables  
- Sauvegarde Electron dialog ou téléchargement navigateur  

## FFmpeg

`SystemFFmpegService` cherche `ffmpeg` dans le PATH / emplacements standards.  
Sans binaire : export composition WebM/WAV/PNG reste opérationnel.

Installer FFmpeg :
- Windows : https://ffmpeg.org ou `choco install ffmpeg`
- macOS : `brew install ffmpeg`
- Linux : `apt install ffmpeg`
