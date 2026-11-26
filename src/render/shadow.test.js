import { describe, expect, it } from 'vitest';
import { DIE_RADIUS } from '../physics/body.js';
import * as vec3 from '../math/vec3.js';
import { createLightProjection } from './camera.js';
import { LIGHT_ANGULAR_RADIUS, LIGHT_DIRECTION } from './material.js';
import { SHADOW_BLOCKER_INNER_TAPS, SHADOW_PCF_TAPS, diceFragmentSource, shadowDepthFragmentSource, shadowDepthVertexSource } from './shaders.js';
import { SHADOW_INNER_RADIUS } from './renderer.js';

// Mirrors renderer.shadowPad: frustum pad and blocker search radius.
const BOX = { W: 0.0675, H: 0.1462, D: 0.05 };
const PAD = BOX.D * Math.tan(LIGHT_ANGULAR_RADIUS) + 2 * DIE_RADIUS;
const TRAVEL = [-LIGHT_DIRECTION[0], -LIGHT_DIRECTION[1], -LIGHT_DIRECTION[2]];
const LP = createLightProjection(BOX, TRAVEL, PAD);

const inside = (p) => {
  const c = vec3.transformMat4([0, 0, 0], p, LP.viewProjection);
  return Math.abs(c[0]) < 1 && Math.abs(c[1]) < 1 && c[2] > -1 && c[2] < 1;
};

describe('createLightProjection', () => {
  it('keeps the box corners inside the padded frustum', () => {
    for (const x of [-BOX.W / 2, BOX.W / 2]) {
      for (const y of [-BOX.H / 2, BOX.H / 2]) {
        for (const z of [0, BOX.D]) {
          expect(inside([x, y, z]), `${x} ${y} ${z}`).toBe(true);
        }
      }
    }
  });

  it('keeps a half-pad margin around the corners and ends within 1.5 pads', () => {
    for (const [x, y] of [[-BOX.W / 2, -BOX.H / 2], [BOX.W / 2, -BOX.H / 2], [BOX.W / 2, BOX.H / 2], [-BOX.W / 2, BOX.H / 2]]) {
      const len = Math.hypot(x, y);
      const out = [x / len, y / len];
      expect(inside([x + out[0] * 0.5 * PAD, y + out[1] * 0.5 * PAD, 0])).toBe(true);
      expect(inside([x + out[0] * 1.5 * PAD, y + out[1] * 1.5 * PAD, 0])).toBe(false);
    }
  });

  it('maps the lid closer to the light than the floor', () => {
    const top = vec3.transformMat4([0, 0, 0], [0, 0, BOX.D], LP.viewProjection)[2];
    const bottom = vec3.transformMat4([0, 0, 0], [0, 0, 0], LP.viewProjection)[2];
    expect(top).toBeLessThan(bottom);
  });
});

describe('shadow constants', () => {
  // The dense inner blocker search must catch a die silhouette centered
  // anywhere in its disk: the worst-case covering radius over the disk has to
  // stay below the die radius (Vogel disk, no rotation, 400x400 probe grid).
  it('inner blocker search covers a die silhouette centered in its disk', () => {
    const taps = [];
    for (let i = 0; i < SHADOW_BLOCKER_INNER_TAPS; i++) {
      const phi = i * 2.39996323;
      const r = Math.sqrt((i + 0.5) / SHADOW_BLOCKER_INNER_TAPS) * SHADOW_INNER_RADIUS;
      taps.push([Math.cos(phi) * r, Math.sin(phi) * r]);
    }
    const grid = 400;
    let cover = 0;
    for (let ix = 0; ix <= grid; ix++) {
      for (let iy = 0; iy <= grid; iy++) {
        const x = -SHADOW_INNER_RADIUS + (2 * SHADOW_INNER_RADIUS * ix) / grid;
        const y = -SHADOW_INNER_RADIUS + (2 * SHADOW_INNER_RADIUS * iy) / grid;
        if (Math.hypot(x, y) > SHADOW_INNER_RADIUS) continue;
        let d = Infinity;
        for (const t of taps) d = Math.min(d, Math.hypot(t[0] - x, t[1] - y));
        cover = Math.max(cover, d);
      }
    }
    expect(cover).toBeLessThan(DIE_RADIUS);
  });

  it('keeps the PCF kernel at or above 8 taps', () => {
    expect(SHADOW_PCF_TAPS).toBeGreaterThanOrEqual(8);
  });

  // The blocker copy stores depth as floor(e)/255 + round(fract(e)*255)/65025.
  it('round-trips the 16-bit depth pack within one and a half steps', () => {
    for (let i = 0; i <= 1000; i++) {
      const d = i / 1000;
      const e = d * 255.0;
      const hi = Math.floor(e) / 255.0;
      const lo = e - Math.floor(e);
      const decoded = hi + Math.round(lo * 255) / 255 / 255;
      expect(Math.abs(decoded - d)).toBeLessThanOrEqual(1.5 / 255 / 255);
    }
  });

  it('writes the rounded surface depth and the packed copy', () => {
    expect(shadowDepthFragmentSource).toContain('gl_FragDepth = depth;');
    expect(shadowDepthFragmentSource).toContain('vec4(floor(e) / 255.0, fract(e), 0.0, 1.0)');
    expect(shadowDepthVertexSource).toContain('uLightViewProj');
    expect(diceFragmentSource).toContain('const int SHADOW_PCF_TAPS = 8');
  });
});
