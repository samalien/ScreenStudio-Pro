/**
 * Payment provider adapters.
 * NO fake successful payments – without real credentials, checkout fails explicitly.
 */

import * as crypto from 'crypto';
import type {
  CheckoutSessionRequest,
  CheckoutSessionResult,
  PaymentProviderId,
  WebhookResult,
  BillingConfig,
} from '../../../shared/types/billing';
import { rootLogger } from '../logging/Logger';

const log = rootLogger.child('PaymentProvider');

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  isConfigured(): boolean;
  createCheckoutSession(req: CheckoutSessionRequest, priceId: string | undefined): Promise<CheckoutSessionResult>;
  createCustomerPortalUrl(customerId: string, returnUrl: string): Promise<{ url?: string; error?: string }>;
  verifyAndHandleWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<WebhookResult & { data?: Record<string, unknown> }>;
  getConfig(): BillingConfig;
}

/** Stripe via REST – requires STRIPE_SECRET_KEY in env or config file */
export class StripeProvider implements PaymentProvider {
  readonly id = 'stripe' as const;

  private secretKey: string | null;
  private webhookSecret: string | null;
  private publishableKey: string | null;
  private mode: 'live' | 'test' | 'unconfigured';

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
    this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null;
    if (this.secretKey?.startsWith('sk_live')) this.mode = 'live';
    else if (this.secretKey?.startsWith('sk_test')) this.mode = 'test';
    else this.mode = this.secretKey ? 'test' : 'unconfigured';
  }

  isConfigured(): boolean {
    return !!this.secretKey && this.secretKey.startsWith('sk_');
  }

  getConfig(): BillingConfig {
    return {
      provider: this.isConfigured() ? 'stripe' : 'none',
      stripePublishableKey: this.publishableKey || undefined,
      stripeSecretConfigured: this.isConfigured(),
      stripeWebhookSecretConfigured: !!this.webhookSecret,
      paddleVendorConfigured: false,
      mode: this.mode,
    };
  }

  async createCheckoutSession(
    req: CheckoutSessionRequest,
    priceId: string | undefined
  ): Promise<CheckoutSessionResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        requiresConfiguration: true,
        error:
          'Stripe non configuré. Définissez STRIPE_SECRET_KEY (et price IDs) pour accepter de vrais paiements. Aucun paiement fictif n’est émis.',
      };
    }
    if (!priceId) {
      return {
        success: false,
        requiresConfiguration: true,
        error:
          'Price ID Stripe manquant pour cette formule. Configurez externalPriceIdMonthly/Yearly dans le catalogue ou les variables d’environnement.',
      };
    }

    try {
      const body = new URLSearchParams();
      body.set('mode', 'subscription');
      body.set('success_url', req.successUrl);
      body.set('cancel_url', req.cancelUrl);
      body.set('customer_email', req.customerEmail);
      body.set('line_items[0][price]', priceId);
      body.set('line_items[0][quantity]', '1');
      body.set('client_reference_id', req.userId);
      body.set('metadata[userId]', req.userId);
      body.set('metadata[planId]', req.planId);

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        log.error('Stripe checkout error', { status: res.status, message: data?.error?.message });
        return {
          success: false,
          error: data?.error?.message || `Stripe HTTP ${res.status}`,
        };
      }
      if (!data.url) {
        return { success: false, error: 'Stripe n’a pas renvoyé d’URL de checkout.' };
      }
      return { success: true, url: data.url, sessionId: data.id };
    } catch (e: any) {
      return { success: false, error: String(e.message || e) };
    }
  }

  async createCustomerPortalUrl(customerId: string, returnUrl: string) {
    if (!this.isConfigured()) {
      return {
        error: 'Stripe non configuré – portail client indisponible.',
      };
    }
    try {
      const body = new URLSearchParams();
      body.set('customer', customerId);
      body.set('return_url', returnUrl);
      const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = (await res.json()) as any;
      if (!res.ok) return { error: data?.error?.message || 'Portal error' };
      return { url: data.url as string };
    } catch (e: any) {
      return { error: String(e.message || e) };
    }
  }

  /**
   * Verify Stripe-Signature header (webhook signing secret required).
   * Does not invent events – invalid signature => rejected.
   */
  async verifyAndHandleWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<WebhookResult & { data?: Record<string, unknown> }> {
    if (!this.webhookSecret) {
      return {
        received: true,
        processed: false,
        error: 'STRIPE_WEBHOOK_SECRET non configuré – webhook refusé.',
      };
    }
    if (!signature) {
      return { received: true, processed: false, error: 'Signature manquante.' };
    }
    try {
      const ok = verifyStripeSignature(rawBody, signature, this.webhookSecret);
      if (!ok) {
        return { received: true, processed: false, error: 'Signature Stripe invalide.' };
      }
      const event = JSON.parse(rawBody) as { type: string; data?: { object?: Record<string, unknown> } };
      return {
        received: true,
        processed: true,
        eventType: event.type,
        data: event.data?.object,
      };
    } catch (e: any) {
      return { received: true, processed: false, error: String(e.message || e) };
    }
  }
}

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  // Stripe-Signature: t=timestamp,v1=signature
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k.trim(), v?.trim() || ''];
    })
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const age = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (age > 300) return false; // 5 min tolerance
  const signed = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signed), Buffer.from(v1));
  } catch {
    return false;
  }
}

/** Unconfigured provider – always fails checkout honestly */
export class NoneProvider implements PaymentProvider {
  readonly id = 'none' as const;
  isConfigured() {
    return false;
  }
  getConfig(): BillingConfig {
    return {
      provider: 'none',
      stripeSecretConfigured: false,
      stripeWebhookSecretConfigured: false,
      paddleVendorConfigured: false,
      mode: 'unconfigured',
    };
  }
  async createCheckoutSession(): Promise<CheckoutSessionResult> {
    return {
      success: false,
      requiresConfiguration: true,
      error:
        'Aucun prestataire de paiement configuré. Configurez Stripe (STRIPE_SECRET_KEY) pour activer les abonnements payants. Aucun paiement simulé.',
    };
  }
  async createCustomerPortalUrl() {
    return { error: 'Prestataire non configuré.' };
  }
  async verifyAndHandleWebhook(): Promise<WebhookResult> {
    return { received: false, processed: false, error: 'No provider' };
  }
}

export function resolvePaymentProvider(): PaymentProvider {
  const stripe = new StripeProvider();
  if (stripe.isConfigured()) {
    log.info('Payment provider: Stripe', { mode: stripe.getConfig().mode });
    return stripe;
  }
  log.warn('No payment provider configured – checkout disabled (no fake charges)');
  return new NoneProvider();
}
