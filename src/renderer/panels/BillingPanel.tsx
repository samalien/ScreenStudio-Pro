/**
 * Billing dashboard – plans, checkout (real provider only), history, admin.
 * Feature access always re-checked via main process.
 */

import React, { useEffect, useState } from 'react';
import {
  CreditCard, Crown, Shield, Receipt, BarChart3, AlertTriangle, Check, X,
} from 'lucide-react';
import { useBillingStore } from '../stores/billingStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import type { PlanId } from '../../shared/types/billing';

export function BillingPanel() {
  const { user } = useAuthStore();
  const { notify } = useUIStore();
  const {
    plans, config, entitlements, transactions, invoices, adminStats, adminSubs,
    refreshConfig, refreshPlans, refreshEntitlements, startCheckout, cancel,
    loadHistory, loadAdmin, adminGrant, checkFeature,
  } = useBillingStore();

  const [tab, setTab] = useState<'plans' | 'usage' | 'history' | 'admin'>('plans');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [adminKey, setAdminKey] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshPlans();
    refreshConfig();
    if (user) {
      refreshEntitlements(user.id);
      loadHistory(user.id);
    }
  }, [user?.id]);

  const formatMoney = (cents: number, currency = 'eur') =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

  const formatBytes = (n: number) => {
    if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} Go`;
    return `${(n / 1024 ** 2).toFixed(0)} Mo`;
  };

  const onUpgrade = async (planId: PlanId) => {
    if (!user) {
      notify({ type: 'warning', title: 'Connexion requise', message: 'Créez un compte dans Compte.' });
      return;
    }
    if (planId === 'free') return;
    setBusy(true);
    const res = await startCheckout(user.id, planId, interval, user.email);
    setBusy(false);
    if (res.ok) {
      notify({
        type: 'info',
        title: 'Redirection prestataire',
        message: 'Ouverture de la page de paiement sécurisée (Stripe). L’abonnement ne sera activé qu’après confirmation du prestataire (webhook).',
      });
    } else {
      notify({
        type: 'error',
        title: 'Paiement non disponible',
        message: res.error || 'Configurez STRIPE_SECRET_KEY et les Price IDs. Aucun paiement fictif n’est effectué.',
      });
    }
  };

  const onCancel = async () => {
    if (!user) return;
    if (!confirm('Résilier à la fin de la période en cours ?')) return;
    const ok = await cancel(user.id);
    notify({ type: ok ? 'success' : 'error', title: ok ? 'Résiliation enregistrée' : 'Échec' });
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <CreditCard size={22} color="var(--accent)" />
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Abonnements & facturation</h1>
        </div>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
          Les droits sont vérifiés côté processus principal. Sans prestataire configuré, aucun paiement n’est simulé.
        </p>

        {/* Provider status */}
        <div
          className="card"
          style={{
            padding: 12,
            marginBottom: 16,
            borderColor: config?.mode === 'unconfigured' ? 'var(--warning)' : 'var(--success)',
          }}
        >
          <div className="flex items-center gap-2" style={{ fontSize: 13 }}>
            {config?.mode === 'unconfigured' ? (
              <AlertTriangle size={16} color="var(--warning)" />
            ) : (
              <Shield size={16} color="var(--success)" />
            )}
            <span>
              Prestataire : <strong>{config?.provider || 'none'}</strong>
              {config?.mode ? ` · mode ${config.mode}` : ''}
              {config?.stripeSecretConfigured ? ' · secret OK' : ' · secret absent'}
              {config?.stripeWebhookSecretConfigured ? ' · webhook OK' : ' · webhook non configuré'}
            </span>
          </div>
          {config?.mode === 'unconfigured' && (
            <p className="text-secondary" style={{ fontSize: 12, marginTop: 6 }}>
              Variables : <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>,{' '}
              <code>STRIPE_PRICE_PREMIUM_MONTHLY</code>, etc. Checkout réel uniquement.
            </p>
          )}
        </div>

        {entitlements && (
          <div className="flex gap-3" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <Mini label="Plan" value={entitlements.planId.toUpperCase()} />
            <Mini label="Statut" value={entitlements.status} />
            <Mini label="Crédits IA" value={`${entitlements.aiCreditsRemaining} / ${entitlements.aiCreditsMonthly}`} />
            <Mini label="Exports / jour" value={`${entitlements.exportsToday} / ${entitlements.maxExportsPerDay}`} />
            <Mini
              label="Stockage"
              value={`${formatBytes(entitlements.storageUsedBytes)} / ${formatBytes(entitlements.storageQuotaBytes)}`}
            />
          </div>
        )}

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {([
            ['plans', 'Formules'],
            ['usage', 'Utilisation'],
            ['history', 'Historique'],
            ['admin', 'Admin'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              className={`btn ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setTab(id);
                if (id === 'admin') loadAdmin();
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'plans' && (
          <>
            <div className="flex gap-2" style={{ marginBottom: 12 }}>
              <button className={`btn ${interval === 'month' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInterval('month')}>
                Mensuel
              </button>
              <button className={`btn ${interval === 'year' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInterval('year')}>
                Annuel (−17%)
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {plans.map((p) => {
                const price = interval === 'year' ? p.priceYearlyCents : p.priceMonthlyCents;
                const current = entitlements?.planId === p.id;
                return (
                  <div
                    key={p.id}
                    className="card"
                    style={{
                      padding: 16,
                      borderColor: p.highlighted ? 'var(--accent)' : current ? 'var(--success)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                      {p.id !== 'free' && <Crown size={16} color="var(--warning)" />}
                      <strong>{p.name}</strong>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
                      {price === 0 ? 'Gratuit' : formatMoney(price)}
                      {price > 0 && (
                        <span className="text-secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                          /{interval === 'year' ? 'an' : 'mois'}
                        </span>
                      )}
                    </div>
                    <p className="text-secondary" style={{ fontSize: 12, minHeight: 36 }}>
                      {p.description}
                    </p>
                    <ul style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 16, margin: '8px 0' }}>
                      <li>{formatBytes(p.storageQuotaBytes)} stockage</li>
                      <li>{p.aiCreditsMonthly} crédits IA / mois</li>
                      <li>{p.maxExportsPerDay} exports / jour</li>
                      {p.maxTeamMembers > 1 && <li>{p.maxTeamMembers} sièges équipe</li>}
                    </ul>
                    {current ? (
                      <button className="btn btn-ghost" style={{ width: '100%' }} disabled>
                        <Check size={14} /> Formule actuelle
                      </button>
                    ) : p.id === 'free' ? (
                      <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onCancel} disabled={!user}>
                        Revenir au Free (fin de période)
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={busy || !user}
                        onClick={() => onUpgrade(p.id)}
                      >
                        S’abonner
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'usage' && entitlements && (
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Droits vérifiés (serveur)</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {entitlements.features.map((f) => (
                <span
                  key={f}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--accent-muted)',
                    color: 'var(--accent)',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12 }}
              onClick={async () => {
                if (!user) return;
                const r = await checkFeature(user.id, 'export-mp4');
                notify({
                  type: r.allowed ? 'success' : 'warning',
                  title: 'checkFeature(export-mp4)',
                  message: r.allowed ? 'Autorisé' : r.reason,
                });
              }}
            >
              Tester le contrôle serveur export-mp4
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>
              <Receipt size={14} /> Transactions
            </h3>
            {transactions.length === 0 && <p className="text-secondary">Aucune transaction.</p>}
            {transactions.map((t) => (
              <div key={t.id} className="card" style={{ padding: 10, marginBottom: 6, fontSize: 12 }}>
                {new Date(t.createdAt).toLocaleString()} · {t.description} · {formatMoney(t.amountCents, t.currency)} ·{' '}
                <strong>{t.status}</strong>
              </div>
            ))}
            <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Factures</h3>
            {invoices.length === 0 && <p className="text-secondary">Aucune facture.</p>}
            {invoices.map((i) => (
              <div key={i.id} className="card" style={{ padding: 10, marginBottom: 6, fontSize: 12 }}>
                {i.number} · {i.planId} · {formatMoney(i.amountCents, i.currency)} · {i.status}
              </div>
            ))}
          </div>
        )}

        {tab === 'admin' && (
          <div>
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <BarChart3 size={16} /> <strong>Statistiques</strong>
              </div>
              {adminStats ? (
                <div style={{ fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <span>Abonnements actifs : {adminStats.activeSubscriptions}</span>
                  <span>MRR : {formatMoney(adminStats.mrrCents)}</span>
                  <span>Tx réussies : {adminStats.transactionsSucceeded}</span>
                  <span>Revenu : {formatMoney(adminStats.revenueCents)}</span>
                </div>
              ) : (
                <button className="btn btn-ghost" onClick={() => loadAdmin()}>
                  Charger
                </button>
              )}
            </div>
            <div className="card" style={{ padding: 14 }}>
              <strong style={{ fontSize: 13 }}>Attribution manuelle (support)</strong>
              <p className="text-secondary" style={{ fontSize: 11, margin: '6px 0' }}>
                N’est <em>pas</em> un paiement. Réservé au support / dev. Optionnellement protégé par{' '}
                <code>BILLING_ADMIN_KEY</code>.
              </p>
              <input
                className="input"
                placeholder="Clé admin (si configurée)"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {(['free', 'premium', 'pro', 'teams'] as PlanId[]).map((pid) => (
                  <button
                    key={pid}
                    className="btn btn-ghost"
                    disabled={!user}
                    onClick={async () => {
                      if (!user) return;
                      const ok = await adminGrant(user.id, pid, adminKey || undefined);
                      notify({
                        type: ok ? 'success' : 'error',
                        title: ok ? `Plan ${pid} attribué (admin)` : 'Refusé',
                      });
                    }}
                  >
                    Grant {pid}
                  </button>
                ))}
              </div>
              {adminSubs.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 11 }}>
                  {adminSubs.slice(0, 20).map((s) => (
                    <div key={s.id}>
                      {s.userId.slice(0, 8)}… · {s.planId} · {s.status}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: '8px 12px', minWidth: 120 }}>
      <div className="text-secondary" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{value}</div>
    </div>
  );
}
