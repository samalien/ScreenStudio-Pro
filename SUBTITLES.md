# Sous-titrage & traduction — ScreenStudio Pro v0.7.3

## Architecture STT pluggable

| Provider | Id | Description |
|----------|-----|-------------|
| Energy VAD | `energy-vad` | Découpe de segments de parole (local) |
| Web Speech | `webspeech` | Micro live (Chromium) |
| Whisper API | `whisper-api` | Remote — `localStorage.ssp_stt_api_key` |

## Traduction

- MyMemory (défaut, gratuit, rate-limit)
- LibreTranslate si `ssp_translate_engine=libre` + endpoint

## Langues

fr, en, **ar (RTL)**, es, de, it, pt, tr, zh, ja, ko

## Export

- SRT / VTT
- Incrustation canvas (preview + export vidéo)

## Fichiers

- `engine/subtitles/*`
- `stores/subtitleStore.ts`
- `panels/SubtitlesPanel.tsx`
