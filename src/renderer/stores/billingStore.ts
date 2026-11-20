/**
 * Billing client – always asks main process for entitlements (never trust local flags alone).
 */

import { create } from 'zustand';
import type {
  PlanDefinition,
  Entitlements,
  EntitlementFeature,
  Transaction,
  Invoice,
  BillingConfig,
  AdminBillingStats,
  Subscription,
  PlanId,
} from '../../shared/types/billing';

function api() {
  return (window as any).electronAPI?.billing as any;
}

interface BillingState {
  plans: PlanDefinition[];
  config: BillingConfig | null;
  entitlements: Entitlements | null;
  transactions: Transaction[];
  invoices: Invoice[];
  adminStats: AdminBillingStats | null;
  adminSubs: Subscription[];
  loading: boolean;
  error: string | null;

  refreshConfig: () => Promise<void>;
  refreshPlans: () => Promise<void>;
  refreshEntitlements: (userId: string) => Promise<Entitlements | null>;
  checkFeature: (userId: string, feature: EntitlementFeature) => Promise<{ allowed: boolean; reason?: string }>;
  assertExport: (userId: string, kind: 'webm' | 'mp4' | '4k') => Promise<{ allowed: boolean; reason?: string }>;
  startCheckout: (userId: string, planId: PlanId, interval: 'month' | 'year', email: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
  cancel: (userId: string) => Promise<boolean>;
  loadHistory: (userId: string) => Promise<void>;
  loadAdmin: () => Promise<void>;
  adminGrant: (userId: string, planId: PlanId, adminKey?: string) => Promise<boolean>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  plans: [],
  config: null,
  entitlements: null,
  transactions: [],
  invoices: [],
  adminStats: null,
  adminSubs: [],
  loading: false,
  error: null,

  refreshConfig: async () => {
    if (!api()) return;
    const config = await api().config();
    set({ config });
  },

  refreshPlans: async () => {
    if (!api()) return;
    const plans = await api().plans();
    set({ plans: plans || [] });
  },

  refreshEntitlements: async (userId) => {
    if (!api() || !userId) return null;
    set({ loading: true });
    try {
      const entitlements = await api().entitlements(userId);
      set({ entitlements, loading: false, error: null });
      return entitlements;
    } catch (e: any) {
      set({ loading: false, error: String(e.message || e) });
      return null;
    }
  },

  checkFeature: async (userId, feature) => {
    if (!api()) return { allowed: false, reason: 'Billing IPC indisponible' };
    return api().checkFeature(userId, feature);
  },

  assertExport: async (userId, kind) => {
    if (!api()) return { allowed: false, reason: 'Billing IPC indisponible' };
    return api().assertExport(userId, kind);
  },

  startCheckout: async (userId, planId, interval, email) => {
    if (!api()) return { ok: false, error: 'IPC indisponible' };
    const res = await api().checkout({
      userId,
      planId,
      interval,
      customerEmail: email,
      successUrl: 'https://localhost/billing/success',
      cancelUrl: 'https://localhost/billing/cancel',
    });
    if (res.success && res.url) {
      // Open real provider-hosted checkout
      if ((window as any).electronAPI?.openPath) {
        // shell.openExternal preferred – use window open as fallback
      }
      window.open(res.url, '_blank');
      return { ok: true, url: res.url };
    }
    return {
      ok: false,
      error: res.error || 'Checkout impossible',
    };
  },

  cancel: async (userId) => {
    if (!api()) return false;
    const res = await api().cancel(userId, true);
    await get().refreshEntitlements(userId);
    return !!res.success;
  },

  loadHistory: async (userId) => {
    if (!api()) return;
    const [transactions, invoices] = await Promise.all([
      api().transactions(userId),
      api().invoices(userId),
    ]);
    set({ transactions: transactions || [], invoices: invoices || [] });
  },

  loadAdmin: async () => {
    if (!api()) return;
    const [adminStats, adminSubs] = await Promise.all([api().adminStats(), api().adminSubs()]);
    set({ adminStats, adminSubs: adminSubs || [] });
  },

  adminGrant: async (userId, planId, adminKey) => {
    if (!api()) return false;
    const res = await api().adminGrant(userId, planId, adminKey);
    await get().refreshEntitlements(userId);
    return !!res.success;
  },
}));
