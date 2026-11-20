# ScreenStudio Pro

**Logiciel professionnel de capture d'écran et de montage vidéo**  
Inspiré de CapCut, Camtasia, OBS Studio et ScreenPal.

Version actuelle : **0.8.5** — Architecture technique préparée pour une plateforme pro.

> Voir aussi : [ARCHITECTURE.md](./ARCHITECTURE.md) pour le détail des services, IPC, FFmpeg, jobs, stockage et sécurité.

---

## Stack technique

- **Electron 29** + **React 18** + **TypeScript**
- **Vite** — bundler
- **Zustand** — state management (projet / timeline)
- **desktopCapturer** + **MediaRecorder** + **Canvas**
- Architecture modulaire prête pour **FFmpeg**, files d’attente, IA, persistence projets

---

## Architecture (v0.8.5)

```
src/
├── main/               # Backend local (Electron main)
│   ├── services/       # FFmpeg, Audio, Image, AI, Queue, Project, Cache, Security…
│   └── ipc/            # Contrats IPC centralisés
├── preload/            # Bridge sécurisé → window.electronAPI
├── shared/             # Types & interfaces partagés
└── renderer/           # UI React (Capture, CapCutWorkspace, Export…)
```

### Services préparés

| Service | Rôle | État |
|---------|------|------|
| Storage | Chemins userData / projets / cache / media | ✅ |
| Project | Sauvegarde / chargement `.ssproj` | ✅ |
| JobQueue | Tâches asynchrones + progress | ✅ |
| FFmpeg | Transcode, probe, thumbnails… | Stub API complète |
| Audio / Image | Denoise, mix, resize… | Stub |
| AI | Transcription, bg-remove, titres | Stub |
| Cache | Cache disque TTL | ✅ |
| Security | Machine ID, licence free/pro | ✅ |

---

## Installation & lancement

```bash
cd ScreenStudioPro
npm install
npm run dev
```

### Build production
```bash
npm run build
npm start
```

### Package (installateur)
```bash
npm run package
```

---

## Fonctionnalités actuelles

| Module     | Statut          | Description                                      |
|------------|-----------------|--------------------------------------------------|
| Capture    | ✅ Complet MVP  | Écran, fenêtre, zone, micro, webcam, raccourcis   |
| Montage    | ✅ Avancé       | Timeline multipiste, textes, effets, preview     |
| Graphismes | ✅ Nouveau      | Éditeur photo pro
| Textes      | ✅ Nouveau      | Titres, typo, animations, RTL arabe, presets      | Éditeur photo pro : calques, réglages, filtres, export PNG/JPG/WebP, timeline |
| Effets     | ✅ Partiel      | Luminosité, contraste, blur, mosaïque, scale     |
| Audio      | ✅ Partiel      | Import + voice-over                              |
| Export     | ⚠️ WebM         | Canvas + MediaRecorder (MP4 via FFmpeg à venir)  |
| Projets    | ✅ Nouveau      | Persistence `.ssproj` + récents                  |

---

## Raccourcis clavier

### Capture
| Raccourci     | Action                        |
|---------------|-------------------------------|
| `Ctrl + R`    | Démarrer / Arrêter            |
| `Ctrl + P`    | Pause / Reprendre             |
| `Échap`       | Annuler compte à rebours / zone |

### Montage
| Raccourci     | Action                        |
|---------------|-------------------------------|
| `Espace`      | Lecture / Pause               |
| `S`           | Diviser le clip sélectionné   |
| `Suppr`       | Supprimer le clip             |
| `Ctrl + +`    | Zoom timeline +               |
| `Ctrl + -`    | Zoom timeline -               |

---

## Roadmap

### Phase 0 — Architecture ✅ (cette version)
- [x] Services modulaires (storage, project, queue, ffmpeg, ai…)
- [x] IPC centralisé + preload étendu
- [x] Persistence projets `.ssproj`
- [x] Feature flags / licence stub
- [x] Cache + logging

### Phase 1 — Export professionnel
- [ ] Intégration FFmpeg (binaire ou WASM)
- [ ] Export MP4 H.264
- [ ] Jobs d’export via la queue

### Phase 2 — Montage avancé
- [ ] Waveforms, denoise, mixage
- [ ] Transitions réellement rendues
- [ ] Undo / Redo

### Phase 3 — Premium / IA
- [ ] Sous-titres auto
- [ ] Background removal
- [ ] Zoom automatique / curseur

---

## Licence

MIT — Libre d’utilisation, modification et commercialisation.

**ScreenStudio Pro** — Créez des tutoriels et démonstrations de qualité professionnelle.
# ScreenStudio-Pro


---

## Scripts utiles (v0.8.5)

```bash
npm install          # dépendances
npm run dev          # main watch + Vite + Electron
npm run typecheck    # main + renderer
npm run build        # dist/main + dist/renderer
npm run lint         # ESLint (nécessite les plugins listés en dev)
npm run ci           # typecheck + build
npm run package      # electron-builder → release/
```

> CI GitHub Actions : `.github/workflows/ci.yml` (install, typecheck, build).
