/**
 * Professional audio engine — Web Audio API + HTMLMediaElement preview.
 * Preview uses <audio>/<video> elements (reliable with blob: URLs).
 * Export uses OfflineAudioContext mix.
 */

import type { Clip, AudioSettings } from './types';
import { defaultAudioSettings } from './types';

let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

export async function resumeAudio(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch (err) {
    console.warn('resumeAudio', err);
  }
}

const bufferCache = new Map<string, AudioBuffer>();

export async function decodeAudioUrl(url: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const ctx = getAudioContext();
    const buf = await ctx.decodeAudioData(arr.slice(0));
    bufferCache.set(url, buf);
    return buf;
  } catch (err) {
    console.warn('decodeAudioUrl failed', url, err);
    return null;
  }
}

export function clearAudioCache(url?: string) {
  if (url) bufferCache.delete(url);
  else bufferCache.clear();
}

export async function computeWaveform(url: string, samples = 128): Promise<number[]> {
  const buf = await decodeAudioUrl(url);
  if (!buf) return Array(samples).fill(0.15);
  const ch = buf.getChannelData(0);
  const block = Math.max(1, Math.floor(ch.length / samples));
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < ch.length; j++) {
      max = Math.max(max, Math.abs(ch[start + j]));
    }
    peaks.push(max);
  }
  return peaks;
}

function normalizeGain(buf: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  if (peak < 0.001) return 1;
  return Math.min(4, 0.95 / peak);
}

function fadeMultiplier(clip: Clip, timelineTime: number): number {
  const rel = timelineTime - clip.start;
  let m = 1;
  if (clip.fadeIn > 0 && rel < clip.fadeIn) m = Math.min(m, rel / clip.fadeIn);
  if (clip.fadeOut > 0 && rel > clip.duration - clip.fadeOut) {
    m = Math.min(m, (clip.duration - rel) / clip.fadeOut);
  }
  return Math.max(0, Math.min(1, m));
}

function sourceOffset(clip: Clip, timelineTime: number): number {
  const speed = Math.abs(clip.speed || 1) || 1;
  const rel = Math.max(0, timelineTime - clip.start);
  return Math.max(0, clip.trimStart + rel * speed);
}

function connectChain(
  ctx: BaseAudioContext,
  source: AudioNode,
  clip: Clip,
  dest: AudioNode
) {
  const audio = clip.audio || defaultAudioSettings();
  let node: AudioNode = source;

  if (audio.noiseGate > 0.05) {
    const comp = (ctx as AudioContext).createDynamicsCompressor();
    comp.threshold.value = -50 + audio.noiseGate * 35;
    comp.knee.value = 6;
    comp.ratio.value = 8 + audio.noiseGate * 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    node.connect(comp);
    node = comp;
  }

  if (audio.lowGain || audio.midGain || audio.highGain || audio.vocalEnhance) {
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 250;
    low.gain.value = (audio.lowGain || 0) * 12 + (audio.vocalEnhance || 0) * -3;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 1;
    mid.gain.value = (audio.midGain || 0) * 12 + (audio.vocalEnhance || 0) * 4;

    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 4000;
    high.gain.value = (audio.highGain || 0) * 12 + (audio.vocalEnhance || 0) * 2;

    node.connect(low);
    low.connect(mid);
    mid.connect(high);
    node = high;
  }

  if (audio.echo > 0.05) {
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = audio.echo * 0.45;
    const wet = ctx.createGain();
    wet.gain.value = audio.echo * 0.5;
    node.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    const merge = ctx.createGain();
    node.connect(merge);
    wet.connect(merge);
    node = merge;
  }

  if (audio.reverb > 0.05) {
    const wet = ctx.createGain();
    wet.gain.value = audio.reverb * 0.4;
    const dry = ctx.createGain();
    dry.gain.value = 1 - audio.reverb * 0.3;
    const delays = [0.03, 0.05, 0.07].map((t) => {
      const d = ctx.createDelay(0.2);
      d.delayTime.value = t;
      return d;
    });
    const merge = ctx.createGain();
    node.connect(dry);
    dry.connect(merge);
    delays.forEach((d) => {
      node.connect(d);
      d.connect(wet);
    });
    wet.connect(merge);
    node = merge;
  }

  if (typeof (ctx as AudioContext).createStereoPanner === 'function') {
    const panner = (ctx as AudioContext).createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, audio.pan || 0));
    node.connect(panner);
    node = panner;
  }

  const gain = ctx.createGain();
  gain.gain.value = clip.muted ? 0 : clip.volume ?? 1;
  node.connect(gain);
  gain.connect(dest);
  return gain;
}

/**
 * Reliable live preview mixer using HTMLAudioElement.
 * createMediaElementSource is only called once per element.
 */
export class LiveAudioMixer {
  private elements = new Map<string, HTMLAudioElement>();
  private connected = new Set<string>(); // src already connected to Web Audio
  private mediaSources = new Map<string, MediaElementAudioSourceNode>();
  private playing = false;
  private raf = 0;
  private clips: Clip[] = [];
  private trackMuted = new Set<number>();
  private getTime: () => number = () => 0;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private useWebAudio = true;

  private ensureGraph() {
    if (this.master) return;
    try {
      this.ctx = getAudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
    } catch {
      this.useWebAudio = false;
    }
  }

  private getElement(clip: Clip): HTMLAudioElement {
    let el = this.elements.get(clip.id);
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      // Don't set crossOrigin on blob: URLs — it can block playback
      if (clip.src && !clip.src.startsWith('blob:')) {
        el.crossOrigin = 'anonymous';
      }
      el.src = clip.src;
      this.elements.set(clip.id, el);
    } else if (el.src !== clip.src && clip.src) {
      el.src = clip.src;
      this.connected.delete(clip.id);
      this.mediaSources.delete(clip.id);
    }
    return el;
  }

  private routeElement(clip: Clip, el: HTMLAudioElement) {
    if (!this.useWebAudio || !this.ctx || !this.master) {
      el.volume = Math.min(1, Math.max(0, clip.muted ? 0 : clip.volume ?? 1));
      return;
    }
    if (!this.connected.has(clip.id)) {
      try {
        const srcNode = this.ctx.createMediaElementSource(el);
        this.mediaSources.set(clip.id, srcNode);
        // Connect through a simple gain for volume; full EQ chain on live media elements
        // is applied approximately via element volume + pan not available on element alone
        const g = this.ctx.createGain();
        g.gain.value = 1;
        srcNode.connect(g);
        g.connect(this.master);
        this.connected.add(clip.id);
        // Element volume drives level when using media element source
        el.volume = 1;
      } catch (err) {
        // Already connected or CORS — fall back to element volume directly
        console.warn('MediaElementSource failed, using element volume', err);
        this.useWebAudio = false;
        el.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
      }
    }
  }

  stopAll() {
    cancelAnimationFrame(this.raf);
    this.playing = false;
    this.elements.forEach((el) => {
      try {
        el.pause();
      } catch {
        /* */
      }
    });
  }

  /**
   * Start or update playback for all audible clips at current timeline time.
   */
  async play(
    clips: Clip[],
    timelineTime: number,
    trackMuted: Set<number>,
    getTime?: () => number
  ) {
    await resumeAudio();
    this.ensureGraph();
    this.clips = clips;
    this.trackMuted = trackMuted;
    this.getTime = getTime || (() => timelineTime);
    this.playing = true;

    await this.syncElements(timelineTime, true);

    const tick = () => {
      if (!this.playing) return;
      const t = this.getTime();
      void this.syncElements(t, false);
      this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  private async syncElements(timelineTime: number, forceSeek: boolean) {
    const activeIds = new Set<string>();

    for (const clip of this.clips) {
      if (clip.type !== 'audio' && clip.type !== 'video') continue;
      if (!clip.src || clip.muted || this.trackMuted.has(clip.track)) continue;
      if (timelineTime < clip.start || timelineTime >= clip.start + clip.duration) continue;

      activeIds.add(clip.id);
      const el = this.getElement(clip);
      this.routeElement(clip, el);

      const speed = Math.abs(clip.speed || 1) || 1;
      const want = sourceOffset(clip, timelineTime);
      const fade = fadeMultiplier(clip, timelineTime);
      const vol = Math.min(1, Math.max(0, (clip.volume ?? 1) * fade));

      try {
        el.playbackRate = speed;
      } catch {
        /* */
      }

      // Volume: if web audio graph, still use element.volume as input level
      el.volume = vol;

      const needsSeek =
        forceSeek ||
        el.paused ||
        !isFinite(el.currentTime) ||
        Math.abs(el.currentTime - want) > 0.35;

      if (needsSeek) {
        try {
          if (isFinite(want)) el.currentTime = want;
        } catch {
          /* */
        }
      }

      if (el.paused) {
        try {
          await el.play();
        } catch (err) {
          // Autoplay policy — try resume context again
          await resumeAudio();
          try {
            await el.play();
          } catch (e2) {
            console.warn('audio play failed', clip.name, e2);
          }
        }
      }
    }

    // Pause elements no longer active
    this.elements.forEach((el, id) => {
      if (!activeIds.has(id) && !el.paused) {
        el.pause();
      }
    });
  }

  setMasterVolume(v: number) {
    if (this.master) this.master.gain.value = v;
  }

  dispose() {
    this.stopAll();
    this.elements.forEach((el) => {
      el.src = '';
    });
    this.elements.clear();
    this.mediaSources.clear();
    this.connected.clear();
  }
}

let liveMixer: LiveAudioMixer | null = null;
export function getLiveMixer() {
  if (!liveMixer) liveMixer = new LiveAudioMixer();
  return liveMixer;
}

/** Offline mix for export */
export async function mixTimelineAudio(
  clips: Clip[],
  durationSec: number,
  sampleRate = 48000
): Promise<AudioBuffer | null> {
  const audioClips = clips.filter(
    (c) => (c.type === 'audio' || c.type === 'video') && c.src && !c.muted
  );
  if (!audioClips.length || durationSec <= 0) return null;

  await Promise.all(audioClips.map((c) => decodeAudioUrl(c.src)));

  const length = Math.ceil(durationSec * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  for (const clip of audioClips) {
    const buf = bufferCache.get(clip.src);
    if (!buf) continue;

    const speed = Math.abs(clip.speed || 1) || 1;
    const source = offline.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = speed;

    const audio = clip.audio || defaultAudioSettings();
    if (audio.pitch) source.detune.value = audio.pitch * 100;

    let norm = 1;
    if (audio.normalize) norm = normalizeGain(buf);

    const gain = offline.createGain();
    const start = clip.start;
    const vol = (clip.volume ?? 1) * norm;
    const t0 = start;
    const t1 = start + clip.duration;
    if (clip.fadeIn > 0) {
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + clip.fadeIn);
    } else {
      gain.gain.setValueAtTime(vol, t0);
    }
    if (clip.fadeOut > 0) {
      gain.gain.setValueAtTime(vol, Math.max(t0, t1 - clip.fadeOut));
      gain.gain.linearRampToValueAtTime(0, t1);
    } else {
      gain.gain.setValueAtTime(0, t1 + 0.01);
    }

    connectChain(offline, source, { ...clip, volume: 1, audio: { ...audio, normalize: false } }, gain);
    gain.connect(offline.destination);

    const bufferOffset = clip.trimStart;
    const playDur = Math.min(clip.duration * speed, Math.max(0, buf.duration - bufferOffset));
    try {
      source.start(Math.max(0, start), bufferOffset, playDur);
    } catch {
      /* */
    }
  }

  try {
    return await offline.startRendering();
  } catch (err) {
    console.error('Offline mix failed', err);
    return null;
  }
}

export function audioBufferToMediaStream(buffer: AudioBuffer): MediaStream {
  const ctx = getAudioContext();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(dest);
  source.start(0);
  return dest.stream;
}

export type ExtractAudioResult = {
  blob: Blob;
  url: string;
  duration: number;
  method: 'decode' | 'captureStream' | 'mediaElement';
};

export type ExtractAudioError = {
  code: 'no_audio' | 'decode_failed' | 'load_failed' | 'empty';
  message: string;
};

/**
 * Robust audio extraction from a video (or audio) URL.
 * 1) decodeAudioData (works for many audio files / some containers)
 * 2) HTMLVideoElement.captureStream() + MediaRecorder (best for WebM/Opus captures)
 * 3) MediaElementSource → Offline-like realtime record via MediaStreamDestination
 */
export async function extractAudioFromVideo(
  videoUrl: string
): Promise<ExtractAudioResult | null> {
  if (!videoUrl) return null;

  // —— Method 1: direct decode ——
  try {
    const buf = await decodeAudioUrl(videoUrl);
    if (buf && buf.duration > 0.05 && buf.length > 0) {
      // Reject near-silent buffers (no real audio track)
      let peak = 0;
      const ch = buf.getChannelData(0);
      const step = Math.max(1, Math.floor(ch.length / 5000));
      for (let i = 0; i < ch.length; i += step) peak = Math.max(peak, Math.abs(ch[i]));
      if (peak > 0.0008) {
        const wav = audioBufferToWav(buf);
        const blob = new Blob([wav], { type: 'audio/wav' });
        return { blob, url: URL.createObjectURL(blob), duration: buf.duration, method: 'decode' };
      }
    }
  } catch (err) {
    console.warn('[extractAudio] decode path failed', err);
  }

  // —— Method 2 & 3: element-based ——
  await resumeAudio();
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  // crossOrigin on blob: URLs can block loading in Electron
  if (videoUrl && !videoUrl.startsWith('blob:') && !videoUrl.startsWith('file:')) {
    video.crossOrigin = 'anonymous';
  }
  // volume 0 keeps captureStream audio in Chromium while staying silent to the user
  video.volume = 0;
  video.muted = false;
  video.src = videoUrl;

  const loaded = await new Promise<boolean>((resolve) => {
    const to = window.setTimeout(() => resolve(false), 12000);
    video.onloadedmetadata = () => {
      window.clearTimeout(to);
      resolve(true);
    };
    video.onerror = () => {
      window.clearTimeout(to);
      resolve(false);
    };
  });
  if (!loaded || !isFinite(video.duration) || video.duration < 0.05) {
    video.removeAttribute('src');
    video.load();
    return null;
  }

  const duration = video.duration;

  // Probe: does the media report audio tracks?
  const anyMedia = video as HTMLVideoElement & {
    audioTracks?: { length: number };
  };
  const hasAudioTrackList =
    typeof anyMedia.audioTracks === 'undefined' || anyMedia.audioTracks.length > 0;

  // Method 2: captureStream audio tracks → MediaRecorder
  try {
    const stream: MediaStream | null =
      typeof (video as any).captureStream === 'function'
        ? (video as any).captureStream()
        : typeof (video as any).mozCaptureStream === 'function'
          ? (video as any).mozCaptureStream()
          : null;

    if (stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioOnly = new MediaStream(audioTracks);
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
        const chunks: Blob[] = [];
        const recorder = mime
          ? new MediaRecorder(audioOnly, { mimeType: mime })
          : new MediaRecorder(audioOnly);

        const recorded = new Promise<Blob>((resolve, reject) => {
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onerror = () => reject(new Error('MediaRecorder error'));
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
          };
        });

        recorder.start(100);
        video.currentTime = 0;
        try {
          await video.play();
        } catch {
          /* autoplay policies — try muted play then unmute for capture */
          video.muted = true;
          await video.play().catch(() => undefined);
          video.muted = false;
        }

        await new Promise<void>((resolve) => {
          const done = () => resolve();
          video.onended = done;
          // Safety: duration + margin
          window.setTimeout(done, Math.min(duration * 1000 + 500, 10 * 60 * 1000));
        });

        if (recorder.state !== 'inactive') recorder.stop();
        video.pause();

        const blob = await recorded;
        stream.getTracks().forEach((t) => t.stop());

        if (blob.size > 256) {
          // Prefer WAV if we can decode the webm audio
          try {
            const tmpUrl = URL.createObjectURL(blob);
            const buf = await decodeAudioUrl(tmpUrl);
            URL.revokeObjectURL(tmpUrl);
            if (buf && buf.duration > 0.05) {
              const wav = audioBufferToWav(buf);
              const wavBlob = new Blob([wav], { type: 'audio/wav' });
              video.removeAttribute('src');
              video.load();
              return {
                blob: wavBlob,
                url: URL.createObjectURL(wavBlob),
                duration: buf.duration,
                method: 'captureStream',
              };
            }
          } catch {
            /* keep webm blob */
          }
          video.removeAttribute('src');
          video.load();
          return {
            blob,
            url: URL.createObjectURL(blob),
            duration,
            method: 'captureStream',
          };
        }
      } else if (!hasAudioTrackList) {
        stream.getTracks().forEach((t) => t.stop());
        video.removeAttribute('src');
        video.load();
        return null;
      } else {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
  } catch (err) {
    console.warn('[extractAudio] captureStream path failed', err);
  }

  // Method 3: Web Audio MediaElementSource → MediaStreamDestination → MediaRecorder
  try {
    const ctx = getAudioContext();
    await resumeAudio();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    const silent = ctx.createGain();
    silent.gain.value = 0; // don't play to speakers
    source.connect(dest);
    source.connect(silent);
    silent.connect(ctx.destination);

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime });
    const recorded = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });

    video.currentTime = 0;
    video.volume = 1;
    recorder.start(100);
    await video.play().catch(() => undefined);

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
      window.setTimeout(() => resolve(), Math.min(duration * 1000 + 500, 10 * 60 * 1000));
    });
    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    const blob = await recorded;

    try {
      source.disconnect();
      silent.disconnect();
    } catch {
      /* */
    }

    video.removeAttribute('src');
    video.load();

    if (blob.size > 256) {
      return {
        blob,
        url: URL.createObjectURL(blob),
        duration,
        method: 'mediaElement',
      };
    }
  } catch (err) {
    console.warn('[extractAudio] mediaElement path failed', err);
    video.removeAttribute('src');
    video.load();
  }

  return null;
}

/** Human-readable reason when extraction returns null */
export async function diagnoseVideoAudio(videoUrl: string): Promise<ExtractAudioError> {
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = videoUrl;
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => resolve();
      setTimeout(() => resolve(), 5000);
    });
    if (!isFinite(video.duration)) {
      return { code: 'load_failed', message: 'Impossible de charger le média.' };
    }
    const stream =
      typeof (video as any).captureStream === 'function' ? (video as any).captureStream() : null;
    if (stream) {
      const n = stream.getAudioTracks().length;
      stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      if (n === 0) {
        return {
          code: 'no_audio',
          message:
            'Ce fichier n’a pas de piste audio (capture écran sans micro / vidéo muette).',
        };
      }
    }
  } catch {
    /* */
  }
  return {
    code: 'decode_failed',
    message:
      'Décodage audio impossible pour ce format. Réessayez avec un MP4/WebM contenant du son, ou importez un fichier audio séparé.',
  };
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const samples = buffer.length;
  const blockAlign = (numChan * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChan; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChan; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return ab;
}

export async function recordMicrophone(
  onStart: () => void,
  signal: { stopped: boolean }
): Promise<{ blob: Blob; url: string; duration: number }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const started = Date.now();
  onStart();
  recorder.start(100);

  await new Promise<void>((resolve) => {
    const check = () => {
      if (signal.stopped) {
        recorder.stop();
        resolve();
      } else requestAnimationFrame(check);
    };
    check();
  });

  await new Promise<void>((r) => {
    recorder.onstop = () => r();
  });
  stream.getTracks().forEach((t) => t.stop());
  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const duration = Math.max(0.5, (Date.now() - started) / 1000);
  return { blob, url, duration };
}
