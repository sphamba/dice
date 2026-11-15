import { BOX, GLASS, dieModes, plateModes } from './modes.js';

export const MIN_EVENT_SPEED = 0.15;

export const PAIR_GAP = 0.04;

export const MAX_VOICES = 12;

export const MAX_DURATION = 0.6;

export const FULL_BRIGHTNESS_SPEED = 2;

export const MIN_IMPULSE = 1e-4;

export const MAX_IMPULSE = 1e-1;

const MIN_DURATION = 0.05;

const TAIL_DECAYS = 5;

const PAIR_GAP_PRUNE = 64;

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

// Log scale: a tenfold impulse is a fixed loudness step, and MIN_IMPULSE is silence.
function gainForImpulse(impulse) {
  if (!(impulse > MIN_IMPULSE)) return 0;
  if (impulse >= MAX_IMPULSE) return 1;
  return Math.log(impulse / MIN_IMPULSE) / Math.log(MAX_IMPULSE / MIN_IMPULSE);
}

function plateArgs(surface, point, box) {
  const { W, H, D } = box;
  if (surface === 'wall') {
    const xEdge = Math.abs(point[0]) - W / 2;
    const yEdge = Math.abs(point[1]) - H / 2;
    return xEdge >= yEdge
      ? [W, D, point[1] + W / 2, point[2], BOX]
      : [H, D, point[0] + H / 2, point[2], BOX];
  }
  return [W, H, point[0] + W / 2, point[1] + H / 2, surface === 'lid' ? GLASS : BOX];
}

function modesFor(event, box) {
  const modes = [];
  if (event.surface !== 'die') modes.push(...plateModes(...plateArgs(event.surface, event.point, box)));
  for (const body of [event.a, event.b]) {
    if (body?.shape?.type) modes.push(...dieModes(body.shape.type, body.shape.radius));
  }
  return modes.sort((x, y) => x.f - y.f);
}

function renderModes(context, modes, speed) {
  const brightness = clamp(speed / FULL_BRIGHTNESS_SPEED, 0, 1);
  const peakTau = modes.reduce((max, mode) => Math.max(max, mode.tau), 0);
  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, TAIL_DECAYS * peakTau));
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(duration * sampleRate), sampleRate);
  const data = buffer.getChannelData(0);
  const last = Math.max(modes.length - 1, 1);
  const weights = modes.map(
    (mode, index) => mode.amp * (1 - (1 - brightness) * (index / last)),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const scale = total > 0 ? 1 / total : 0;
  for (let index = 0; index < modes.length; index += 1) {
    const amplitude = weights[index] * scale;
    if (amplitude <= 0) continue;
    const mode = modes[index];
    const phaseStep = (2 * Math.PI * mode.f) / sampleRate;
    const decay = Math.exp(-1 / (mode.tau * sampleRate));
    let envelope = amplitude;
    for (let sample = 0; sample < data.length; sample += 1) {
      data[sample] += envelope * Math.sin(phaseStep * sample);
      envelope *= decay;
      if (envelope < 1e-4) break;
    }
  }
  return buffer;
}

export function createSound() {
  let context = null;
  let master = null;
  const voices = [];
  const pairTimes = new Map();
  const bodyIds = new Map();

  function idOf(body) {
    if (!bodyIds.has(body)) bodyIds.set(body, bodyIds.size);
    return bodyIds.get(body);
  }

  function pairKey(event) {
    return event.b ? `${idOf(event.a)}|${idOf(event.b)}` : `${idOf(event.a)}|${event.surface}`;
  }

  function prunePairs() {
    for (const [key, time] of pairTimes) {
      if (context.currentTime - time >= PAIR_GAP) pairTimes.delete(key);
    }
  }

  function release(voice) {
    const index = voices.indexOf(voice);
    if (index !== -1) voices.splice(index, 1);
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  function playVoice(event, box) {
    const modes = modesFor(event, box);
    const gainValue = gainForImpulse(event.impulse);
    if (modes.length === 0 || gainValue <= 0) return false;
    if (voices.length >= MAX_VOICES) {
      let quietest = voices[0];
      for (const voice of voices) if (voice.gainValue < quietest.gainValue) quietest = voice;
      quietest.source.stop();
      release(quietest);
    }
    const source = context.createBufferSource();
    source.buffer = renderModes(context, modes, event.speed);
    const node = context.createGain();
    node.gain.value = gainValue;
    source.connect(node);
    node.connect(master);
    const voice = { source, gain: node, gainValue };
    source.onended = () => release(voice);
    voices.push(voice);
    source.start();
    return true;
  }

  return {
    async resume() {
      if (!context) {
        const AudioCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        if (typeof AudioCtor !== 'function') return;
        context = new AudioCtor();
        master = context.createDynamicsCompressor();
        master.connect(context.destination);
      }
      if (context.state !== 'running') await context.resume();
    },
    play(events, box) {
      if (!context) return 0;
      if (pairTimes.size > PAIR_GAP_PRUNE) prunePairs();
      let played = 0;
      for (const event of events ?? []) {
        if (!event?.a || !(event.speed >= MIN_EVENT_SPEED)) continue;
        const key = pairKey(event);
        const previous = pairTimes.get(key);
        if (previous !== undefined && context.currentTime - previous < PAIR_GAP) continue;
        pairTimes.set(key, context.currentTime);
        if (playVoice(event, box)) played += 1;
      }
      return played;
    },
  };
}
