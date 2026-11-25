import { describe, expect, it } from 'vitest';
import {
  FRICTION_IMPULSE_REF,
  FRAME_LAG,
  HIT_STRIDE,
  SLIP_MIN,
  SURFACE_CODES,
  createEngine,
  stepSampleOffset,
} from './banks.js';
import { DIE_RADIUS, createBody } from '../physics/body.js';
import { boxFromViewport } from '../physics/box.js';
import { FIXED_DT, createWorld } from '../physics/world.js';
import { createShape } from '../dice/shapes.js';
import * as vec3 from '../math/vec3.js';

const SR = 48000;

const BLOCK = 128;

const BOX_W = 0.5;
const BOX_H = 0.4;
const BOX_D = 0.2;

// Master gain of the shipped chain: the worklet output passes through 1/CLIPPER_RANGE
// before the WaveShaper, so engine-domain levels are CLIPPER_RANGE times the audible ones.
const CLIPPER_RANGE = 4;

// Peak after that chain of one typical d6 floor impact (0.005 N·s) at (0.11, 0.06),
// measured on the pre-worklet clip implementation of the same modes.
const LEGACY_TYPICAL_IMPACT_PEAK = 0.0418;

const DRAG_SPEED = 0.2;

const DRAG_SECONDS = 0.3;

const dB = (ratio) => 20 * Math.log10(ratio);

function makeMessage(records, simNow) {
  const hits = new Float64Array(records.length * HIT_STRIDE);
  records.forEach((record, index) => {
    const o = index * HIT_STRIDE;
    hits[o] = record.t;
    hits[o + 1] = record.a ?? -1;
    hits[o + 2] = record.b ?? -1;
    hits[o + 3] = SURFACE_CODES[record.surface] ?? 0;
    hits[o + 4] = record.px ?? 0;
    hits[o + 5] = record.py ?? 0;
    hits[o + 6] = record.pz ?? 0;
    hits[o + 7] = record.normal ?? 0;
    hits[o + 8] = record.friction ?? 0;
    hits[o + 9] = record.slip ?? 0;
  });
  return { type: 'steps', simNow, hitCount: records.length, hits };
}

function setup() {
  const engine = createEngine(SR);
  engine.setBox(BOX_W, BOX_H, BOX_D);
  engine.addBody(0, 'd6', DIE_RADIUS);
  engine.addBody(1, 'd6', DIE_RADIUS);
  return engine;
}

function collect(engine, seconds, now) {
  const blocks = Math.ceil((seconds * SR) / BLOCK);
  const data = new Float32Array(blocks * BLOCK);
  let frame = Math.round((now ?? 0) * SR);
  for (let index = 0; index < blocks; index += 1) {
    const from = index * BLOCK;
    engine.render(data.subarray(from, from + BLOCK), frame / SR);
    frame += BLOCK;
  }
  return data;
}

const rms = (data, from, to) => {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += data[index] * data[index];
  return Math.sqrt(sum / Math.max(1, to - from));
};

const peak = (data) => {
  let max = 0;
  for (const value of data) max = Math.max(max, Math.abs(value));
  return max;
};

function goertzel(data, frequency, sampleRate) {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (const value of data) {
    const s = value + coeff * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

const floorHit = (overrides = {}) => ({
  t: 0,
  a: 0,
  b: null,
  surface: 'floor',
  px: BOX_W / 2,
  py: BOX_H * 0.25,
  pz: 0,
  normal: 0.001,
  friction: 0,
  slip: 0,
  ...overrides,
});

describe('engine excitation', () => {
  it('rings a single normal impulse at the die mode frequencies and decays', () => {
    const engine = setup();
    engine.removeBody(1);
    engine.handleSteps(makeMessage([{ ...floorHit(), surface: 'die', b: 1, px: 0, py: 0 }]), 0);
    const data = collect(engine, 0.25);
    const modes = engine.dice.get(0).modes.map((mode) => mode.f);
    expect(modes.length).toBeGreaterThanOrEqual(3);
    const bin = (f) => goertzel(data, f, SR);
    for (const f of modes) {
      expect(bin(f)).toBeGreaterThan(bin(f + 400));
      expect(bin(f)).toBeGreaterThan(bin(f - 400));
    }
    const early = rms(data, (0.02 * SR) | 0, (0.04 * SR) | 0);
    const late = rms(data, (0.1 * SR) | 0, (0.12 * SR) | 0);
    expect(late).toBeLessThan(early * 0.1);
  });

  it('keeps one typical impact near the legacy peak level', () => {
    const engine = setup();
    engine.removeBody(1);
    engine.handleSteps(makeMessage([{ ...floorHit(), px: 0.11, py: 0.06, normal: 0.005 }]), 0);
    const level = peak(collect(engine, 0.05)) / CLIPPER_RANGE;
    expect(Math.abs(dB(level / LEGACY_TYPICAL_IMPACT_PEAK))).toBeLessThan(3);
  });

  // A d6 settled on the floor and then dragged at 0.2 m/s, which is the excitation a user
  // produces by dragging a die, fed to the engine the way main.js feeds it.
  function draggedSlide() {
    const box = boxFromViewport(393, 852, 3);
    const world = createWorld(box);
    const body = createBody(createShape('d6', DIE_RADIUS), {
      position: [0, 0.2, box.D / 2],
      orientation: [0, 0, 0, 1],
    });
    world.addBody(body);
    for (let step = 0; step < Math.round(0.6 / FIXED_DT); step += 1) world.step(FIXED_DT);
    world.soundSteps.length = 0;
    const engine = createEngine(SR);
    engine.setBox(box.W, box.H, box.D);
    engine.addBody(0, 'd6', DIE_RADIUS);
    const start = world.simTime;
    world.beforeStep = () => {
      if (world.simTime - start < DRAG_SECONDS) vec3.set(body.linearVelocity, DRAG_SPEED, 0, 0);
    };
    const data = new Float32Array(Math.round(0.8 * 60) * Math.ceil(SR / 60 / BLOCK) * BLOCK);
    let sample = 0;
    for (let frame = 0; frame < Math.round(0.8 * 60); frame += 1) {
      world.update(1 / 60);
      const records = world.soundSteps.map((record) => ({ ...record, a: 0, b: null }));
      world.soundSteps.length = 0;
      engine.handleSteps(makeMessage(records, world.simTime), world.simTime);
      for (let block = 0; block * BLOCK < SR / 60; block += 1) {
        engine.render(data.subarray(sample, sample + BLOCK), world.simTime + (block * BLOCK) / SR);
        sample += BLOCK;
      }
    }
    world.beforeStep = null;
    return data.subarray(0, sample);
  }

  it('sustains a scrape 15 to 20 dB under a typical impact on a dragged die', () => {
    const data = draggedSlide();
    const level = rms(data, (0.1 * SR) | 0, (DRAG_SECONDS * SR) | 0) / CLIPPER_RANGE;
    expect(Number.isFinite(peak(data))).toBe(true);
    expect(dB(level / LEGACY_TYPICAL_IMPACT_PEAK)).toBeGreaterThan(-20);
    expect(dB(level / LEGACY_TYPICAL_IMPACT_PEAK)).toBeLessThan(-15);
  }, 60000);

  it('sustains a constant slip within 30 percent RMS and decays after it stops', () => {
    const engine = setup();
    const stepsPerFrame = 8;
    const frames = 48;
    const excitation = new Float32Array(frames * stepsPerFrame * BLOCK);
    for (let frame = 0; frame < frames; frame += 1) {
      const records = [];
      for (let step = 1; step <= stepsPerFrame; step += 1) {
        const t = (frame * stepsPerFrame + step) / 480;
        records.push({ ...floorHit({ px: 0 }), t, normal: 0, friction: FRICTION_IMPULSE_REF, slip: 0.2 });
      }
      engine.handleSteps(makeMessage(records, records[records.length - 1].t), frame * BLOCK / SR);
      const now = frame * BLOCK / SR;
      const blocks = Math.ceil((stepsPerFrame * BLOCK) / SR);
      let sample = frame * stepsPerFrame * BLOCK;
      for (let index = 0; index < blocks; index += 1) {
        engine.render(excitation.subarray(sample, sample + BLOCK), now + index * BLOCK / SR);
        sample += BLOCK;
      }
    }
    const first = rms(excitation, (0.4 * SR) | 0, (0.6 * SR) | 0);
    const second = rms(excitation, (0.75 * SR) | 0, (0.95 * SR) | 0);
    expect(first).toBeGreaterThan(0);
    expect(Math.abs(second - first) / first).toBeLessThan(0.3);
    const data = collect(engine, 1.0, frames * stepsPerFrame * BLOCK / SR);
    const after = rms(data, (0.75 * SR) | 0, (0.85 * SR) | 0);
    expect(after).toBeLessThan(first * 0.01);
  });

  it('gives zero slip and sub-threshold slip no friction excitation', () => {
    for (const slip of [0, SLIP_MIN / 2]) {
      const engine = setup();
      engine.handleSteps(
        makeMessage([{ ...floorHit(), normal: 0, friction: FRICTION_IMPULSE_REF, slip }]),
        0,
      );
      expect(peak(collect(engine, 0.1))).toBe(0);
    }
  });

  it('maps step timestamps to sample offsets with the one-frame lag', () => {
    expect(stepSampleOffset(1.0, 0.98, SR)).toBe(Math.round((1 + FRAME_LAG - 0.98) * SR));
    expect(stepSampleOffset(0.5, 0.5 + FRAME_LAG + 0.01, SR)).toBe(0);
    const engine = setup();
    const t = 0.02;
    engine.handleSteps(makeMessage([floorHit({ t })], 0), 0);
    const expected = stepSampleOffset(t, 0, SR);
    const data = collect(engine, 0.1);
    expect(data[expected - 1]).toBe(0);
    expect(Math.abs(data[expected])).toBeGreaterThan(0);
  });
});

describe('engine banks', () => {
  it('excites both dice of a die-die contact and the surface of a die-box contact', () => {
    const engine = setup();
    engine.handleSteps(makeMessage([{ ...floorHit(), surface: 'die', b: 1, px: 0, py: 0 }]), 0);
    collect(engine, 0.02);
    expect(engine.dice.get(0).active).toBe(true);
    expect(engine.dice.get(1).active).toBe(true);
    expect(engine.surfaces.floor.active).toBe(false);

    const boxOnly = setup();
    boxOnly.removeBody(0);
    boxOnly.removeBody(1);
    boxOnly.handleSteps(makeMessage([floorHit()]), 0);
    collect(boxOnly, 0.02);
    expect(boxOnly.surfaces.floor.active).toBe(true);
  });

  it('resolves wall contacts to the orientation matching the contact point', () => {
    const engine = setup();
    engine.handleSteps(
      makeMessage([{ ...floorHit(), surface: 'wall', px: BOX_W / 2, py: 0, pz: BOX_D / 2 }]),
      0,
    );
    collect(engine, 0.02);
    expect(engine.surfaces.wallX.active).toBe(true);
    expect(engine.surfaces.wallY.active).toBe(false);
    engine.handleSteps(
      makeMessage([{ ...floorHit(), surface: 'wall', px: 0, py: BOX_H / 2, pz: BOX_D / 2 }]),
      0,
    );
    collect(engine, 0.02);
    expect(engine.surfaces.wallY.active).toBe(true);
  });

  it('rebuilds the surface banks on setBox and drops removed dice', () => {
    const engine = setup();
    const before = engine.surfaces.floor.modes[0].f;
    engine.setBox(0.2, 0.15, 0.1);
    expect(engine.surfaces.floor.modes[0].f).toBeGreaterThan(before);
    engine.removeBody(0);
    engine.handleSteps(makeMessage([floorHit()]), 0);
    collect(engine, 0.02);
    expect(engine.dice.has(0)).toBe(false);
    expect(engine.surfaces.floor.active).toBe(true);
  });

  it('ignores hits for unknown bodies and caps the modes of a surface bank', () => {
    const engine = setup();
    engine.handleSteps(
      makeMessage([{ ...floorHit(), a: 7, b: 8, surface: 'die' }]),
      0,
    );
    expect(peak(collect(engine, 0.05))).toBe(0);
    expect(engine.surfaces.floor.modes.length).toBeLessThanOrEqual(24);
  });

  it('goes exactly silent after the modes decay below the silence floor', () => {
    const engine = setup();
    engine.handleSteps(makeMessage([{ ...floorHit(), surface: 'die', b: 1, px: 0, py: 0 }]), 0);
    const data = collect(engine, 1.2);
    for (const value of data.subarray((1.1 * SR) | 0)) expect(value).toBe(0);
  });
});
