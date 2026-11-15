import { describe, expect, it } from 'vitest';
import {
  BOX,
  DEFAULT_MAX_MODES,
  DIE_REFERENCE_RADIUS,
  GLASS,
  MAX_MODE_FREQUENCY,
  dieModes,
  plateModes,
} from './modes.js';

const MAX_F = MAX_MODE_FREQUENCY;

const A = 0.15;

const B = 0.1;

const norm = (a, b) => 1 / (a * a) + 1 / (b * b);

const gridFrequency = (a, b, m, n, material) =>
  (material.f11 * ((m / a) ** 2 + (n / b) ** 2)) / norm(a, b);

const oddOddFrequencies = (a, b, material, maxModes) => {
  const limit = (MAX_F / material.f11) * norm(a, b);
  const frequencies = [];
  for (let m = 1; m * m / (a * a) < limit; m++) {
    for (let n = 1; n * n / (b * b) < limit; n++) {
      if (m % 2 === 0 || n % 2 === 0) continue;
      const f = gridFrequency(a, b, m, n, material);
      if (f < MAX_F) frequencies.push(f);
    }
  }
  return frequencies.sort((x, y) => x - y).slice(0, maxModes);
};

const near = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.max(Math.abs(expected), 1));

describe('materials', () => {
  it('describes a wood-like box and a brighter, longer-ringing glass', () => {
    for (const key of ['f11', 'tau', 'dampHF']) {
      expect(typeof BOX[key]).toBe('number');
      expect(typeof GLASS[key]).toBe('number');
    }
    expect(GLASS.f11).toBeGreaterThan(BOX.f11);
    expect(GLASS.tau).toBeGreaterThan(BOX.tau);
  });
});

describe('plateModes', () => {
  const center = [A / 2, B / 2];

  it('sorts ascending and starts at the material f11', () => {
    const modes = plateModes(A, B, ...center, BOX);
    expect(modes.length).toBeGreaterThan(1);
    for (let i = 1; i < modes.length; i++) {
      expect(modes[i].f).toBeGreaterThanOrEqual(modes[i - 1].f);
    }
    near(modes[0].f, BOX.f11);
  });

  it('keeps every mode below 8 kHz with sane amplitude and decay', () => {
    for (const material of [BOX, GLASS]) {
      for (const mode of plateModes(A, B, ...center, material)) {
        expect(mode.f).toBeLessThan(MAX_F);
        expect(mode.amp).toBeGreaterThanOrEqual(0);
        expect(mode.amp).toBeLessThanOrEqual(1);
        expect(mode.tau).toBeGreaterThan(0);
      }
    }
  });

  it('caps the mode count at maxModes', () => {
    const dense = [0.05, 0.04, 0.025, 0.02];
    expect(plateModes(...dense, BOX)).toHaveLength(DEFAULT_MAX_MODES);
    const five = plateModes(...dense, BOX, 5);
    expect(five).toHaveLength(5);
    expect(five).toEqual(plateModes(...dense, BOX).slice(0, 5));
  });

  it('excites only odd-odd modes at the plate center', () => {
    const modes = plateModes(A, B, ...center, BOX, 500);
    const excited = modes.filter((mode) => mode.amp > 1e-9).map((mode) => mode.f);
    const expected = oddOddFrequencies(A, B, BOX, 500);
    expect(excited).toHaveLength(expected.length);
    excited.forEach((f, i) => near(f, expected[i]));
  });

  it('silences every mode at a corner', () => {
    for (const mode of plateModes(A, B, 0, 0, BOX)) {
      expect(mode.amp).toBeLessThan(1e-9);
    }
    for (const mode of plateModes(A, B, A, B, BOX)) {
      expect(mode.amp).toBeLessThan(1e-9);
    }
  });

  it('is symmetric under swapping a with b and u with v', () => {
    const u = 0.037;
    const v = 0.081;
    const straight = plateModes(A, B, u, v, GLASS);
    const swapped = plateModes(B, A, v, u, GLASS);
    expect(swapped).toHaveLength(straight.length);
    straight.forEach((mode, i) => {
      near(swapped[i].f, mode.f);
      near(swapped[i].amp, mode.amp);
      near(swapped[i].tau, mode.tau);
    });
  });

  it('shortens the decay of higher modes', () => {
    const modes = plateModes(A, B, ...center, GLASS);
    for (let i = 1; i < modes.length; i++) {
      expect(modes[i].tau).toBeLessThanOrEqual(modes[i - 1].tau);
      if (modes[i].f > modes[i - 1].f) {
        expect(modes[i].tau).toBeLessThan(modes[i - 1].tau);
      }
    }
  });
});

describe('dieModes', () => {
  it('returns a few high, short modes', () => {
    for (const type of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']) {
      const modes = dieModes(type, DIE_REFERENCE_RADIUS);
      expect(modes.length).toBeGreaterThanOrEqual(3);
      expect(modes.length).toBeLessThanOrEqual(5);
      for (let i = 0; i < modes.length; i++) {
        expect(modes[i].f).toBeGreaterThanOrEqual(2000);
        expect(modes[i].f).toBeLessThanOrEqual(7000);
        if (i > 0) expect(modes[i].f).toBeGreaterThan(modes[i - 1].f);
        expect(modes[i].amp).toBeGreaterThan(0);
        expect(modes[i].amp).toBeLessThanOrEqual(1);
        expect(modes[i].tau).toBeGreaterThan(0);
        expect(modes[i].tau).toBeLessThan(0.1);
      }
    }
  });

  it('gives every die type a distinct voice', () => {
    const types = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
    const appRadius = (0.016 * Math.sqrt(3)) / 2;
    for (const radius of [DIE_REFERENCE_RADIUS, appRadius]) {
      const voices = types.map((type) =>
        JSON.stringify(dieModes(type, radius).map((mode) => mode.f)),
      );
      expect(new Set(voices).size).toBe(types.length);
    }
  });

  it('raises frequencies as the die shrinks', () => {
    const big = dieModes('d6', DIE_REFERENCE_RADIUS);
    const small = dieModes('d6', DIE_REFERENCE_RADIUS / 2);
    expect(small).toHaveLength(big.length);
    small.forEach((mode, i) => expect(mode.f).toBeGreaterThan(big[i].f));
  });
});
