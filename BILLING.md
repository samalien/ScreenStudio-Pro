# Abonnements & monétisation SaaS

## Principe de sécurité

Les **entitlements** (droits) sont calculés **uniquement** dans le processus main (`BillingService.getEntitlements` / `checkFeature`).  
L’UI ne décide jamais seule si un export MP4 ou une feature IA est autorisée.

## Formules

| Plan | Stockage | Crédits IA/mois | Exports/jour |
|------|----------|-----------------|--------------|
| Free | 2 Go | 10 | 5 |
| Premium | 50 Go | 200 | 50 |
| Pro | 200 Go | 1000 | 200 |
| Teams | 1 To | 5000 | 1000 + collab |

## Paiements

- Prestataire principal : **Stripe** (REST Checkout + Billing Portal)
- Architecture multi-prestataires via `PaymentProvider`
- **Sans `STRIPE_SECRET_KEY`** : le checkout **échoue explicitement** — aucun paiement fictif
- Activation abonnement : **webhook signé** (`STRIPE_WEBHOOK_SECRET`) uniquement
- Price IDs : `externalPriceId*` sur le plan ou env `STRIPE_PRICE_PREMIUM_MONTHLY`, etc.

## Admin

- Stats MRR / transactions
- Grant manuel de plan (support) — clairement libellé, option `BILLING_ADMIN_KEY`

## Fichiers

- `shared/types/billing.ts`
- `main/services/billing/{plans,providers,BillingService}.ts`
- `renderer/stores/billingStore.ts`
- `renderer/panels/BillingPanel.tsx`
