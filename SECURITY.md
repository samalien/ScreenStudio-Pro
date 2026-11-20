# Sécurité — ScreenStudio Pro

## Surface d’attaque

| Zone | Mesure |
|------|--------|
| Renderer | `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true` |
| IPC | API exposée uniquement via `preload` + `contextBridge` |
| Chemins | `SecurityService.sanitizePath` — refus hors userData |
| Auth | Mots de passe **scrypt + salt**, sessions tokenisées, pas de secret en clair |
| Billing | Entitlements **main process only** ; webhooks Stripe signature HMAC + fenêtre 5 min |
| Secrets | Clés API / Stripe uniquement via variables d’environnement |
| Captures | `setContentProtection(true)` sur la fenêtre principale |

## Isolation données

- Projets filtrés par `ownerId` / `sharedWith` (AuthService)
- Fichiers JSON isolés sous `app.getPath('userData')`
- Soft-delete projets

## Webhooks

`StripeProvider.verifyAndHandleWebhook` :
1. Exige `STRIPE_WEBHOOK_SECRET`
2. Vérifie header `Stripe-Signature` (HMAC-SHA256)
3. Rejette timestamps > 5 minutes
4. Active un abonnement **uniquement** après événement vérifié

## Recommandations avant production SaaS cloud

1. Migrer auth + billing vers API HTTPS + base PostgreSQL
2. Rate-limiting login / checkout
3. CSP stricte + `sandbox: true` si compatible capture d’écran
4. Audit dépendances (`npm audit`)
5. Ne jamais logger `STRIPE_SECRET_KEY` / tokens
6. Chiffrement au repos des médias cloud (SSE-S3)
