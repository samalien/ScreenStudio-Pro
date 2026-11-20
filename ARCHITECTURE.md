# ScreenStudio Pro — Architecture Technique v0.6

Document de référence après l’audit (PROMPT 1) et la préparation infrastructure (PROMPT 2).

## 1. Objectif

Préparer le socle technique pour évoluer vers une plateforme de création multimédia professionnelle de type CapCut, sans réécriture destructive de l’existant.

## 2. Principes

- **Respect de l’existant** : Electron 29 + React 18 + TypeScript + Zustand + Vite restent le cœur.
- **Séparation des responsabilités** : chaque service a une interface claire (Dependency Inversion).
- **Évolutivité** : FFmpeg, IA, cloud, files d’attente peuvent être branchés sans changer les appelants.
- **Sécurité** : contextIsolation, path sanitization, feature flags (licence).
- **Desktop-first** : le main process est le “backend” local ; une future API HTTP pourra s’appuyer sur les mêmes services.

## 3. Organisation des dossiers

```
src/
├── main/                          # Processus principal Electron (= backend local)
│   ├── main.ts                    # Bootstrap + lifecycle + handlers legacy
│   ├── ipc/
│   │   └── registerHandlers.ts    # Tous les nouveaux contrats IPC
│   ├── services/
│   │   ├── logging/               # Logger structuré
│   │   ├── storage/               # Stockage local (userData)
│   │   ├── ffmpeg/                # Abstraction FFmpeg (stub prêt)
│   │   ├── audio/                 # Traitement audio
│   │   ├── image/                 # Traitement image
│   │   ├── ai/                    # Fournisseurs IA (local / cloud)
│   │   ├── queue/                 # Jobs asynchrones
│   │   ├── project/               # Persistence .ssproj
│   │   ├── cache/                 # Cache fichiers
│   │   └── security/              # Machine ID, licence, path safety
│   └── workers/                   # (futur) workers isolés
├── preload/
│   └── preload.ts                 # Bridge sécurisé exposé à window.electronAPI
├── shared/                        # Types & interfaces partagés main ↔ renderer
│   ├── types/                     # media, jobs…
│   ├── interfaces/                # Contrats de services
│   ├── constants/
│   └── utils/
└── renderer/                      # UI React (inchangée fonctionnellement)
    ├── services/api.ts            # Facade typée côté renderer
    ├── modules/                   # Capture, Workspace, Export…
    └── stores/                    # Zustand (timeline, media library)
```

## 4. Services préparés

| Service | Responsabilité | État actuel |
|---------|----------------|-------------|
| **Logger** | Journalisation structurée | Implémenté (console) |
| **LocalStorageProvider** | Chemins app, projets, cache, temp, media | Implémenté |
| **FFmpegService** | Transcode, probe, thumbnail, waveform, concat | **Stub** (API complète) |
| **AudioService** | Denoise, normalize, extract, mix, silence | Stub |
| **ImageService** | Resize, convert, thumbnail, overlay | Stub |
| **AIService** | Transcription, bg-remove, enhance, titres | Stub local |
| **JobQueue** | Tâches asynchrones + progress | In-memory opérationnel |
| **ProjectService** | CRUD projets `.ssproj` + récents | Implémenté (JSON) |
| **CacheService** | Cache disque avec TTL | Implémenté |
| **SecurityService** | Machine ID, licence free/pro, path safety | Implémenté (free par défaut) |

## 5. Gestion des fichiers volumineux

- Les médias capturés / importés sont destinés à vivre sous `userData/media/`.
- Les exports temporaires sous `userData/temp/`.
- Le cache (thumbnails, waveforms, probes) sous `userData/cache/` avec TTL.
- Les projets (`.ssproj`) sous `userData/projects/` + liste des récents.
- Les gros fichiers ne transitent plus par le renderer en ArrayBuffer autant que possible (chemin de fichier + FFmpeg côté main).

## 6. Tâches asynchrones

`InMemoryJobQueue` :
- enqueue / get / list / cancel
- progress + complete listeners
- processors enregistrables par `JobType`
- retries configurables

Types de jobs prévus : `export`, `transcode`, `thumbnail`, `waveform`, `ai-subtitle`, `ai-bg-remove`, `audio-denoise`, `project-save`, etc.

## 7. Stockage local & cloud

- **Local** : `LocalStorageProvider` (implémenté).
- **Cloud** : interface `CloudStorageProvider` déjà définie (upload / download / signed URL). Implémentation S3 / R2 / Drive à ajouter plus tard sans casser le code.

## 8. API internes

Toutes les nouvelles capacités passent par IPC nommées :

- `storage:*`
- `project:*`
- `ffmpeg:*`
- `jobs:*`
- `cache:*`
- `security:*`
- `ai:*`
- `services:status`

Le preload expose un objet `window.electronAPI` stable.  
Le renderer utilise `src/renderer/services/api.ts` comme facade.

## 9. Journalisation & erreurs

- `ConsoleLogger` avec niveaux et contexte.
- Les services loggent les opérations importantes.
- Les erreurs IPC sont renvoyées au renderer sous forme d’objets `{ success, error }`.

## 10. Cache

- Clé → hash SHA-256 → fichier `.bin` + `.meta.json` (TTL).
- Méthode `getOrCompute` pour éviter le recalcul.

## 11. Migrations / base de données

- Format projet = JSON versionné (`ProjectDocument.version`).
- Pas de SQLite pour l’instant (volontaire) afin de rester simple.
- Quand nécessaire : `better-sqlite3` pourra stocker index, historique, licences, jobs persistés. Les interfaces actuelles ne changent pas.

## 12. Sécurité & autorisations

- `contextIsolation: true`, `nodeIntegration: false`.
- Machine ID stable (hash hostname + userData).
- Feature flags : `free` vs `pro` (export MP4, IA, 4K…).
- `sanitizePath` / `isPathAllowed` pour limiter les traversées.

## 13. Intégration FFmpeg (prochaine étape)

Deux options prêtes côté architecture :

1. **Native** (recommandé desktop) : `ffmpeg-static` + `fluent-ffmpeg`
2. **WASM** : `@ffmpeg/ffmpeg` (fallback ou version web)

Le service `StubFFmpegService` expose déjà toute l’API. Il suffit de remplacer l’implémentation interne.

## 14. Compatibilité

- Tous les handlers IPC legacy (`get-sources`, `save-recording`, etc.) sont **conservés**.
- L’UI existante (Capture, CapCutWorkspace, Export) continue de fonctionner sans modification.
- Les nouveaux services sont opt-in.

## 15. Roadmap technique liée à cette architecture

1. Brancher un vrai binaire FFmpeg → export MP4.
2. Brancher les processors de la JobQueue (export, thumbnail…).
3. Persistence automatique des projets depuis le store Zustand.
4. Waveforms + denoise audio.
5. Premier provider IA (Whisper local ou cloud).
6. (Optionnel) SQLite pour index + jobs persistés.
7. (Optionnel) Backend HTTP pour templates / collaboration.
