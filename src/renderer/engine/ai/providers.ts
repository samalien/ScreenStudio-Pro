/**
 * Concrete AI providers.
 * Remote providers REQUIRE a valid API key — otherwise they fail clearly.
 * Local/browser providers implement only what the runtime can do offline.
 */

import type {
  AICapability,
  AIJob,
  AIJobResult,
  AIProvider,
  AIProviderConfig,
} from './types';

function requireKey(config: AIProviderConfig, name: string) {
  if (!config.apiKey?.trim()) {
    throw new Error(
      `${name} : aucune clé API configurée. Ouvrez Réglages IA et enregistrez votre clé.`
    );
  }
}

async function openaiChat(
  config: AIProviderConfig,
  system: string,
  user: string,
  signal?: AbortSignal
): Promise<string> {
  requireKey(config, 'OpenAI');
  const base = config.baseUrl || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.models.script || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 240)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/** OpenAI: images, TTS, text automation, STT */
export const openaiProvider: AIProvider = {
  id: 'openai',
  label: 'OpenAI',
  capabilities: [
    'text-to-image',
    'image-variation',
    'text-to-speech',
    'speech-to-text',
    'script',
    'titles',
    'description',
    'hashtags',
  ],
  isConfigured: (c) => !!c.apiKey?.trim(),
  async run(job, config, onProgress, signal) {
    requireKey(config, 'OpenAI');
    const base = config.baseUrl || 'https://api.openai.com/v1';
    const { capability, input } = job;

    if (capability === 'text-to-image') {
      if (!input.prompt?.trim()) throw new Error('Prompt requis');
      onProgress(0.2, 'Génération DALL·E…');
      const res = await fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.models['text-to-image'] || 'dall-e-3',
          prompt: input.prompt,
          n: 1,
          size: `${input.width || 1024}x${input.height || 1024}`,
          response_format: 'url',
        }),
        signal,
      });
      if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const url = data.data?.[0]?.url;
      if (!url) throw new Error('Aucune image renvoyée');
      onProgress(1, 'OK');
      return { type: 'image', url, mimeType: 'image/png', width: input.width || 1024, height: input.height || 1024 };
    }

    if (capability === 'text-to-speech') {
      if (!input.prompt?.trim()) throw new Error('Texte requis');
      onProgress(0.2, 'Synthèse vocale…');
      const res = await fetch(`${base}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.models['text-to-speech'] || 'tts-1',
          voice: input.voiceId || 'alloy',
          input: input.prompt,
        }),
        signal,
      });
      if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      onProgress(1, 'OK');
      return { type: 'audio', url, blob, mimeType: blob.type || 'audio/mpeg' };
    }

    if (capability === 'speech-to-text') {
      if (!input.sourceUrl) throw new Error('Fichier audio/vidéo requis');
      onProgress(0.2, 'Transcription Whisper…');
      const blob = await fetch(input.sourceUrl).then((r) => r.blob());
      const form = new FormData();
      form.append('file', blob, 'audio.webm');
      form.append('model', config.models['speech-to-text'] || 'whisper-1');
      if (input.language) form.append('language', input.language);
      const res = await fetch(`${base}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal,
      });
      if (!res.ok) throw new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      onProgress(1, 'OK');
      return { type: 'text', text: data.text || '' };
    }

    if (['script', 'titles', 'description', 'hashtags'].includes(capability)) {
      const prompts: Record<string, string> = {
        script: 'Tu es un scénariste vidéo. Écris un script concis (voix off + plans) pour :',
        titles: 'Propose 8 titres accrocheurs (une ligne chacun) pour une vidéo sur :',
        description: 'Rédige une description YouTube/TikTok optimisée SEO pour :',
        hashtags: 'Propose 15 hashtags pertinents (espace-séparés) pour :',
      };
      onProgress(0.3, 'Génération texte…');
      const text = await openaiChat(
        config,
        prompts[capability] || 'Assistant créatif multimédia.',
        input.prompt || 'montage vidéo professionnel',
        signal
      );
      onProgress(1, 'OK');
      return { type: 'text', text };
    }

    throw new Error(`OpenAI ne gère pas « ${capability} » dans cette intégration (ou modèle non branché).`);
  },
};

/** Stability AI — images */
export const stabilityProvider: AIProvider = {
  id: 'stability',
  label: 'Stability AI',
  capabilities: ['text-to-image', 'image-to-image'],
  isConfigured: (c) => !!c.apiKey?.trim(),
  async run(job, config, onProgress, signal) {
    requireKey(config, 'Stability AI');
    if (job.capability !== 'text-to-image' && job.capability !== 'image-to-image') {
      throw new Error('Stability : capacité non supportée ici');
    }
    if (!job.input.prompt?.trim()) throw new Error('Prompt requis');
    onProgress(0.2, 'Stability generate…');
    const base = config.baseUrl || 'https://api.stability.ai';
    const res = await fetch(
      `${base}/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text_prompts: [{ text: job.input.prompt, weight: 1 }],
          cfg_scale: 7,
          height: job.input.height || 1024,
          width: job.input.width || 1024,
          samples: 1,
          steps: 30,
        }),
        signal,
      }
    );
    if (!res.ok) throw new Error(`Stability ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const b64 = data.artifacts?.[0]?.base64;
    if (!b64) throw new Error('Aucune image Stability');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    onProgress(1, 'OK');
    return { type: 'image', url, blob, mimeType: 'image/png' };
  },
};

/** ElevenLabs — voices */
export const elevenLabsProvider: AIProvider = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  capabilities: ['text-to-speech'],
  isConfigured: (c) => !!c.apiKey?.trim(),
  async run(job, config, onProgress, signal) {
    requireKey(config, 'ElevenLabs');
    if (!job.input.prompt?.trim()) throw new Error('Texte requis');
    const voice = job.input.voiceId || '21m00Tcm4TlvDq8ikWAM';
    onProgress(0.2, 'ElevenLabs…');
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': config.apiKey!,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: job.input.prompt,
          model_id: config.models['text-to-speech'] || 'eleven_multilingual_v2',
        }),
        signal,
      }
    );
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const blob = await res.blob();
    onProgress(1, 'OK');
    return { type: 'audio', url: URL.createObjectURL(blob), blob, mimeType: 'audio/mpeg' };
  },
};

/**
 * Replicate gateway — video / avatar / bg remove when models configured.
 * Without token, fails explicitly.
 */
export const replicateProvider: AIProvider = {
  id: 'replicate',
  label: 'Replicate',
  capabilities: [
    'text-to-video',
    'image-to-video',
    'bg-remove',
    'upscale',
    'avatar',
    'lip-sync',
    'object-remove',
  ],
  isConfigured: (c) => !!c.apiKey?.trim(),
  async run(job, config, onProgress, signal) {
    requireKey(config, 'Replicate');
    const modelMap: Partial<Record<AICapability, string>> = {
      'text-to-video': config.models['text-to-video'] || 'anotherjesse/zeroscope-v2-xl',
      'image-to-video': config.models['image-to-video'] || 'stability-ai/stable-video-diffusion',
      'bg-remove': config.models['bg-remove'] || 'cjwbw/rembg',
      upscale: config.models.upscale || 'nightmareai/real-esrgan',
      avatar: config.models.avatar || '',
      'lip-sync': config.models['lip-sync'] || '',
      'object-remove': config.models['object-remove'] || '',
    };
    const model = modelMap[job.capability];
    if (!model) {
      throw new Error(
        `Replicate : aucun modèle configuré pour « ${job.capability} ». Renseignez models dans la config provider.`
      );
    }
    onProgress(0.1, `Création prédiction (${model})…`);
    // Simplified: many Replicate models need version hash — user must set full version in config
    const version = model.includes(':') ? model.split(':')[1] : null;
    if (!version && !model.includes('/')) {
      throw new Error('Indiquez un model version Replicate (owner/name:version)');
    }

    const input: Record<string, unknown> = {};
    if (job.input.prompt) input.prompt = job.input.prompt;
    if (job.input.sourceUrl) {
      input.image = job.input.sourceUrl;
      input.video = job.input.sourceUrl;
    }

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(version ? { version, input } : { model, input }),
      signal,
    });
    if (!createRes.ok) {
      throw new Error(`Replicate ${createRes.status}: ${(await createRes.text()).slice(0, 240)}`);
    }
    let prediction = await createRes.json();
    onProgress(0.3, prediction.status || 'starting');

    // Poll
    for (let i = 0; i < 120; i++) {
      if (signal?.aborted) throw new Error('Annulé');
      if (prediction.status === 'succeeded') break;
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(prediction.error || 'Prédiction Replicate échouée');
      }
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${config.apiKey}` },
        signal,
      });
      prediction = await poll.json();
      onProgress(0.3 + Math.min(0.6, i / 100), prediction.status);
    }
    if (prediction.status !== 'succeeded') throw new Error('Timeout Replicate');
    const out = prediction.output;
    const url = Array.isArray(out) ? out[0] : typeof out === 'string' ? out : out?.url;
    if (!url) throw new Error('Sortie Replicate vide');
    onProgress(1, 'OK');
    const isVideo = job.capability.includes('video') || job.capability === 'lip-sync';
    return {
      type: isVideo ? 'video' : 'image',
      url,
      mimeType: isVideo ? 'video/mp4' : 'image/png',
    };
  },
};

/**
 * Browser-only: Web Speech TTS, local heuristics (scene tips, titles templates).
 * Never claims cloud generation.
 */
export const browserProvider: AIProvider = {
  id: 'browser',
  label: 'Navigateur (local)',
  capabilities: ['text-to-speech', 'titles', 'hashtags', 'scene-detect'],
  isConfigured: () => true,
  async run(job, _config, onProgress) {
    if (job.capability === 'text-to-speech') {
      if (!job.input.prompt?.trim()) throw new Error('Texte requis');
      if (!window.speechSynthesis) throw new Error('speechSynthesis indisponible');
      onProgress(0.2, 'Synthèse navigateur…');
      // Record is not available via speechSynthesis — play only + note
      // We create a silent note result: user hears live but no file unless MediaRecorder captures
      // Better: use utterance and return text metadata; for file we document limitation
      await new Promise<void>((resolve, reject) => {
        const u = new SpeechSynthesisUtterance(job.input.prompt);
        u.lang = job.input.language === 'ar' ? 'ar-SA' : job.input.language === 'en' ? 'en-US' : 'fr-FR';
        u.onend = () => resolve();
        u.onerror = () => reject(new Error('Synthèse vocale navigateur échouée'));
        speechSynthesis.speak(u);
      });
      onProgress(1, 'Lu à voix haute (pas de fichier audio exportable via ce moteur)');
      return {
        type: 'text',
        text: `[TTS navigateur] Lecture effectuée. Pour un fichier audio, utilisez OpenAI ou ElevenLabs.`,
      };
    }

    if (job.capability === 'titles') {
      const topic = job.input.prompt || 'vidéo';
      const list = [
        `${topic} : le guide complet`,
        `Ce que personne ne dit sur ${topic}`,
        `${topic} en 60 secondes`,
        `Avant / Après : ${topic}`,
        `Erreur fatale avec ${topic}`,
        `Les 5 secrets de ${topic}`,
        `${topic} — version pro`,
        `Pourquoi ${topic} change tout`,
      ];
      onProgress(1, 'Templates locaux');
      return { type: 'text', text: list.join('\n') };
    }

    if (job.capability === 'hashtags') {
      const topic = (job.input.prompt || 'video').replace(/\s+/g, '');
      const tags = [
        `#${topic}`,
        '#montage',
        '#videoediting',
        '#capcut',
        '#creator',
        '#content',
        '#reels',
        '#shorts',
        '#viral',
        '#tutorial',
        '#filmmaking',
        '#edit',
        '#motion',
        '#screenstudio',
        '#fyp',
      ];
      onProgress(1, 'OK');
      return { type: 'text', text: tags.join(' ') };
    }

    if (job.capability === 'scene-detect') {
      if (!job.input.sourceUrl) {
        throw new Error('Fournissez une source vidéo (sourceUrl) pour la détection locale approximative.');
      }
      onProgress(0.3, 'Analyse énergie (approx. locale)…');
      // Lightweight: decode audio track energy changes as proxy for cuts
      try {
        const res = await fetch(job.input.sourceUrl);
        const arr = await res.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const buf = await ctx.decodeAudioData(arr.slice(0));
        await ctx.close();
        const ch = buf.getChannelData(0);
        const sr = buf.sampleRate;
        const step = Math.floor(0.5 * sr);
        const cuts: number[] = [0];
        let prev = 0;
        for (let i = 0; i + step < ch.length; i += step) {
          let e = 0;
          for (let j = 0; j < step; j += 64) e += Math.abs(ch[i + j]);
          e /= step / 64;
          if (Math.abs(e - prev) > 0.15 && i / sr - cuts[cuts.length - 1] > 1.5) {
            cuts.push(Math.round((i / sr) * 10) / 10);
          }
          prev = e;
        }
        onProgress(1, `${cuts.length} points`);
        return {
          type: 'json',
          json: { cuts, method: 'audio-energy-proxy', note: 'Approximation locale — pas une vraie détection visuelle de scènes.' },
          text: cuts.map((t, i) => `Scène ${i + 1}: ${t}s`).join('\n'),
        };
      } catch {
        throw new Error(
          'Impossible d’analyser ce média localement. Utilisez un fournisseur vision (Replicate) pour une vraie détection de scènes.'
        );
      }
    }

    throw new Error(`Moteur navigateur : « ${job.capability} » non disponible hors ligne.`);
  },
};

export const ALL_PROVIDERS: AIProvider[] = [
  openaiProvider,
  stabilityProvider,
  elevenLabsProvider,
  replicateProvider,
  browserProvider,
];

export function getProvider(id: string): AIProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export function defaultConfigs(): AIProviderConfig[] {
  return [
    {
      id: 'openai',
      label: 'OpenAI',
      enabled: true,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      models: {
        'text-to-image': 'dall-e-3',
        'text-to-speech': 'tts-1',
        'speech-to-text': 'whisper-1',
        script: 'gpt-4o-mini',
      },
      costHints: {
        'text-to-image': 0.04,
        'text-to-speech': 0.015,
        script: 0.002,
      },
      capabilities: openaiProvider.capabilities,
    },
    {
      id: 'stability',
      label: 'Stability AI',
      enabled: false,
      apiKey: '',
      models: { 'text-to-image': 'stable-diffusion-xl-1024-v1-0' },
      costHints: { 'text-to-image': 0.02 },
      capabilities: stabilityProvider.capabilities,
    },
    {
      id: 'elevenlabs',
      label: 'ElevenLabs',
      enabled: false,
      apiKey: '',
      models: { 'text-to-speech': 'eleven_multilingual_v2' },
      costHints: { 'text-to-speech': 0.02 },
      capabilities: elevenLabsProvider.capabilities,
    },
    {
      id: 'replicate',
      label: 'Replicate',
      enabled: false,
      apiKey: '',
      models: {
        'text-to-video': '',
        'image-to-video': '',
        'bg-remove': 'cjwbw/rembg',
        upscale: 'nightmareai/real-esrgan',
      },
      costHints: { 'text-to-video': 0.2, 'bg-remove': 0.01 },
      capabilities: replicateProvider.capabilities,
    },
    {
      id: 'browser',
      label: 'Navigateur (local)',
      enabled: true,
      models: {},
      costHints: {},
      capabilities: browserProvider.capabilities,
    },
  ];
}
