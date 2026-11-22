import { BOX, GLASS, dieModes, plateModes } from './modes.js';

export const MIN_EVENT_SPEED = 0.15;

export const PAIR_GAP = 0.04;

export const SLOT_OVERRIDE = 1.5;

export const MAX_VOICES = 12;

export const MAX_DURATION = 0.6;

export const FULL_BRIGHTNESS_SPEED = 2;

export const MIN_IMPULSE = 1e-4;

export const MAX_IMPULSE = 0.015;

export const LIMITER_CEILING = 10 ** (-3 / 20);

export const CLIPPER_RANGE = 4;

const CURVE_POINTS = 4097;

const MAX_CURVE = 1 - 2 ** -24;

function clipperCurve() {
  const curve = new Float32Array(CURVE_POINTS);
  const half = (CURVE_POINTS - 1) / 2;
  for (let index = 0; index < CURVE_POINTS; index += 1) {
    const s = ((index - half) / half) * CLIPPER_RANGE;
    const magnitude = Math.abs(s);
    const shaped =
      magnitude <= LIMITER_CEILING
        ? s
        : Math.sign(s) *
          (LIMITER_CEILING +
            (1 - LIMITER_CEILING) *
              Math.tanh((magnitude - LIMITER_CEILING) / (1 - LIMITER_CEILING)));
    curve[index] = Math.min(Math.max(shaped, -MAX_CURVE), MAX_CURVE);
  }
  return curve;
}

const MIN_DURATION = 0.05;

const TAIL_DECAYS = 8;

const END_FADE = 0.003;

const PAIR_GAP_PRUNE = 64;

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

// Linear in the impulse: MIN_IMPULSE is silence and MAX_IMPULSE is a full voice.
export function gainForImpulse(impulse) {
  if (!(impulse > MIN_IMPULSE)) return 0;
  return Math.min(1, impulse / MAX_IMPULSE);
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
  const fade = Math.min(Math.ceil(END_FADE * sampleRate), data.length);
  for (let index = 0; index < fade; index += 1) {
    data[data.length - 1 - index] *= index / (fade - 1);
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
    for (const [key, slot] of pairTimes) {
      if (context.currentTime - slot.time >= PAIR_GAP) pairTimes.delete(key);
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
    node.gain.value = gainValue * LIMITER_CEILING;
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
        const shaper = context.createWaveShaper();
        shaper.curve = clipperCurve();
        shaper.oversample = '4x';
        master = context.createGain();
        master.gain.value = 1 / CLIPPER_RANGE;
        master.connect(shaper);
        shaper.connect(context.destination);
      }
      if (context.state !== 'running') await context.resume();
    },
    play(events, box) {
      if (!context) return 0;
      if (pairTimes.size > PAIR_GAP_PRUNE) prunePairs();
      const strongest = new Map();
      for (const event of events ?? []) {
        const key = pairKey(event);
        const best = strongest.get(key);
        if (best === undefined || event.impulse > best.impulse) strongest.set(key, event);
      }
      let played = 0;
      for (const event of events ?? []) {
        if (!event?.a || !(event.speed >= MIN_EVENT_SPEED)) continue;
        const key = pairKey(event);
        if (strongest.get(key) !== event) continue;
        const slot = pairTimes.get(key);
        if (slot !== undefined && context.currentTime - slot.time < PAIR_GAP) {
          if (!(event.impulse >= SLOT_OVERRIDE * slot.impulse)) continue;
        }
        if (!playVoice(event, box)) continue;
        pairTimes.set(key, { time: context.currentTime, impulse: event.impulse });
        played += 1;
      }
      return played;
    },
  };
}
