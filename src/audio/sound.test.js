import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  CLIPPER_RANGE,
  LIMITER_CEILING,
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
  const created = {
    buffers: [],
    sources: [],
    gains: [],
    shapers: [],
    contexts: [],
    compressors: 0,
    resumes: 0,
  };
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
      return { connect() {} };
    }

    createWaveShaper() {
      const shaper = { curve: null, oversample: 'none', out: null };
      shaper.connect = (target) => {
        shaper.out = target;
      };
      created.shapers.push(shaper);
      return shaper;
    }

    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buffer = { length, sampleRate, getChannelData: () => data };
      created.buffers.push(buffer);
      return buffer;
    }

    createGain() {
      const gain = { gain: { value: 1 }, out: null };
      gain.connect = (target) => {
        gain.out = target;
      };
      gain.disconnect = () => {};
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

const voiceGains = () => audio.created.gains.slice(1);

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
  expect(audio.created.shapers).toHaveLength(0);
});

test('creates one context on resume and routes through the clipper', async () => {
  const sound = createSound();
  await sound.resume();
  await sound.resume();
  expect(audio.created.contexts).toHaveLength(1);
  expect(audio.created.resumes).toBe(1);
  expect(audio.created.compressors).toBe(0);
  expect(audio.created.shapers).toHaveLength(1);
  const [master] = audio.created.gains;
  expect(master.gain.value).toBeCloseTo(1 / CLIPPER_RANGE, 9);
  expect(master.out).toBe(audio.created.shapers[0]);
  expect(audio.created.shapers[0].out).toBe(audio.created.contexts[0].destination);
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
  const [quiet, loud] = voiceGains().map((node) => node.gain.value);
  expect(quiet).toBeGreaterThan(0);
  expect(loud).toBeGreaterThan(quiet);
  expect(loud).toBeLessThanOrEqual(LIMITER_CEILING);
});

test('sets every voice gain to the ceiling times the linear impulse gain', async () => {
  const sound = createSound();
  await sound.resume();
  for (const impulse of [0.002, 0.006, MAX_IMPULSE]) {
    sound.play([impact({ impulse })], BOX);
  }
  const gains = voiceGains().map((node) => node.gain.value / LIMITER_CEILING);
  expect(gains[0]).toBeCloseTo(gainForImpulse(0.002), 6);
  expect(gains[1] / gains[0]).toBeCloseTo(3, 6);
  expect(gains[2]).toBe(1);
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

test('builds a table-lookup clipper curve of 4097 points', async () => {
  const sound = createSound();
  await sound.resume();
  const shaper = audio.created.shapers[0];
  expect(shaper.oversample).toBe('none');
  expect(shaper.curve).toBeInstanceOf(Float32Array);
  expect(shaper.curve.length).toBe(4097);
});

test('keeps the curve linear at and below the ceiling', async () => {
  const sound = createSound();
  await sound.resume();
  const { curve } = audio.created.shapers[0];
  const half = (curve.length - 1) / 2;
  for (let index = 0; index <= half; index += 1) {
    const s = (index / half) * CLIPPER_RANGE;
    if (s > LIMITER_CEILING) continue;
    expect(curve[half + index]).toBeCloseTo(s, 6);
    expect(curve[half + index] + curve[half - index]).toBeCloseTo(0, 6);
  }
  expect(curve[half]).toBe(0);
});

test('shapes the curve monotonically and keeps every value inside the unit range', async () => {
  const sound = createSound();
  await sound.resume();
  const { curve } = audio.created.shapers[0];
  const half = (curve.length - 1) / 2;
  expect(curve[curve.length - 1]).toBeGreaterThan(curve[half]);
  for (let index = 1; index < curve.length; index += 1) {
    expect(curve[index]).toBeGreaterThanOrEqual(curve[index - 1]);
  }
  for (let index = 1; index <= half; index += 1) {
    if ((index / half) * CLIPPER_RANGE > LIMITER_CEILING) continue;
    expect(curve[half + index]).toBeGreaterThan(curve[half + index - 1]);
  }
  for (const value of curve) expect(Math.abs(value)).toBeLessThan(1);
});

test('keeps one voice in the linear part of the clipper', async () => {
  const sound = createSound();
  await sound.resume();
  sound.play([impact({ impulse: MAX_IMPULSE })], BOX);
  const data = audio.created.buffers[0].getChannelData(0);
  const peak = data.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const [voice] = voiceGains().map((node) => node.gain.value);
  expect(peak * voice).toBeLessThanOrEqual(LIMITER_CEILING + 1e-9);
  expect((peak * voice) / CLIPPER_RANGE).toBeLessThan(LIMITER_CEILING);
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
  const [strongest, reference] = voiceGains().map((node) => node.gain.value);
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
