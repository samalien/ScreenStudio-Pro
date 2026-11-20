/**
 * AI studio state: provider configs, job queue, credits ledger (local estimate).
 */

import { create } from 'zustand';
import type {
  AICapability,
  AIJob,
  AIJobInput,
  AIProviderConfig,
  AIProviderId,
} from '../engine/ai/types';
import { ALL_PROVIDERS, defaultConfigs, getProvider } from '../engine/ai/providers';

const STORAGE_KEY = 'ssp_ai_provider_configs_v1';
const CREDITS_KEY = 'ssp_ai_credits_spent_v1';

function loadConfigs(): AIProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AIProviderConfig[];
      const defaults = defaultConfigs();
      return defaults.map((d) => {
        const saved = parsed.find((p) => p.id === d.id);
        return saved ? { ...d, ...saved, capabilities: d.capabilities } : d;
      });
    }
  } catch {
    /* */
  }
  return defaultConfigs();
}

function saveConfigs(configs: AIProviderConfig[]) {
  try {
    // persist keys — user machine only
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    /* */
  }
}

interface AIState {
  configs: AIProviderConfig[];
  jobs: AIJob[];
  spentUsd: number;
  selectedCapability: AICapability;
  selectedProviderId: AIProviderId | 'auto';

  setCapability: (c: AICapability) => void;
  setProviderId: (id: AIProviderId | 'auto') => void;
  updateConfig: (id: AIProviderId, patch: Partial<AIProviderConfig>) => void;
  saveAllConfigs: () => void;

  resolveProvider: (capability: AICapability) => { providerId: AIProviderId; config: AIProviderConfig } | null;

  runJob: (input: AIJobInput, providerId?: AIProviderId | 'auto') => Promise<AIJob>;
  cancelJob: (id: string) => void;
  clearJobs: () => void;
}

const aborters = new Map<string, AbortController>();

export const useAIStore = create<AIState>((set, get) => ({
  configs: loadConfigs(),
  jobs: [],
  spentUsd: Number(localStorage.getItem(CREDITS_KEY) || 0) || 0,
  selectedCapability: 'text-to-image',
  selectedProviderId: 'auto',

  setCapability: (c) => set({ selectedCapability: c }),
  setProviderId: (id) => set({ selectedProviderId: id }),

  updateConfig: (id, patch) => {
    set((s) => ({
      configs: s.configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  saveAllConfigs: () => {
    saveConfigs(get().configs);
  },

  resolveProvider: (capability) => {
    const { configs, selectedProviderId } = get();
    if (selectedProviderId !== 'auto') {
      const config = configs.find((c) => c.id === selectedProviderId);
      const provider = getProvider(selectedProviderId);
      if (!config || !provider) return null;
      if (!provider.capabilities.includes(capability)) return null;
      if (!config.enabled) return null;
      if (!provider.isConfigured(config) && provider.id !== 'browser') return null;
      return { providerId: selectedProviderId, config };
    }
    // auto: prefer configured remote, else browser
    const order: AIProviderId[] = ['openai', 'stability', 'elevenlabs', 'replicate', 'browser'];
    for (const id of order) {
      const config = configs.find((c) => c.id === id);
      const provider = getProvider(id);
      if (!config?.enabled || !provider) continue;
      if (!provider.capabilities.includes(capability)) continue;
      if (!provider.isConfigured(config) && id !== 'browser') continue;
      return { providerId: id, config };
    }
    return null;
  },

  runJob: async (input, providerId = 'auto') => {
    const capability = input.capability;
    const resolved =
      providerId === 'auto'
        ? get().resolveProvider(capability)
        : (() => {
            const config = get().configs.find((c) => c.id === providerId);
            if (!config) return null;
            return { providerId: providerId as AIProviderId, config };
          })();

    const id = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    if (!resolved) {
      const job: AIJob = {
        id,
        providerId: 'browser',
        capability,
        status: 'needs_config',
        input,
        progress: 0,
        message: 'Aucun fournisseur configuré pour cette capacité',
        error:
          'Configurez une clé API (OpenAI, Stability, ElevenLabs ou Replicate) dans l’onglet Réglages IA, ou choisissez une capacité supportée par le moteur Navigateur.',
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ jobs: [job, ...s.jobs].slice(0, 50) }));
      return job;
    }

    const provider = getProvider(resolved.providerId)!;
    const estimatedCost = resolved.config.costHints[capability];
    const job: AIJob = {
      id,
      providerId: resolved.providerId,
      capability,
      status: 'running',
      input,
      progress: 0.05,
      message: 'Démarrage…',
      createdAt: now,
      updatedAt: now,
      estimatedCost,
    };
    set((s) => ({ jobs: [job, ...s.jobs].slice(0, 50) }));

    const ac = new AbortController();
    aborters.set(id, ac);

    try {
      if (!provider.isConfigured(resolved.config) && provider.id !== 'browser') {
        throw new Error(`Clé API manquante pour ${provider.label}`);
      }
      const result = await provider.run(
        job,
        resolved.config,
        (ratio, message) => {
          set((s) => ({
            jobs: s.jobs.map((j) =>
              j.id === id
                ? { ...j, progress: ratio, message, updatedAt: Date.now(), status: 'running' }
                : j
            ),
          }));
        },
        ac.signal
      );

      set((s) => {
        const spent = s.spentUsd + (estimatedCost || 0);
        try {
          localStorage.setItem(CREDITS_KEY, String(spent));
        } catch {
          /* */
        }
        return {
          spentUsd: spent,
          jobs: s.jobs.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: 'succeeded' as const,
                  progress: 1,
                  message: 'Terminé',
                  result,
                  updatedAt: Date.now(),
                }
              : j
          ),
        };
      });
      return get().jobs.find((j) => j.id === id)!;
    } catch (err: any) {
      const message = String(err?.message || err);
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === id
            ? {
                ...j,
                status: ac.signal.aborted ? 'cancelled' : 'failed',
                error: message,
                message: ac.signal.aborted ? 'Annulé' : 'Échec',
                updatedAt: Date.now(),
              }
            : j
        ),
      }));
      return get().jobs.find((j) => j.id === id)!;
    } finally {
      aborters.delete(id);
    }
  },

  cancelJob: (id) => {
    aborters.get(id)?.abort();
  },

  clearJobs: () => set({ jobs: [] }),
}));
