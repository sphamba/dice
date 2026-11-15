import { describe, expect, it } from 'vitest';
import * as vec3 from './vec3.js';

const close = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('vec3', () => {
  it('creates and fills vectors in a caller-provided out array', () => {
    const out = vec3.create();
    expect(out.length).toBe(3);
    expect(vec3.fromValues(1, 2, 3)).toEqual(new Float32Array([1, 2, 3]));
    expect(vec3.set(new Float64Array(3), 4, 5, 6)).toEqual(new Float64Array([4, 5, 6]));
    expect(vec3.copy([], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('adds, subtracts and scales', () => {
    expect(vec3.add([], [1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(vec3.sub([], [4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(vec3.scale([], [1, -2, 3], 2)).toEqual([2, -4, 6]);
    expect(vec3.scaleAndAdd([], [1, 1, 1], [2, 3, 4], 2)).toEqual([5, 7, 9]);
    expect(vec3.negate([], [1, -2, 3])).toEqual([-1, 2, -3]);
  });

  it('computes dot, length, distance and lerp', () => {
    close(vec3.dot([1, 2, 3], [4, 5, 6]), 32);
    close(vec3.length([3, 4, 0]), 5);
    close(vec3.lengthSq([3, 4, 0]), 25);
    close(vec3.distance([1, 2, 3], [4, 6, 3]), 5);
    expect(vec3.lerp([], [0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });

  it('follows the right-handed cross product convention', () => {
    const z = vec3.cross([], [1, 0, 0], [0, 1, 0]);
    close(z[0], 0);
    close(z[1], 0);
    close(z[2], 1);

    const x = vec3.cross([], [0, 1, 0], [0, 0, 1]);
    close(x[0], 1);
    close(x[1], 0);
    close(x[2], 0);
  });

  it('normalizes to unit length and keeps the zero vector at zero', () => {
    const n = vec3.normalize([], [3, 4, 0]);
    close(n[0], 0.6);
    close(n[1], 0.8);
    close(vec3.length(n), 1);

    const zero = vec3.normalize([], [0, 0, 0]);
    expect(zero).toEqual([0, 0, 0]);
    expect(Number.isNaN(zero[0])).toBe(false);
  });

  it('transforms by a column-major mat3', () => {
    const rotZ90 = [0, 1, 0, -1, 0, 0, 0, 0, 1];
    const out = vec3.transformMat3([], [1, 0, 0], rotZ90);
    close(out[0], 0);
    close(out[1], 1);
    close(out[2], 0);
  });

  it('transforms a point by a column-major mat4 with w = 1', () => {
    const translation = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1];
    const out = vec3.transformMat4(new Float64Array(3), [1, 2, 3], translation);
    expect(out).toEqual(new Float64Array([11, 22, 33]));
  });

  it('divides by the resulting w when it is not 1', () => {
    const perspective = [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    const out = vec3.transformMat4([], [2, 0, 0], perspective);
    close(out[0], 1);
    close(out[1], 0);
    close(out[2], 0);
  });

  it('rotates a vector by a quaternion', () => {
    const q = [0, 0, Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)];
    const out = vec3.transformQuat([], [1, 0, 0], q);
    close(out[0], 0);
    close(out[1], 1);
    close(out[2], 0);
  });

  it('accepts mixed array types', () => {
    const out = vec3.add(new Float64Array(3), new Float32Array([1, 2, 3]), [1, 1, 1]);
    expect(out).toBeInstanceOf(Float64Array);
    close(out[0], 2);
    close(out[1], 3);
    close(out[2], 4);
  });
});
