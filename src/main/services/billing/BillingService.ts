/**
 * Billing & entitlements – SERVER-SIDE (main process) only.
 * UI must call checkFeature / getEntitlements via IPC; never trust renderer flags alone.
 */

import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Subscription,
  Entitlements,
  EntitlementFeature,
  Transaction,
  Invoice,
  PlanId,
  CheckoutSessionRequest,
  CheckoutSessionResult,
  AdminBillingStats,
  BillingConfig,
} from '../../../shared/types/billing';
import { getPlan, PLAN_CATALOG } from './plans';
import { resolvePaymentProvider, type PaymentProvider } from './providers';
import { getStorage } from '../storage/LocalStorageProvider';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('Billing');

const SUBS_FILE = 'billing-subscriptions.json';
const TX_FILE = 'billing-transactions.json';
const INV_FILE = 'billing-invoices.json';
const CREDITS_FILE = 'billing-ai-credits.json';
const EXPORTS_FILE = 'billing-exports-daily.json';

interface SubsDb { items: Subscription[] }
interface TxDb { items: Transaction[] }
interface InvDb { items: Invoice[] }
interface CreditsDb { byUser: Record<string, { remaining: number; periodStart: number }> }
interface ExportsDb { byUserDay: Record<string, number> }

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const storage = getStorage();
  const p = path.join(storage.getAppDataPath(), file);
  try {
    if (!(await storage.exists(p))) return fallback;
    const buf = await storage.readFile(p);
    return JSON.parse(buf.toString('utf-8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  const storage = getStorage();
  await storage.writeFile(path.join(storage.getAppDataPath(), file), JSON.stringify(data, null, 2));
}

function dayKey(userId: string, ts = Date.now()) {
  const d = new Date(ts);
  return `${userId}:${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export class BillingService {
  private provider: PaymentProvider;

  constructor() {
    this.provider = resolvePaymentProvider();
  }

  getConfig(): BillingConfig {
    return this.provider.getConfig();
  }

  listPlans() {
    return PLAN_CATALOG;
  }

  /** Active subscription for user, or implicit free */
  async getSubscription(userId: string): Promise<Subscription> {
    const db = await readJson<SubsDb>(SUBS_FILE, { items: [] });
    const sub = db.items
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (sub && (sub.status === 'active' || sub.status === 'trialing') && sub.currentPeriodEnd > Date.now()) {
      return sub;
    }
    if (sub && sub.cancelAtPeriodEnd && sub.currentPeriodEnd > Date.now() && sub.status === 'active') {
      return sub;
    }
    // Free implicit
    return {
      id: 'free-implicit',
      userId,
      planId: 'free',
      status: 'active',
      provider: 'none',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 365 * 864e5,
      cancelAtPeriodEnd: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * AUTHORITATIVE entitlements – only source of truth for feature access.
   */
  async getEntitlements(userId: string, storageUsedBytes = 0): Promise<Entitlements> {
    const sub = await this.getSubscription(userId);
    const plan = getPlan(sub.planId);
    const credits = await this.getAiCredits(userId, plan.aiCreditsMonthly);
    const exportsToday = await this.getExportsToday(userId);

    const features =
      sub.status === 'active' || sub.status === 'trialing' ? [...plan.features] : (['export-webm'] as EntitlementFeature[]);

    return {
      userId,
      planId: plan.id,
      status: sub.status,
      features,
      storageQuotaBytes: plan.storageQuotaBytes,
      storageUsedBytes,
      aiCreditsRemaining: credits,
      aiCreditsMonthly: plan.aiCreditsMonthly,
      exportsToday,
      maxExportsPerDay: plan.maxExportsPerDay,
      maxTeamMembers: plan.maxTeamMembers,
      periodEnd: sub.planId === 'free' ? null : sub.currentPeriodEnd,
      verifiedAt: Date.now(),
    };
  }

  /** Server-side feature gate */
  async checkFeature(userId: string, feature: EntitlementFeature): Promise<{ allowed: boolean; reason?: string }> {
    const ent = await this.getEntitlements(userId);
    if (!ent.features.includes(feature)) {
      return {
        allowed: false,
        reason: `Fonctionnalité « ${feature} » réservée au plan ${ent.planId === 'free' ? 'supérieur' : ent.planId}.`,
      };
    }
    if (feature.startsWith('ai-') || feature === 'ai-credits') {
      if (ent.aiCreditsRemaining <= 0) {
        return { allowed: false, reason: 'Crédits IA épuisés pour cette période.' };
      }
    }
    return { allowed: true };
  }

  async assertCanExport(userId: string, kind: 'webm' | 'mp4' | '4k'): Promise<{ allowed: boolean; reason?: string }> {
    const feature =
      kind === '4k' ? 'export-4k' : kind === 'mp4' ? 'export-mp4' : 'export-webm';
    const gate = await this.checkFeature(userId, feature as EntitlementFeature);
    if (!gate.allowed) return gate;
    const ent = await this.getEntitlements(userId);
    if (ent.exportsToday >= ent.maxExportsPerDay) {
      return { allowed: false, reason: `Limite d’exports journalière atteinte (${ent.maxExportsPerDay}).` };
    }
    return { allowed: true };
  }

  async recordExport(userId: string): Promise<void> {
    const db = await readJson<ExportsDb>(EXPORTS_FILE, { byUserDay: {} });
    const k = dayKey(userId);
    db.byUserDay[k] = (db.byUserDay[k] || 0) + 1;
    await writeJson(EXPORTS_FILE, db);
  }

  async consumeAiCredit(userId: string, amount = 1): Promise<{ ok: boolean; remaining: number; reason?: string }> {
    const gate = await this.checkFeature(userId, 'ai-credits');
    if (!gate.allowed) return { ok: false, remaining: 0, reason: gate.reason };
    const sub = await this.getSubscription(userId);
    const plan = getPlan(sub.planId);
    const db = await readJson<CreditsDb>(CREDITS_FILE, { byUser: {} });
    let row = db.byUser[userId];
    const periodStart = sub.currentPeriodStart;
    if (!row || row.periodStart < periodStart) {
      row = { remaining: plan.aiCreditsMonthly, periodStart };
    }
    if (row.remaining < amount) {
      return { ok: false, remaining: row.remaining, reason: 'Crédits IA insuffisants.' };
    }
    row.remaining -= amount;
    db.byUser[userId] = row;
    await writeJson(CREDITS_FILE, db);
    return { ok: true, remaining: row.remaining };
  }

  private async getAiCredits(userId: string, monthly: number): Promise<number> {
    const sub = await this.getSubscription(userId);
    const db = await readJson<CreditsDb>(CREDITS_FILE, { byUser: {} });
    const row = db.byUser[userId];
    if (!row || row.periodStart < sub.currentPeriodStart) return monthly;
    return row.remaining;
  }

  private async getExportsToday(userId: string): Promise<number> {
    const db = await readJson<ExportsDb>(EXPORTS_FILE, { byUserDay: {} });
    return db.byUserDay[dayKey(userId)] || 0;
  }

  /**
   * Start checkout – ONLY via real provider. Never marks subscription active here.
   * Activation happens only after verified webhook / provider confirmation.
   */
  async startCheckout(req: CheckoutSessionRequest): Promise<CheckoutSessionResult> {
    const plan = getPlan(req.planId);
    if (plan.id === 'free') {
      return { success: false, error: 'Le plan Free ne nécessite pas de paiement.' };
    }
    const priceId =
      req.interval === 'year' ? plan.externalPriceIdYearly : plan.externalPriceIdMonthly;
    // Also allow env overrides
    const envKey =
      req.interval === 'year'
        ? process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_YEARLY`]
        : process.env[`STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY`];
    const result = await this.provider.createCheckoutSession(req, priceId || envKey || undefined);
    if (result.success) {
      log.info('Checkout session created', { userId: req.userId, planId: req.planId, sessionId: result.sessionId });
    }
    return result;
  }

  async cancelSubscription(userId: string, atPeriodEnd = true): Promise<{ success: boolean; error?: string }> {
    const db = await readJson<SubsDb>(SUBS_FILE, { items: [] });
    const sub = db.items.find(
      (s) => s.userId === userId && (s.status === 'active' || s.status === 'trialing')
    );
    if (!sub || sub.planId === 'free') {
      return { success: false, error: 'Aucun abonnement payant actif.' };
    }
    // Without provider API cancel, mark local intent – real cancel must go through Stripe portal when configured
    sub.cancelAtPeriodEnd = atPeriodEnd;
    if (!atPeriodEnd) {
      sub.status = 'canceled';
      sub.canceledAt = Date.now();
    }
    sub.updatedAt = Date.now();
    await writeJson(SUBS_FILE, db);
    log.info('Subscription cancel requested', { userId, atPeriodEnd });
    return { success: true };
  }

  async changePlanLocalOnly(userId: string, planId: PlanId): Promise<{ success: boolean; error?: string }> {
    // Admin / webhook path only – not exposed as "fake payment success" to end users
    const plan = getPlan(planId);
    const db = await readJson<SubsDb>(SUBS_FILE, { items: [] });
    const now = Date.now();
    const existing = db.items.find((s) => s.userId === userId && s.status === 'active');
    if (existing) {
      existing.planId = planId;
      existing.updatedAt = now;
      existing.currentPeriodEnd = now + 30 * 864e5;
    } else {
      db.items.push({
        id: uuidv4(),
        userId,
        planId,
        status: 'active',
        provider: this.provider.id,
        currentPeriodStart: now,
        currentPeriodEnd: now + 30 * 864e5,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await writeJson(SUBS_FILE, db);
    // reset credits for new plan period
    const credits = await readJson<CreditsDb>(CREDITS_FILE, { byUser: {} });
    credits.byUser[userId] = { remaining: plan.aiCreditsMonthly, periodStart: now };
    await writeJson(CREDITS_FILE, credits);
    return { success: true };
  }

  /**
   * Apply verified webhook event from payment provider.
   * Called only after signature verification succeeds.
   */
  async applyWebhookEvent(eventType: string, data: Record<string, unknown> | undefined): Promise<void> {
    if (!data) return;
    const meta = (data.metadata || {}) as Record<string, string>;
    const userId = meta.userId || (data.client_reference_id as string);
    const planId = (meta.planId || 'premium') as PlanId;

    if (eventType === 'checkout.session.completed' || eventType === 'invoice.paid') {
      if (!userId) {
        log.warn('Webhook without userId – ignored');
        return;
      }
      await this.changePlanLocalOnly(userId, planId);
      const amount = typeof data.amount_total === 'number' ? data.amount_total : getPlan(planId).priceMonthlyCents;
      await this.recordTransaction({
        userId,
        provider: this.provider.id,
        externalId: String(data.id || ''),
        amountCents: amount,
        currency: String(data.currency || 'eur'),
        status: 'succeeded',
        description: `Abonnement ${planId}`,
        planId,
      });
      await this.createInvoice(userId, planId, amount);
      log.info('Subscription activated via webhook', { userId, planId, eventType });
    }

    if (eventType === 'customer.subscription.deleted') {
      if (userId) {
        const db = await readJson<SubsDb>(SUBS_FILE, { items: [] });
        const sub = db.items.find((s) => s.userId === userId);
        if (sub) {
          sub.status = 'canceled';
          sub.canceledAt = Date.now();
          sub.planId = 'free';
          sub.updatedAt = Date.now();
          await writeJson(SUBS_FILE, db);
        }
      }
    }
  }

  async handleWebhook(rawBody: string, signature?: string) {
    const result = await this.provider.verifyAndHandleWebhook(rawBody, signature);
    if (result.processed && result.eventType) {
      await this.applyWebhookEvent(result.eventType, result.data);
    }
    return result;
  }

  async recordTransaction(partial: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const db = await readJson<TxDb>(TX_FILE, { items: [] });
    const tx: Transaction = { ...partial, id: uuidv4(), createdAt: Date.now() };
    db.items.unshift(tx);
    await writeJson(TX_FILE, db);
    return tx;
  }

  async listTransactions(userId: string): Promise<Transaction[]> {
    const db = await readJson<TxDb>(TX_FILE, { items: [] });
    return db.items.filter((t) => t.userId === userId);
  }

  async createInvoice(userId: string, planId: PlanId, amountCents: number): Promise<Invoice> {
    const db = await readJson<InvDb>(INV_FILE, { items: [] });
    const now = Date.now();
    const inv: Invoice = {
      id: uuidv4(),
      userId,
      number: `INV-${now.toString(36).toUpperCase()}`,
      planId,
      amountCents,
      currency: 'eur',
      status: 'paid',
      periodStart: now,
      periodEnd: now + 30 * 864e5,
      createdAt: now,
    };
    db.items.unshift(inv);
    await writeJson(INV_FILE, db);
    return inv;
  }

  async listInvoices(userId: string): Promise<Invoice[]> {
    const db = await readJson<InvDb>(INV_FILE, { items: [] });
    return db.items.filter((i) => i.userId === userId);
  }

  async adminStats(): Promise<AdminBillingStats> {
    const subs = await readJson<SubsDb>(SUBS_FILE, { items: [] });
    const txs = await readJson<TxDb>(TX_FILE, { items: [] });
    const active = subs.items.filter((s) => s.status === 'active' && s.planId !== 'free');
    const planBreakdown: Record<PlanId, number> = { free: 0, premium: 0, pro: 0, teams: 0 };
    for (const s of active) planBreakdown[s.planId] = (planBreakdown[s.planId] || 0) + 1;
    const succeeded = txs.items.filter((t) => t.status === 'succeeded');
    const mrr = active.reduce((sum, s) => sum + getPlan(s.planId).priceMonthlyCents, 0);
    return {
      usersCount: new Set(subs.items.map((s) => s.userId)).size,
      activeSubscriptions: active.length,
      mrrCents: mrr,
      transactionsSucceeded: succeeded.length,
      revenueCents: succeeded.reduce((s, t) => s + t.amountCents, 0),
      planBreakdown,
    };
  }

  async adminListSubscriptions(): Promise<Subscription[]> {
    const db = await readJson<SubsDb>(SUBS_FILE, { items: [] });
    return db.items;
  }

  async portalUrl(userId: string, returnUrl: string) {
    const sub = await this.getSubscription(userId);
    if (!sub.externalCustomerId) {
      return { error: 'Aucun customer ID prestataire – ouvrez d’abord un checkout réel.' };
    }
    return this.provider.createCustomerPortalUrl(sub.externalCustomerId, returnUrl);
  }
}

let instance: BillingService | null = null;
export function getBillingService(): BillingService {
  if (!instance) instance = new BillingService();
  return instance;
}
