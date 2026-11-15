import { describe, expect, it } from 'vitest';
import * as mat3 from './mat3.js';
import * as mat4 from './mat4.js';

const near = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

const quaternion = (angle, axis) => {
  const [x, y, z] = axis;
  const len = Math.hypot(x, y, z);
  const s = Math.sin(angle / 2) / len;
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
};

describe('mat3', () => {
  it('creates an identity via identity()', () => {
    const m = mat3.identity(mat3.create());
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('fromQuat matches the rotation part of mat4.fromRotationTranslation', () => {
    const q = quaternion(0.7, [1, 2, 3]);
    const m3 = mat3.fromQuat(mat3.create(), q);
    const m4 = mat4.fromRotationTranslation(mat4.create(), q, [0, 0, 0]);
    const expected = [m4[0], m4[1], m4[2], m4[4], m4[5], m4[6], m4[8], m4[9], m4[10]];
    for (let i = 0; i < 9; i += 1) near(m3[i], expected[i]);
  });

  it('transpose swaps rows and columns', () => {
    const a = mat3.fromDiagonal(mat3.create(), 1, 2, 3);
    a[3] = 4;
    a[6] = 5;
    a[7] = 6;
    const t = mat3.transpose(mat3.create(), a);
    expect(Array.from(t)).toEqual([1, 4, 5, 0, 2, 6, 0, 0, 3]);
  });

  it('multiply composes column-major matrices and supports aliasing', () => {
    const a = mat3.fromQuat(mat3.create(), quaternion(0.4, [0, 1, 0]));
    const b = mat3.fromQuat(mat3.create(), quaternion(0.9, [1, 0, 0]));
    const expected = mat3.multiply(mat3.create(), a, b);
    const aliased = mat3.multiply(a, a, b);
    for (let i = 0; i < 9; i += 1) near(aliased[i], expected[i]);
  });

  it('invert returns the identity when multiplied with the original', () => {
    const q = quaternion(1.1, [2, -1, 3]);
    const m = mat3.fromQuat(mat3.create(), q);
    const inv = mat3.invert(mat3.create(), m);
    const product = mat3.multiply(mat3.create(), inv, m);
    for (let i = 0; i < 9; i += 1) near(product[i], i % 4 === 0 ? 1 : 0, 1e-5);
  });

  it('fromDiagonal writes the diagonal and accepts Float64Array', () => {
    const m = mat3.fromDiagonal(new Float64Array(9), 2, 3, 4);
    expect(Array.from(m)).toEqual([2, 0, 0, 0, 3, 0, 0, 0, 4]);
  });

  it('transformVec3 applies the matrix to a plain vector', () => {
    const m = mat3.fromDiagonal(mat3.create(), 2, 3, 4);
    const out = mat3.transformVec3([0, 0, 0], m, [1, 2, 3]);
    expect(out).toEqual([2, 6, 12]);
  });
});
