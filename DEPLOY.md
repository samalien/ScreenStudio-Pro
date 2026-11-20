# Guide de déploiement — ScreenStudio Pro

## 1. Prérequis

- Node.js 20 LTS
- npm 10+
- FFmpeg système (recommandé) : `ffmpeg` dans le PATH
- macOS 12+ / Windows 10+ / Ubuntu 22.04+

## 2. Variables d’environnement

Copier `.env.example` → charger avant le lancement (shell ou electron-builder env) :

```bash
export STRIPE_SECRET_KEY=sk_live_...   # ou sk_test_
export STRIPE_WEBHOOK_SECRET=whsec_...
export OPENAI_API_KEY=sk-...           # optionnel
export FFMPEG_PATH=/usr/bin/ffmpeg     # optionnel
export BILLING_ADMIN_KEY=...           # optionnel support
```

Sans Stripe : l’app fonctionne en plan Free, checkout désactivé honnêtement.

## 3. Build production

```bash
npm ci
npm run typecheck:main
npm run build
npm run package    # electron-builder → release/
```

Artifacts : `release/` (dmg / nsis / AppImage selon OS).

## 4. Stockage

| Donnée | Emplacement |
|--------|-------------|
| Projets `.ssproj` | `userData/projects/` |
| Médias | `userData/media/` |
| Auth / sessions | `userData/users-db.json`, `sessions-db.json` |
| Billing | `userData/billing-*.json` |
| Cache | `userData/cache/` |

Cloud multi-appareils : brancher `CloudStorageProvider` (S3/R2) — interface déjà définie.

## 5. Services externes

| Service | Rôle | Coût indicatif |
|---------|------|----------------|
| Stripe | Abonnements | 1,5–2 % + fixe / tx |
| OpenAI | Whisper / images / TTS | à l’usage |
| Stability | Images | à l’usage |
| Replicate | Modèles divers | à l’usage |
| S3/R2 | Médias cloud | stockage + egress |
| FFmpeg | Local (gratuit) | 0 |

## 6. Sauvegarde / restauration

```bash
./scripts/backup-userdata.sh ./backup.tar.gz
./scripts/restore-userdata.sh ./backup.tar.gz
```

Plan recommandé : backup quotidien des `userData` + rétention 30 jours.

## 7. Webhooks Stripe (SaaS serveur)

Pour une version cloud, exposer un endpoint HTTPS qui appelle la même logique que `billing:webhook` avec le body brut et la signature. En desktop pur, les activations passent par admin grant ou sync future.

## 8. Checklist go-live desktop

- [ ] Build signé (Apple notarization / Windows Authenticode)
- [ ] `npm audit` sans critique
- [ ] FFmpeg documenté pour l’utilisateur
- [ ] Mentions légales / CGU / privacy
- [ ] Crash reporting (Sentry optionnel)
