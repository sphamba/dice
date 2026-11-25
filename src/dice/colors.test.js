import { describe, expect, it } from 'vitest';
import {
  BLACK_INK,
  HUE_RANGE,
  LIGHTNESS_RANGE,
  SATURATION_RANGE,
  WHITE_INK,
  fromHex,
  hslToRgb,
  inkForDie,
  randomDieColor,
  relativeLuminance,
  toHex,
} from './colors.js';

// mulberry32: the same sequence in every engine.
function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plain-number inverse of hslToRgb, so the range check does not lean on the
// sampled function's own algebra.
function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

describe('hslToRgb', () => {
  it('maps the primaries and a gray', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual([1, 0, 0]);
    expect(hslToRgb(120, 1, 0.5)).toEqual([0, 1, 0]);
    expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 1]);
    expect(hslToRgb(360, 1, 0.5)).toEqual([1, 0, 0]);
    expect(hslToRgb(200, 0, 0.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('inverts through rgbToHsl', () => {
    for (const [h, s, l] of [[0, 0.45, 0.25], [137, 0.62, 0.48], [300, 0.85, 0.75], [359, 0.5, 0.6]]) {
      const [h2, s2, l2] = rgbToHsl(hslToRgb(h, s, l));
      expect(Math.abs(h2 - h) < 1e-9 || Math.abs(Math.abs(h2 - h) - 360) < 1e-9).toBe(true);
      expect(s2).toBeCloseTo(s, 12);
      expect(l2).toBeCloseTo(l, 12);
    }
  });
});

describe('randomDieColor', () => {
  const sample = (count) => {
    const random = seeded(20250601);
    return Array.from({ length: count }, () => randomDieColor(random));
  };

  it('stays inside the hue, saturation and lightness ranges', () => {
    for (const rgb of sample(500)) {
      const [h, s, l] = rgbToHsl(rgb);
      expect(h).toBeGreaterThanOrEqual(HUE_RANGE[0]);
      expect(h).toBeLessThan(HUE_RANGE[1]);
      expect(s).toBeGreaterThanOrEqual(SATURATION_RANGE[0] - 1e-9);
      expect(s).toBeLessThanOrEqual(SATURATION_RANGE[1] + 1e-9);
      expect(l).toBeGreaterThanOrEqual(LIGHTNESS_RANGE[0] - 1e-9);
      expect(l).toBeLessThanOrEqual(LIGHTNESS_RANGE[1] + 1e-9);
      for (const channel of rgb) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('covers both light and dark bodies, and both ink choices', () => {
    const colors = sample(500);
    const luminances = colors.map(relativeLuminance);
    expect(Math.min(...luminances)).toBeLessThan(0.05);
    expect(Math.max(...luminances)).toBeGreaterThan(0.5);
    const inks = new Set(colors.map((rgb) => inkForDie(rgb)));
    expect(inks.has(BLACK_INK)).toBe(true);
    expect(inks.has(WHITE_INK)).toBe(true);
  });

  it('uses hue, then saturation, then lightness from the injected source', () => {
    const values = [0, 0, 0];
    const random = () => values.shift();
    expect(randomDieColor(random)).toEqual(hslToRgb(0, 0.45, 0.25));
    expect(randomDieColor(() => 1)).toEqual(hslToRgb(360, 0.85, 0.75));
  });
});

describe('inkForDie', () => {
  it('picks black on a bright body and white on a dark body', () => {
    expect(inkForDie([1, 1, 0])).toEqual(BLACK_INK);
    expect(inkForDie([0.93, 0.92, 0.88])).toEqual(BLACK_INK);
    expect(inkForDie([0, 0, 0.5])).toEqual(WHITE_INK);
    expect(inkForDie([0.2, 0.1, 0.35])).toEqual(WHITE_INK);
  });

  it('uses the WCAG relative luminance, not the gamma-encoded sum', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([1, 1, 1])).toBe(1);
    expect(relativeLuminance([0, 1, 0])).toBeCloseTo(0.7152, 12);
    expect(relativeLuminance([0.5, 0.5, 0.5])).toBeCloseTo(0.2140, 4);
    // The gamma-encoded mean of a mid gray is 0.5; the contrast rule switches
    // ink at relative luminance 0.1791, so this gray takes black ink.
    expect(inkForDie([0.5, 0.5, 0.5])).toEqual(BLACK_INK);
    expect(inkForDie([0.45, 0.45, 0.45])).toEqual(WHITE_INK);
  });

  it('is deterministic at the contrast crossover', () => {
    // Contrasts against black and white are equal at relative luminance
    // sqrt(0.05 * 1.05) - 0.05.
    const crossover = Math.sqrt(0.05 * 1.05) - 0.05;
    const gray = 1.055 * crossover ** (1 / 2.4) - 0.055;
    const rgb = [gray, gray, gray];
    const luminance = relativeLuminance(rgb);
    const vsBlack = (luminance + 0.05) / 0.05;
    const vsWhite = 1.05 / (luminance + 0.05);
    expect(Math.abs(vsBlack - vsWhite)).toBeLessThan(1e-6);
    expect(inkForDie(rgb)).toEqual(vsBlack >= vsWhite ? BLACK_INK : WHITE_INK);
    // A hair on either side of the crossover is decided by the larger ratio.
    expect(inkForDie([gray + 0.01, gray + 0.01, gray + 0.01])).toEqual(BLACK_INK);
    expect(inkForDie([gray - 0.01, gray - 0.01, gray - 0.01])).toEqual(WHITE_INK);
  });
});

describe('hex round trip', () => {
  it('writes eight-bit channels and clamps out-of-range input', () => {
    expect(toHex([0, 0, 0])).toBe('#000000');
    expect(toHex([1, 1, 1])).toBe('#ffffff');
    expect(toHex([0.5, 0.25, 0.75])).toBe('#8040bf');
    expect(toHex([1.2, -0.2, 0.6])).toBe('#ff0099');
  });

  it('reads back every channel as a unit float', () => {
    const rgb = fromHex('#8040bf');
    expect(rgb[0]).toBeCloseTo(128 / 255, 12);
    expect(rgb[1]).toBeCloseTo(64 / 255, 12);
    expect(rgb[2]).toBeCloseTo(191 / 255, 12);
    expect(toHex(rgb)).toBe('#8040bf');
    expect(fromHex('#8040BF')).toEqual(rgb);
  });

  it('rejects malformed values', () => {
    for (const raw of ['', '#12345', '#1234567', 'red', '8040bf', '#zzzzzz', '#12345g', null, undefined, 42]) {
      expect(fromHex(raw)).toBeNull();
    }
  });

  it('keeps a generated color stable through storage', () => {
    const random = seeded(424242);
    for (let i = 0; i < 200; i += 1) {
      const hex = toHex(randomDieColor(random));
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(toHex(fromHex(hex))).toBe(hex);
    }
  });
});
