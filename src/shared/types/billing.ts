/**
 * SaaS billing, subscriptions, entitlements, invoices.
 * Entitlements are always resolved server-side (main process).
 */

export type PlanId = 'free' | 'premium' | 'pro' | 'teams';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'none';

export type PaymentProviderId = 'stripe' | 'paddle' | 'none';

export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'requires_action';

/** Feature flags gated by plan – checked ONLY via main process */
export type EntitlementFeature =
  | 'export-webm'
  | 'export-mp4'
  | 'export-4k'
  | 'ai-credits'
  | 'ai-bg-remove'
  | 'ai-subtitles'
  | 'templates-premium'
  | 'cloud-sync'
  | 'team-collab'
  | 'priority-support'
  | 'watermark-free'
  | 'custom-branding';

export interface PlanDefinition {
  id: PlanId;
  name: string;
  nameEn: string;
  description: string;
  /** cents */
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  features: EntitlementFeature[];
  storageQuotaBytes: number;
  aiCreditsMonthly: number;
  maxExportsPerDay: number;
  maxTeamMembers: number;
  highlighted?: boolean;
  /** Stripe / Paddle price IDs when configured */
  externalPriceIdMonthly?: string;
  externalPriceIdYearly?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  provider: PaymentProviderId;
  externalSubscriptionId?: string;
  externalCustomerId?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  canceledAt?: number | null;
  trialEnd?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Entitlements {
  userId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  features: EntitlementFeature[];
  storageQuotaBytes: number;
  storageUsedBytes: number;
  aiCreditsRemaining: number;
  aiCreditsMonthly: number;
  exportsToday: number;
  maxExportsPerDay: number;
  maxTeamMembers: number;
  periodEnd: number | null;
  /** true only if verified by BillingService */
  verifiedAt: number;
}

export interface Transaction {
  id: string;
  userId: string;
  provider: PaymentProviderId;
  externalId?: string;
  amountCents: number;
  currency: string;
  status: TransactionStatus;
  description: string;
  planId?: PlanId;
  invoiceId?: string;
  createdAt: number;
  raw?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  userId: string;
  number: string;
  planId: PlanId;
  amountCents: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  periodStart: number;
  periodEnd: number;
  pdfUrl?: string;
  transactionId?: string;
  createdAt: number;
}

export interface CheckoutSessionRequest {
  userId: string;
  planId: PlanId;
  interval: 'month' | 'year';
  successUrl: string;
  cancelUrl: string;
  customerEmail: string;
}

export interface CheckoutSessionResult {
  success: boolean;
  /** Provider-hosted URL – never a fake success without provider */
  url?: string;
  sessionId?: string;
  error?: string;
  /** When no provider keys: explicit configuration required */
  requiresConfiguration?: boolean;
}

export interface WebhookResult {
  received: boolean;
  processed: boolean;
  eventType?: string;
  error?: string;
}

export interface BillingConfig {
  provider: PaymentProviderId;
  /** Never log full secrets */
  stripePublishableKey?: string;
  stripeSecretConfigured: boolean;
  stripeWebhookSecretConfigured: boolean;
  paddleVendorConfigured: boolean;
  mode: 'live' | 'test' | 'unconfigured';
}

export interface AdminBillingStats {
  usersCount: number;
  activeSubscriptions: number;
  mrrCents: number;
  transactionsSucceeded: number;
  revenueCents: number;
  planBreakdown: Record<PlanId, number>;
}
