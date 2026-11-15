import { describe, expect, it } from 'vitest';
import * as mat4 from './mat4.js';

const near = (a, b, eps = 1e-5) => expect(Math.abs(a - b)).toBeLessThan(eps);

const quaternion = (angle, axis) => {
  const [x, y, z] = axis;
  const len = Math.hypot(x, y, z);
  const s = Math.sin(angle / 2) / len;
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
};

const transformPoint = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

describe('mat4', () => {
  it('starts with an identity via identity()', () => {
    const m = mat4.identity(mat4.create());
    for (let i = 0; i < 16; i += 1) near(m[i], i % 5 === 0 ? 1 : 0);
  });

  it('multiply(invert(M), M) is the identity for a rigid transform', () => {
    const q = quaternion(0.83, [1, -2, 0.5]);
    const source = mat4.fromRotationTranslation(mat4.create(), q, [3, -4, 5]);
    const inverse = mat4.invert(mat4.create(), source);
    const product = mat4.multiply(mat4.create(), inverse, source);
    for (let i = 0; i < 16; i += 1) near(product[i], i % 5 === 0 ? 1 : 0);
  });

  it('invert returns null for a singular matrix', () => {
    expect(mat4.invert(mat4.create(), mat4.create())).toBeNull();
  });

  it('ortho maps the near and far box corners to the NDC cube', () => {
    const m = mat4.ortho(mat4.create(), -2, 3, -4, 5, 0.5, 10);
    const min = transformPoint(m, [-2, -4, -0.5]);
    const max = transformPoint(m, [3, 5, -10]);
    for (let i = 0; i < 3; i += 1) {
      near(min[i], -1);
      near(max[i], 1);
    }
  });

  it('fromRotationTranslationScale applies primary-axis scaling', () => {
    const q = quaternion(Math.PI / 2, [0, 0, 1]);
    const m = mat4.fromRotationTranslationScale(mat4.create(), q, [1, 2, 3], [2, 3, 4]);
    const p = transformPoint(m, [1, 0, 0]);
    near(p[0], 1);
    near(p[1], 2 + 2);
    near(p[2], 3);
  });

  it('transpose swaps rows and columns and supports aliasing', () => {
    const m = mat4.fromRotationTranslation(mat4.create(), quaternion(0.3, [1, 1, 0]), [1, 2, 3]);
    const t = mat4.transpose(mat4.create(), m);
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) near(t[c * 4 + r], m[r * 4 + c]);
    }
    const aliased = mat4.transpose(m, m);
    for (let i = 0; i < 16; i += 1) near(aliased[i], t[i]);
  });

  it('lookAt places the eye at the origin looking down -z', () => {
    const m = mat4.lookAt(mat4.create(), [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const eye = transformPoint(m, [0, 0, 5]);
    const center = transformPoint(m, [0, 0, 0]);
    for (let i = 0; i < 3; i += 1) near(eye[i], 0);
    near(center[0], 0);
    near(center[1], 0);
    near(center[2], -5);
  });

  it('normalFromMat4 inverts the upper 3x3 for a diagonal scale', () => {
    const m = mat4.fromRotationTranslationScale(mat4.create(), [0, 0, 0, 1], [0, 0, 0], [2, 4, 5]);
    const n = mat4.normalFromMat4(new Float64Array(9), m);
    near(n[0], 0.5);
    near(n[4], 0.25);
    near(n[8], 0.2);
  });

  it('accepts plain arrays as output', () => {
    const out = mat4.identity([]);
    expect(out.length).toBe(16);
  });
});
