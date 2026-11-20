/**
 * Commercial plan catalog – single source of truth for entitlements.
 */

import type { PlanDefinition, EntitlementFeature } from '../../../shared/types/billing';

const FREE_FEATURES: EntitlementFeature[] = [
  'export-webm',
];

const PREMIUM_FEATURES: EntitlementFeature[] = [
  ...FREE_FEATURES,
  'export-mp4',
  'watermark-free',
  'ai-credits',
  'templates-premium',
];

const PRO_FEATURES: EntitlementFeature[] = [
  ...PREMIUM_FEATURES,
  'export-4k',
  'ai-bg-remove',
  'ai-subtitles',
  'cloud-sync',
  'priority-support',
];

const TEAMS_FEATURES: EntitlementFeature[] = [
  ...PRO_FEATURES,
  'team-collab',
  'custom-branding',
];

export const PLAN_CATALOG: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    nameEn: 'Free',
    description: 'Découverte – export WebM, quotas limités',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    currency: 'eur',
    features: FREE_FEATURES,
    storageQuotaBytes: 2 * 1024 ** 3,
    aiCreditsMonthly: 10,
    maxExportsPerDay: 5,
    maxTeamMembers: 1,
  },
  {
    id: 'premium',
    name: 'Premium',
    nameEn: 'Premium',
    description: 'Créateurs – MP4, crédits IA, sans filigrane',
    priceMonthlyCents: 999,
    priceYearlyCents: 9990,
    currency: 'eur',
    features: PREMIUM_FEATURES,
    storageQuotaBytes: 50 * 1024 ** 3,
    aiCreditsMonthly: 200,
    maxExportsPerDay: 50,
    maxTeamMembers: 1,
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    description: 'Pros – 4K, IA avancée, cloud sync',
    priceMonthlyCents: 2499,
    priceYearlyCents: 24990,
    currency: 'eur',
    features: PRO_FEATURES,
    storageQuotaBytes: 200 * 1024 ** 3,
    aiCreditsMonthly: 1000,
    maxExportsPerDay: 200,
    maxTeamMembers: 1,
  },
  {
    id: 'teams',
    name: 'Teams',
    nameEn: 'Teams',
    description: 'Équipes – collaboration, branding, sièges',
    priceMonthlyCents: 4999,
    priceYearlyCents: 49990,
    currency: 'eur',
    features: TEAMS_FEATURES,
    storageQuotaBytes: 1024 * 1024 ** 3,
    aiCreditsMonthly: 5000,
    maxExportsPerDay: 1000,
    maxTeamMembers: 10,
  },
];

export function getPlan(id: string): PlanDefinition {
  return PLAN_CATALOG.find((p) => p.id === id) || PLAN_CATALOG[0];
}
