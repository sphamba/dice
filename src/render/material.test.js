import { describe, expect, it } from 'vitest';
import { hslToRgb } from '../dice/colors.js';
import {
  ALPHA,
  F0,
  INK_SPECULAR_OCCLUSION,
  LIGHT_ANGULAR_RADIUS,
  LIGHT_DIRECTION,
  capIrradiance,
  diceLinear,
  diceSrgb,
  ggxDistribution,
  smithVisibility,
  specularRadiance,
} from './material.js';

const PI = Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const TANGENT = norm(cross([0, 1, 0], LIGHT_DIRECTION));
const BITANGENT = cross(LIGHT_DIRECTION, TANGENT);

// Stratified samples over the light disk, uniform in solid angle: a tangent
// plane grid weights the integrand by 1/r^4 and converges far too slowly.
const DISK = (() => {
  const samples = [];
  const rings = 24;
  const cosLimit = Math.cos(LIGHT_ANGULAR_RADIUS);
  const weight = (2 * PI * (1 - cosLimit)) / (rings * rings);
  for (let i = 0; i < rings; i++) {
    const mu = cosLimit + ((1 - cosLimit) * (i + 0.5)) / rings;
    const sin = Math.sqrt(1 - mu * mu);
    for (let j = 0; j < rings; j++) {
      const phi = (2 * PI * (j + 0.5)) / rings + i * 0.9;
      const dir = norm(
        [0, 1, 2].map(
          (k) =>
            LIGHT_DIRECTION[k] * mu +
            sin * (Math.cos(phi) * TANGENT[k] + Math.sin(phi) * BITANGENT[k]),
        ),
      );
      samples.push({ dir, weight });
    }
  }
  return samples;
})();

function numericIrradiance(n) {
  let sum = 0;
  for (const s of DISK) sum += Math.max(dot(n, s.dir), 0) * s.weight;
  return sum;
}

// Ground truth for the specular: the true roughness 0.25 lobe integrated over
// the whole disk, not the widened representative-point lobe of the shader.
function numericSpecular(n) {
  const ndotv = Math.max(n[2], 1e-4);
  let sum = 0;
  for (const s of DISK) {
    const ndotl = dot(n, s.dir);
    if (ndotl <= 0) continue;
    const h = norm([s.dir[0], s.dir[1], s.dir[2] + 1]);
    const vdoth = Math.min(Math.max(h[2], 1e-6), 1);
    const f = F0 + (1 - F0) * (1 - vdoth) ** 5;
    sum +=
      ggxDistribution(ALPHA, Math.min(Math.max(dot(n, h), 1e-6), 1)) *
      smithVisibility(ndotv, ndotl, ALPHA) *
      f *
      ndotl *
      s.weight;
  }
  return sum;
}

const TILTS = [0, 10, 20, 30, 40, 50, 60];
// Tilted away from the light centre, so gamma runs from 15 to 75 deg: the
// range where the disk starts to clip the surface horizon.
const tilted = (deg) => {
  const t = (deg * PI) / 180;
  return [-Math.sin(t), 0, Math.cos(t)];
};

describe('dice lighting', () => {
  it('matches a quadrature of the disk for the diffuse term within 5%', () => {
    const errors = TILTS.map((deg) => {
      const n = tilted(deg);
      const numeric = numericIrradiance(n);
      return Math.abs(capIrradiance(dot(n, LIGHT_DIRECTION)) - numeric) / numeric;
    });
    expect(Math.max(...errors)).toBeLessThan(0.05);
  });

  it('matches a quadrature of the disk for the specular term within 30%', () => {
    const errors = TILTS.map((deg) => {
      const n = tilted(deg);
      const numeric = numericSpecular(n);
      const analytic = specularRadiance(n, numericIrradiance(n));
      return Math.abs(analytic - numeric) / numeric;
    });
    expect(Math.max(...errors)).toBeLessThan(0.3);
  });

  it('stays finite and inside the display range over a grid of normals', () => {
    const failures = [];
    for (const base of [[0.5, 0.5, 0.5], [0.36, 0.14, 0.14], [1, 1, 1], [0, 0, 0]]) {
      for (let theta = 0; theta <= 180; theta += 5) {
        for (let phi = 0; phi < 360; phi += 30) {
          const t = (theta * PI) / 180;
          const p = (phi * PI) / 180;
          const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
          for (const cavity of [0, 1]) {
            for (const ao of [0, 1]) {
              const out = diceSrgb(base, n, cavity, ao, 0.5);
              const label = `${base} n=${n.map((c) => c.toFixed(2))} cavity=${cavity} ao=${ao}`;
              if (!out.every(Number.isFinite)) failures.push(`${label} not finite: ${out}`);
              else if (out.some((c) => c < 0 || c > 1)) failures.push(`${label} out of range: ${out}`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('dims the specular inside an engraved glyph and leaves the face alone', () => {
    // Black ink carries no diffuse, so its linear output is the specular alone.
    const black = [0, 0, 0];
    const n = tilted(20);
    const face = Math.max(...diceLinear(black, n, 1, 1, 0.5, 0));
    const ink = Math.max(...diceLinear(black, n, 1, 1, 0.5, 1));
    expect(ink / face).toBeCloseTo(INK_SPECULAR_OCCLUSION, 6);
    // The occlusion must not crush the ink to pure black on screen.
    expect(Math.max(...diceSrgb(black, n, 1, 1, 0.5, 1))).toBeGreaterThan(0);
    // A plain face is unaffected by the term: no ink, no occlusion.
    expect(diceLinear(black, n, 1, 1, 0.5, 0)).toEqual(diceLinear(black, n, 1, 1, 0.5));
  });

  it('keeps the mean brightness of an upward face within 15%', () => {
    // Present display-space formula of an unoccluded upward face: hemisphere
    // ambient 0.5, intensity 0.65 along the old light, Blinn-Phong power 40.
    const legacy = (base) => {
      const ndotl = 0.8660254037844386;
      const halfDir = norm([0.4, 0.3, 1.8660254037844386]);
      const specular = halfDir[2] ** 40 * 0.22 * 0.65;
      return base.map((c) => Math.min(1, Math.max(0, c * (0.5 + 0.65 * ndotl) + specular)));
    };
    const mean = (c) => (c[0] + c[1] + c[2]) / 3;
    const colors = [];
    for (const h of [0, 120, 240]) {
      for (const s of [0.45, 0.85]) {
        for (const l of [0.25, 0.75]) colors.push(hslToRgb(h, s, l));
      }
    }
    colors.push(hslToRgb(0, 0, 0.5));

    const up = [0, 0, 1];
    const errors = colors.map((base) => {
      const before = mean(legacy(base));
      const after = mean(diceSrgb(base, up, 1, 1, 0.5));
      return Math.abs(after - before) / before;
    });
    expect(Math.max(...errors)).toBeLessThan(0.15);
  });
});
