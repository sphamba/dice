import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DIE_RADIUS } from '../physics/body.js';
import { AO_STRENGTH, aoPrepassFragmentSource, diceFragmentSource, floorFragmentSource } from './shaders.js';
import {
  AO_FALLOFF_RANGE,
  AO_RADIUS_SCALE,
  AO_SAMPLE_POWER,
  AO_STEPS,
  AO_TEXEL,
  AO_Z_FALLOFF_SCALE,
} from './renderer.js';

const PI = Math.PI;
const R = AO_RADIUS_SCALE * DIE_RADIUS;
const FALLOFF_MUL = -1 / (AO_FALLOFF_RANGE * R);
const FALLOFF_ADD = (1 - AO_FALLOFF_RANGE) / AO_FALLOFF_RANGE + 1;
const MIN_DIST = 1.3 * AO_TEXEL;

// JS copy of shaders.gtaoFragmentSource: slice-integral visibility at a floor
// point under a height-field given by sampleDepth(x, y) -> world z, or null
// for a sample outside the texture (counts as unoccluded). Texel (0,0) noise.
function gtaoVisibility({ slices, normal = [0, 0, 1], p = [0, 0, 0], sampleDepth }) {
  const sliceNoise = 0.5 / 16;
  const stepJitter = (((0 * 5 + 2) & 15) + 0.5) / 16;
  let visibility = 0;
  for (let i = 0; i < slices; i++) {
    const phi = (i + sliceNoise) * PI / slices;
    const dir = [Math.cos(phi), Math.sin(phi)];
    const axis = [dir[1], -dir[0], 0];
    const dotNA = normal[0] * axis[0] + normal[1] * axis[1] + normal[2] * axis[2];
    const np = [normal[0] - axis[0] * dotNA, normal[1] - axis[1] * dotNA, normal[2] - axis[2] * dotNA];
    const len = Math.max(Math.hypot(np[0], np[1], np[2]), 1e-6);
    const nAng = Math.sign(dir[0] * np[0] + dir[1] * np[1]) * Math.acos(Math.min(np[2] / len, 1));
    const lowHorizon = [Math.cos(nAng + PI / 2), Math.cos(nAng - PI / 2)];
    const horizonCos = [...lowHorizon];
    for (let j = 0; j < AO_STEPS; j++) {
      const u = (j + stepJitter) / AO_STEPS;
      const s = Math.max(u ** AO_SAMPLE_POWER, MIN_DIST / R) * R;
      for (let side = 0; side < 2; side++) {
        const sideSign = side === 0 ? 1 : -1;
        const dx = dir[0] * s * sideSign;
        const dy = dir[1] * s * sideSign;
        const zSample = sampleDepth(p[0] + dx, p[1] + dy);
        if (zSample === null) continue;
        const dz = zSample - p[2];
        const cosH = dz / Math.hypot(dx, dy, dz);
        const w = Math.min(Math.max(Math.hypot(dx, dy, dz * AO_Z_FALLOFF_SCALE) * FALLOFF_MUL + FALLOFF_ADD, 0), 1);
        const shc = lowHorizon[side] + (cosH - lowHorizon[side]) * w;
        horizonCos[side] = Math.max(horizonCos[side], shc);
      }
    }
    const h = [
      -Math.acos(Math.min(Math.max(horizonCos[1], -1), 1)),
      Math.acos(Math.min(Math.max(horizonCos[0], -1), 1)),
    ];
    const clamped = h.map((angle) => Math.min(Math.max(angle, nAng - PI / 2), nAng + PI / 2));
    const iarc = (angle) => (Math.cos(nAng) + 2 * angle * Math.sin(nAng) - Math.cos(2 * angle - nAng)) / 4;
    visibility += len * (iarc(clamped[0]) + iarc(clamped[1]));
  }
  return visibility / slices;
}

describe('gtao slice integral (JS mirror of the shader)', () => {
  it('gives visibility 1.0 on an open flat floor', () => {
    const v = gtaoVisibility({ slices: 8, sampleDepth: () => 0 });
    expect(Math.abs(v - 1)).toBeLessThan(1e-9);
  });

  it('gives about 0.5 at the base of a vertical wall', () => {
    const wallHeight = 0.01;
    const v = gtaoVisibility({ slices: 64, sampleDepth: (x) => (x < 0 ? wallHeight : 0) });
    expect(Math.abs(v - 0.5)).toBeLessThan(0.05);
  });
});

describe('AO strength mix (JS mirror of the shader)', () => {
  const mix = (ao) => 1 + (ao - 1) * AO_STRENGTH;

  it('keeps full visibility unchanged', () => {
    expect(mix(1)).toBe(1);
  });

  it('halves the darkening of an occluded sample', () => {
    expect(mix(0.4)).toBeCloseTo(0.7, 12);
  });
});

describe('AO source check', () => {
  it('applies the strength mix in the forward shaders', () => {
    for (const source of [diceFragmentSource, floorFragmentSource]) {
      expect(source).toContain(`const float AO_STRENGTH = ${AO_STRENGTH};`);
      expect(source).toContain('mix(1.0, ao, AO_STRENGTH)');
    }
  });

  it('upsamples against the rounded surface depth', () => {
    expect(diceFragmentSource).toContain('litColor(mix(uColor, uInk, label.a), n, carve.a, surface.z)');
    expect(floorFragmentSource).toContain('litColor(uColor, normalize(vNormal), 1.0, vWorldPos.z)');
    expect(aoPrepassFragmentSource).toContain('uniform vec2 uDepthRange;');
  });

  it('keeps shadow uniforms and helpers out of the render sources', () => {
    for (const file of ['shaders.js', 'renderer.js']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      for (const token of ['uShadowMap', 'uLightViewProj', 'shadowFactor', 'drawShadowPass', 'createLightViewProjection', 'uEye - vWorldPos']) {
        expect(source, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });
});
