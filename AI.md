# Studio IA générative — ScreenStudio Pro v0.7.4

## Principe

Aucune fonctionnalité ne prétend réussir sans réponse réelle d’un fournisseur.
Sans clé API, les capacités cloud échouent avec un message explicite.

## Fournisseurs

| Id | Capacités (intégration actuelle) |
|----|----------------------------------|
| **openai** | text-to-image (DALL·E), TTS, Whisper STT, script/titres/description/hashtags |
| **stability** | text-to-image (SDXL) |
| **elevenlabs** | text-to-speech |
| **replicate** | text/image-to-video, bg-remove, upscale, avatar/lip-sync (si modèle version configuré) |
| **browser** | TTS lecture seule, titres template, hashtags, scene-detect approximatif (énergie audio) |

## Configuration

UI **IA → Clés API** ou `localStorage` clé `ssp_ai_provider_configs_v1`.

## Jobs

Chaque run crée un `AIJob` : status, progress, coût estimé, résultat (url/blob/text).
Import timeline pour image / vidéo / audio.

## Non couvert sans service externe

- Vidéo générative de qualité prod sans Replicate/Runway/etc. + modèle version
- Avatars / lip-sync sans modèle dédié
- Suppression d’objets / upscale sans endpoint

Le cadre d’intégration est prêt : ajouter un provider = implémenter `AIProvider.run`.
