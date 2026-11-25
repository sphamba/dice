import { expect, test } from 'vitest';
import { MAX_GRAVITY, deviceToWorldGravity, onFirstGesture, unlockOnFirstGesture } from './motion.js';
import { createSound } from '../audio/sound.js';

const G = 9.81;

const expectVec = (actual, expected) => {
  expect(actual[0]).toBeCloseTo(expected[0], 5);
  expect(actual[1]).toBeCloseTo(expected[1], 5);
  expect(actual[2]).toBeCloseTo(expected[2], 5);
};

test('a phone flat on a table gives downward gravity for every screen angle', () => {
  const flat = { x: 0, y: 0, z: G };
  for (const angle of [0, 90, 180, 270]) {
    expectVec(deviceToWorldGravity(flat, angle), [0, 0, -G]);
  }
});

test('an upright portrait phone at angle 0 gives gravity along -y', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: G, z: 0 }, 0), [0, -G, 0]);
});

test('the tilt in the screen plane rotates with the screen angle', () => {
  const upright = { x: 0, y: G, z: 0 };
  expectVec(deviceToWorldGravity(upright, 90), [G, 0, 0]);
  expectVec(deviceToWorldGravity(upright, 180), [0, G, 0]);
  expectVec(deviceToWorldGravity(upright, 270), [-G, 0, 0]);
});

test('a negative angle maps to its positive equivalent', () => {
  const upright = { x: 0, y: G, z: 0 };
  expectVec(deviceToWorldGravity(upright, -90), deviceToWorldGravity(upright, 270));
});

test('a sideways shake moves the dice against the acceleration', () => {
  expectVec(deviceToWorldGravity({ x: G, y: 0, z: 0 }, 0), [-G, 0, 0]);
});

test('the inverted iOS sign restores the spec convention', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: -G }, 0, -1), [0, 0, -G]);
});

test('the magnitude is clamped to MAX_GRAVITY without changing the direction', () => {
  expect(MAX_GRAVITY).toBeCloseTo(4 * G, 5);
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: 100 }, 0), [0, 0, -MAX_GRAVITY]);
  const clamped = deviceToWorldGravity({ x: 0, y: 300, z: 400 }, 0);
  expect(Math.hypot(...clamped)).toBeCloseTo(MAX_GRAVITY, 5);
  expectVec(clamped, [0, -MAX_GRAVITY * 0.6, -MAX_GRAVITY * 0.8]);
});

test('a device at rest in free fall gives zero gravity', () => {
  expectVec(deviceToWorldGravity({ x: 0, y: 0, z: 0 }, 0), [0, 0, 0]);
});

function fakeWindow() {
  const listeners = new Map();
  const target = {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatch(type) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler({ type });
    },
  };
  return target;
}

function fakeAudio() {
  const created = { contexts: [], nodes: [], resumes: 0 };
  class FakeContext {
    constructor() {
      this.state = 'suspended';
      this.destination = {};
      this.audioWorklet = { addModule: () => Promise.resolve() };
      created.contexts.push(this);
    }

    resume() {
      created.resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createWaveShaper() {
      return { connect: () => {} };
    }

    createGain() {
      return { gain: { value: 1 }, connect: () => {} };
    }
  }
  class FakeWorkletNode {
    constructor() {
      this.port = { postMessage: () => {} };
      this.connect = () => {};
      created.nodes.push(this);
    }
  }
  return { FakeContext, FakeWorkletNode, created };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('unlock waits for an activation gesture and resumes a suspended context again', async () => {
  const audio = fakeAudio();
  const win = fakeWindow();
  const saved = { add: globalThis.addEventListener, remove: globalThis.removeEventListener };
  globalThis.AudioContext = audio.FakeContext;
  globalThis.AudioWorkletNode = audio.FakeWorkletNode;
  globalThis.addEventListener = win.addEventListener;
  globalThis.removeEventListener = win.removeEventListener;
  try {
    const sound = createSound();
    onFirstGesture(() => sound.resume());
    unlockOnFirstGesture();

    win.dispatch('pointerdown');
    expect(audio.created.contexts).toHaveLength(0);

    win.dispatch('pointerup');
    expect(audio.created.contexts).toHaveLength(1);
    const [context] = audio.created.contexts;
    expect(context.state).toBe('running');
    await flush();
    expect(audio.created.nodes).toHaveLength(1);

    win.dispatch('click');
    expect(audio.created.contexts).toHaveLength(1);
    expect(audio.created.resumes).toBe(1);

    context.state = 'suspended';
    win.dispatch('touchend');
    expect(context.state).toBe('running');
    expect(audio.created.resumes).toBe(2);
  } finally {
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.remove;
    delete globalThis.AudioContext;
    delete globalThis.AudioWorkletNode;
  }
});
