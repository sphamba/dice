import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  CLIPPER_RANGE,
  LIMITER_CEILING,
  MAX_IMPULSE,
  MIN_IMPULSE,
  SURFACE_CODES,
  createSound,
  gainForImpulse,
} from './sound.js';
import { HIT_STRIDE } from './banks.js';
import { DIE_RADIUS } from '../physics/body.js';

const BOX = { W: 0.1, H: 0.08, D: 0.06 };

const die = () => ({ shape: { type: 'd6', radius: DIE_RADIUS } });

const step = (overrides = {}) => ({
  t: 0.005,
  a: null,
  b: null,
  surface: 'floor',
  px: 0.01,
  py: 0.02,
  pz: 0,
  normal: 0.001,
  friction: 0,
  slip: 0,
  ...overrides,
});

function fakeAudio({ worklet = true, failModule = false } = {}) {
  const created = {
    contexts: [],
    gains: [],
    shapers: [],
    nodes: [],
    messages: [],
    moduleUrls: [],
    resumes: 0,
  };
  class FakeContext {
    constructor() {
      this.sampleRate = 48000;
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = { name: 'destination' };
      if (worklet) {
        this.audioWorklet = {
          addModule: failModule
            ? (url) => {
                created.moduleUrls.push(url);
                return Promise.reject(new Error('no worklet'));
              }
            : (url) => {
                created.moduleUrls.push(url);
                return Promise.resolve();
              },
        };
      }
      created.contexts.push(this);
    }

    resume() {
      created.resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createWaveShaper() {
      const shaper = { curve: null, oversample: 'none', out: null };
      shaper.connect = (target) => {
        shaper.out = target;
      };
      created.shapers.push(shaper);
      return shaper;
    }

    createGain() {
      const gain = { gain: { value: 1 }, out: null };
      gain.connect = (target) => {
        gain.out = target;
      };
      created.gains.push(gain);
      return gain;
    }
  }
  class FakeWorkletNode {
    constructor(context, name, options) {
      this.name = name;
      this.options = options;
      this.out = null;
      this.port = {
        onmessage: null,
        // Structured clone, like a real worklet port: the send buffer is copied at post time.
        postMessage: (message) => created.messages.push(structuredClone(message)),
      };
      created.nodes.push(this);
      FakeWorkletNode.instances.push(this);
    }

    connect(target) {
      this.out = target;
    }
  }
  return { FakeContext, FakeWorkletNode, created };
}

let audio;

beforeEach(() => {
  audio = fakeAudio();
  globalThis.AudioContext = audio.FakeContext;
  globalThis.AudioWorkletNode = audio.FakeWorkletNode;
  audio.FakeWorkletNode.instances = [];
});

afterEach(() => {
  delete globalThis.AudioContext;
  delete globalThis.AudioWorkletNode;
});

test('stays silent until resume creates the audio context', () => {
  const sound = createSound();
  expect(sound.playSteps([step()])).toBe(0);
  expect(audio.created.contexts).toHaveLength(0);
  expect(audio.created.messages).toHaveLength(0);
});

test('creates one context on resume and routes the worklet through the clipper', async () => {
  const sound = createSound();
  await sound.resume();
  await sound.resume();
  expect(audio.created.contexts).toHaveLength(1);
  expect(audio.created.resumes).toBe(1);
  expect(audio.created.shapers).toHaveLength(1);
  const [node] = audio.created.nodes;
  const [master] = audio.created.gains;
  expect(node.name).toBe('dice-resonator');
  expect(node.options.outputChannelCount).toEqual([1]);
  expect(node.out).toBe(master);
  expect(master.gain.value).toBeCloseTo(1 / CLIPPER_RANGE, 9);
  expect(master.out).toBe(audio.created.shapers[0]);
  expect(audio.created.shapers[0].out).toBe(audio.created.contexts[0].destination);
  expect(audio.created.shapers[0].oversample).toBe('none');
});

test('requests the worklet module relative to the sound module', async () => {
  const sound = createSound();
  await sound.resume();
  expect(audio.created.moduleUrls).toHaveLength(1);
  expect(String(audio.created.moduleUrls[0])).toMatch(/processor\.js/);
});

test('stays silent without an AudioWorkletNode constructor', async () => {
  delete globalThis.AudioWorkletNode;
  const sound = createSound();
  await sound.resume();
  expect(sound.playSteps([step()])).toBe(0);
  expect(audio.created.messages).toHaveLength(0);
});

test('stays silent when the context has no audioWorklet', async () => {
  audio = fakeAudio({ worklet: false });
  globalThis.AudioContext = audio.FakeContext;
  const sound = createSound();
  await sound.resume();
  expect(sound.playSteps([step()])).toBe(0);
  expect(audio.created.messages).toHaveLength(0);
});

test('stays silent when the worklet module fails to load', async () => {
  audio = fakeAudio({ failModule: true });
  globalThis.AudioContext = audio.FakeContext;
  const sound = createSound();
  await sound.resume();
  expect(sound.playSteps([step()])).toBe(0);
  expect(audio.created.messages).toHaveLength(0);
  expect(audio.created.nodes).toHaveLength(0);
});

test('syncs bodies and box on resume', async () => {
  const sound = createSound();
  const body = die();
  sound.addBody(body);
  sound.setBox(BOX);
  await sound.resume();
  expect(audio.created.messages).toEqual([
    { type: 'add', id: 0, die: 'd6', radius: DIE_RADIUS },
    { type: 'box', W: BOX.W, H: BOX.H, D: BOX.D },
  ]);
  sound.addBody(die());
  expect(audio.created.messages[2]).toEqual({ type: 'add', id: 1, die: 'd6', radius: DIE_RADIUS });
});

test('maps body refs to audio ids per frame and reuses the send buffers', async () => {
  const sound = createSound();
  await sound.resume();
  const a = die();
  const b = die();
  sound.addBody(a);
  sound.addBody(b);
  const record = step({ a, b, surface: 'die', px: 0.01, py: 0.02, normal: 0.001, friction: 0.002, slip: 0.3 });
  sound.playSteps([record]);
  sound.playSteps([step({ a, normal: 0.002 })]);
  expect(audio.created.messages).toHaveLength(4);
  const [first, second] = audio.created.messages.slice(2);
  expect(first.type).toBe('steps');
  expect(first.simNow).toBe(0);
  expect(first.hitCount).toBe(1);
  expect(Array.from(first.hits)).toEqual([
    record.t, 0, 1, SURFACE_CODES.die, 0.01, 0.02, 0, 0.001, 0.002, 0.3,
  ]);
  expect(Array.from(second.hits)).toEqual([
    record.t, 0, -1, SURFACE_CODES.floor, 0.01, 0.02, 0, 0.002, 0, 0,
  ]);
});

test('encodes unknown bodies as absent and drains nothing itself', async () => {
  const sound = createSound();
  await sound.resume();
  sound.playSteps([step()]);
  const [message] = audio.created.messages;
  expect(Array.from(message.hits)).toEqual([
    step().t, -1, -1, SURFACE_CODES.floor, 0.01, 0.02, 0, 0.001, 0, 0,
  ]);
});

test('caps the message at the send buffer bounds', async () => {
  const sound = createSound();
  await sound.resume();
  const records = [];
  for (let index = 0; index < 1000; index += 1) records.push(step({ t: index / 480 }));
  expect(sound.playSteps(records)).toBeLessThanOrEqual(records.length);
  const [message] = audio.created.messages;
  expect(message.hitCount).toBe(message.hits.length / HIT_STRIDE);
  expect(message.hitCount).toBeLessThan(records.length);
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
  for (const value of curve) expect(Math.abs(value)).toBeLessThan(1);
});
