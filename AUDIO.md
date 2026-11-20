# Module Audio professionnel — ScreenStudio Pro v0.7.2

## Stack

- **Web Audio API** : décodage, mixage live, mix offline pour export, EQ 3 bandes, pan, dynamics (noise gate), delay/reverb légers
- **MediaRecorder** : capture micro (voix off)
- **FFmpeg** (architecture main) : prêt pour traitements lourds futurs (denoise ML, pitch high-quality)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `engine/audioEngine.ts` | Decode, waveforms, LiveAudioMixer, mixTimelineAudio, extract, record |
| `engine/audioLibrary.ts` | Presets EQ / voix / espace / utilitaires |
| `panels/AudioStudioPanel.tsx` | UI studio |
| `utils/exportTimeline.ts` | Export vidéo **+ piste audio mixée** |

## Capacités

- Import audio (mp3, wav, aac…)
- Enregistrement voix off micro
- Extraction audio depuis clip vidéo
- Découpage / fusion / déplacement (moteur timeline)
- Volume, fade in/out, pan, vitesse, pitch
- EQ low/mid/high, noise gate, reverb, echo, normalize
- Waveforms sur timeline
- Mix multipiste en lecture et à l’export

## Sync A/V

La lecture audio démarre avec le playhead (`LiveAudioMixer.play`) en alignant `bufferOffset` sur `trimStart + (time - start) * speed`.
