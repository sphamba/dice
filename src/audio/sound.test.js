import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  LIMITER_CEILING,
  LIMITER_THRESHOLD_DB,
  MAX_DURATION,
  MAX_IMPULSE,
  MAX_VOICES,
  MIN_EVENT_SPEED,
  MIN_IMPULSE,
  PAIR_GAP,
  createSound,
  gainForImpulse,
} from './sound.js';
import { DIE_RADIUS } from '../physics/body.js';

const BOX = { W: 0.1, H: 0.08, D: 0.06 };

const die = () => ({ shape: { type: 'd6', radius: DIE_RADIUS } });

const impact = (overrides = {}) => ({
  a: die(),
  b: undefined,
  surface: 'floor',
  point: [0.01, 0.02, 0],
  speed: 1,
  impulse: 0.001,
  ...overrides,
});

function fakeAudio() {
  const created = { buffers: [], sources: [], gains: [], contexts: [], compressors: 0, resumes: 0 };
  class FakeContext {
    constructor() {
      this.sampleRate = 4000;
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = { name: 'destination' };
      created.contexts.push(this);
    }

    resume() {
      created.resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createDynamicsCompressor() {
      created.compressors += 1;
      const param = () => ({ value: 0 });
      created.compressor = {
        threshold: param(),
        knee: param(),
        ratio: param(),
        attack: param(),
        release: param(),
        connect() {},
      };
      return created.compressor;
    }

    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buffer = { length, sampleRate, getChannelData: () => data };
      created.buffers.push(buffer);
      return buffer;
    }

    createGain() {
      const gain = { gain: { value: 1 }, connect() {}, disconnect() {} };
      created.gains.push(gain);
      return gain;
    }

    createBufferSource() {
      const source = {
        buffer: null,
        started: 0,
        stopped: 0,
        onended: null,
        connect() {},
        disconnect() {},
        start() {
          source.started += 1;
        },
        stop() {
          source.stopped += 1;
        },
      };
      created.sources.push(source);
      return source;
    }
  }
  return { FakeContext, created };
}

let audio;

beforeEach(() => {
  audio = fakeAudio();
  globalThis.AudioContext = audio.FakeContext;
});

afterEach(() => {
  delete globalThis.AudioContext;
});

test('stays silent until resume creates the audio context', () => {
  const sound = createSound();
  sound.play([impact()], BOX);
  expect(audio.created.sources).toHaveLength(0);
  expect(audio.created.compressors).toBe(0);
});

test('creates one context on resume and routes through a compressor', async () => {
  const sound = createSound();
  await sound.resume();
  await sound.resume();
  expect(audio.created.compressors).toBe(1);
  expect(audio.created.contexts).toHaveLength(1);
  expect(audio.created.resumes).toBe(1);
});

test('does not resume without an audio context constructor', async () => {
  delete globalThis.AudioContext;
  const sound = createSound();
  await sound.resume();
  sound.play([impact()], BOX);
  expect(audio.created.sources).toHaveLength(0);
});

test('ignores impacts below the speed gate', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact({ speed: MIN_EVENT_SPEED - 0.01 })], BOX);
  expect(audio.created.sources).toHaveLength(0);
});

test('renders one damped-sinusoid buffer per impact', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact()], BOX);
  expect(audio.created.buffers).toHaveLength(1);
  const buffer = audio.created.buffers[0];
  expect(buffer.length).toBeLessThanOrEqual(0.6 * buffer.sampleRate);
  expect(buffer.length).toBeGreaterThan(0);
  const data = buffer.getChannelData();
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  expect(peak).toBeGreaterThan(0);
  expect(peak).toBeLessThanOrEqual(1);
  expect(audio.created.sources[0].started).toBe(1);
});

test('mixes the die modes for die-to-die impacts', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact({ surface: 'die', b: die(), point: [0, 0, 0.03] })], BOX);
  expect(audio.created.sources).toHaveLength(1);
});

test('plays each plate surface without failing', async () => {
  const sound = createSound();
  await sound.resume();
  for (const surface of ['floor', 'lid', 'wall']) {
    sound.play([impact({ a: die(), surface })], BOX);
  }
  sound.play([impact({ surface: 'wall', point: [0, BOX.H / 2, 0.03] })], BOX);
  expect(audio.created.sources).toHaveLength(4);
});

test('raises the gain with the impulse', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact({ impulse: 1e-3 })], BOX);
  sound.play([impact({ impulse: 1e-1 })], BOX);
  const [quiet, loud] = audio.created.gains.map((node) => node.gain.value);
  expect(quiet).toBeGreaterThan(0);
  expect(loud).toBeGreaterThan(quiet);
  expect(loud).toBeLessThanOrEqual(1);
});

test('maps the gain linearly in the impulse below the clamp', () => {
  expect(gainForImpulse(0.002)).toBeGreaterThan(0);
  expect(gainForImpulse(0.004) / gainForImpulse(0.002)).toBeCloseTo(2, 9);
  expect(gainForImpulse(0.01)).toBeCloseTo(0.01 / MAX_IMPULSE, 9);
});

test('clamps the gain at one voice amplitude', () => {
  expect(gainForImpulse(MAX_IMPULSE)).toBe(1);
  expect(gainForImpulse(MAX_IMPULSE * 10)).toBe(1);
  expect(gainForImpulse(MAX_IMPULSE / 2)).toBeCloseTo(0.5, 9);
});

test('is silent at and below the minimum impulse', () => {
  expect(gainForImpulse(MIN_IMPULSE)).toBe(0);
  expect(gainForImpulse(MIN_IMPULSE / 2)).toBe(0);
});

test('configures the compressor as a peak limiter', async () => {
  const sound = createSound();
  await sound.resume();
  const limiter = audio.created.compressor;
  expect(limiter.threshold.value).toBe(LIMITER_THRESHOLD_DB);
  expect(limiter.knee.value).toBe(0);
  expect(limiter.ratio.value).toBe(20);
  expect(limiter.attack.value).toBeCloseTo(0.003, 9);
  expect(limiter.release.value).toBeCloseTo(0.1, 9);
});

test('keeps one constant voice scale so loud overlaps stay below the ceiling', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact({ impulse: MAX_IMPULSE })], BOX);
  const data = audio.created.buffers[0].getChannelData(0);
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  sound.play([impact({ impulse: MAX_IMPULSE })], BOX);
  const [first, second] = audio.created.gains.map((node) => node.gain.value);
  expect(first).toBeGreaterThan(0);
  expect(peak * first).toBeLessThanOrEqual(LIMITER_CEILING + 1e-9);
  expect(second).toBe(first);
});

test('plays only the strongest event of a pair in one batch', async () => {
  const sound = createSound();
  await sound.resume();
  const body = die();
  sound.play(
    [impact({ a: body, impulse: 0.002 }), impact({ a: body, impulse: 0.006 })],
    BOX,
  );
  expect(audio.created.sources).toHaveLength(1);
  sound.play([impact({ impulse: 0.002 })], BOX);
  const [strongest, reference] = audio.created.gains.map((node) => node.gain.value);
  expect(strongest / reference).toBeCloseTo(3, 6);
});

test('replays an open slot only for an event at least half again as strong', async () => {
  const sound = createSound();
  await sound.resume();
  const body = die();
  sound.play([impact({ a: body, impulse: 0.002 })], BOX);
  audio.created.contexts[0].currentTime = PAIR_GAP * 0.5;
  sound.play([impact({ a: body, impulse: 0.0029 })], BOX);
  expect(audio.created.sources).toHaveLength(1);
  sound.play([impact({ a: body, impulse: 0.003 })], BOX);
  expect(audio.created.sources).toHaveLength(2);
});

test('does not take the slot for a silent event', async () => {
  const sound = createSound();
  await sound.resume();
  const body = die();
  expect(sound.play([impact({ a: body, impulse: MIN_IMPULSE })], BOX)).toBe(0);
  expect(sound.play([impact({ a: body, impulse: 0.002 })], BOX)).toBe(1);
  expect(audio.created.sources).toHaveLength(1);
});

test('limits one body pair to one voice per gap', async () => {
  const sound = createSound();
  await sound.resume();
  const body = die();
  sound.play([impact({ a: body })], BOX);
  audio.created.contexts[0].currentTime = PAIR_GAP * 0.5;
  sound.play([impact({ a: body })], BOX);
  expect(audio.created.sources).toHaveLength(1);
  audio.created.contexts[0].currentTime = PAIR_GAP;
  sound.play([impact({ a: body })], BOX);
  expect(audio.created.sources).toHaveLength(2);
  sound.play([impact({ a: body, surface: 'lid' })], BOX);
  expect(audio.created.sources).toHaveLength(3);
});

test('renders buffers that decay below audible level and end at silence', async () => {
  const sound = createSound();
  await sound.resume();
  const events = [
    impact({ surface: 'floor' }),
    impact({ surface: 'wall', point: [BOX.W / 2 - 0.001, 0, 0.03] }),
    impact({ surface: 'lid', point: [0.01, 0.02, 0.06] }),
    impact({ surface: 'die', b: die(), point: [0, 0, 0.03] }),
  ];
  for (const event of events) sound.play([event], BOX);
  expect(audio.created.buffers).toHaveLength(events.length);
  for (const buffer of audio.created.buffers) {
    const data = buffer.getChannelData();
    expect(data.length).toBeLessThanOrEqual(Math.ceil(MAX_DURATION * buffer.sampleRate));
    expect(data.length).toBeGreaterThan(0);
    const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    const tailStart = data.length - Math.ceil(0.01 * buffer.sampleRate);
    let tailPeak = 0;
    for (let index = tailStart; index < data.length; index += 1) {
      tailPeak = Math.max(tailPeak, Math.abs(data[index]));
    }
    expect(tailPeak).toBeLessThan(0.01 * peak);
    expect(tailPeak).toBeLessThan(1e-3);
    expect(Math.abs(data[data.length - 1])).toBeLessThan(1e-6);
  }
});

test('caps the voice count and drops the quietest voice', async () => {
  const sound = createSound();
  await sound.resume();
  for (let index = 0; index < MAX_VOICES; index += 1) {
    const impulse = MIN_IMPULSE * 2 * (MAX_IMPULSE / (MIN_IMPULSE * 2)) ** (index / MAX_VOICES);
    expect(sound.play([impact({ impulse })], BOX)).toBe(1);
  }
  expect(audio.created.sources).toHaveLength(MAX_VOICES);
  expect(audio.created.sources.some((source) => source.stopped > 0)).toBe(false);
  sound.play([impact({ impulse: MAX_IMPULSE })], BOX);
  expect(audio.created.sources).toHaveLength(MAX_VOICES + 1);
  expect(audio.created.sources[0].stopped).toBe(1);
});
