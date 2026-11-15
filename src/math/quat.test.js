import { describe, expect, it } from 'vitest';
import * as quat from './quat.js';
import * as vec3 from './vec3.js';

const close = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

const axisAngle = (axis, angle) => quat.setAxisAngle(quat.create(), axis, angle);

describe('quat', () => {
  it('creates the identity', () => {
    expect(quat.create()).toHaveLength(4);
    expect(quat.identity([])).toEqual([0, 0, 0, 1]);
  });

  it('sets an axis angle in [x, y, z, w] layout', () => {
    const q = axisAngle([0, 0, 1], Math.PI / 2);
    close(q[0], 0);
    close(q[1], 0);
    close(q[2], Math.sin(Math.PI / 4));
    close(q[3], Math.cos(Math.PI / 4));
  });

  it('rotates x by 90 degrees about z to y', () => {
    const q = axisAngle([0, 0, 1], Math.PI / 2);
    const out = quat.rotateVec3([], q, [1, 0, 0]);
    close(out[0], 0);
    close(out[1], 1);
    close(out[2], 0);
    close(vec3.length(out), 1);
  });

  it('multiplies rotations in application order', () => {
    const z90 = axisAngle([0, 0, 1], Math.PI / 2);
    const x90 = axisAngle([1, 0, 0], Math.PI / 2);
    const q = quat.multiply([], x90, z90);
    const out = quat.rotateVec3([], q, [0, 1, 0]);
    close(out[0], -1);
    close(out[1], 0);
    close(out[2], 0);
  });

  it('normalizes, conjugates and inverts', () => {
    const n = quat.normalize([], [0, 0, 0, 2]);
    expect(n).toEqual([0, 0, 0, 1]);

    const q = quat.normalize([], [1, 2, 3, 4]);
    expect(quat.conjugate([], q)).toEqual([-q[0], -q[1], -q[2], q[3]]);

    const inv = quat.invert([], q);
    const identity = quat.multiply([], q, inv);
    close(identity[0], 0);
    close(identity[1], 0);
    close(identity[2], 0);
    close(identity[3], 1);
  });

  it('recovers a quaternion from a column-major mat3', () => {
    const q = quat.normalize([], [0.2, -0.4, 0.5, 0.7]);
    const ex = quat.rotateVec3([], q, [1, 0, 0]);
    const ey = quat.rotateVec3([], q, [0, 1, 0]);
    const ez = quat.rotateVec3([], q, [0, 0, 1]);
    const m = [ex[0], ex[1], ex[2], ey[0], ey[1], ey[2], ez[0], ez[1], ez[2]];
    const back = quat.fromMat3([], m);
    const d = back[0] * q[0] + back[1] * q[1] + back[2] * q[2] + back[3] * q[3];
    close(Math.abs(d), 1, 1e-5);
  });

  it('turns a 90 degree rotation about z into the expected mat3', () => {
    const m = [0, 1, 0, -1, 0, 0, 0, 0, 1];
    const q = quat.fromMat3([], m);
    const out = quat.rotateVec3([], q, [1, 0, 0]);
    close(out[0], 0);
    close(out[1], 1);
    close(out[2], 0);
  });

  it('integrates a constant angular velocity into one axis angle rotation', () => {
    const omega = [0, 0, 2];
    const dt = 1e-4;
    const steps = 20000;
    const q = quat.identity(quat.create());
    for (let i = 0; i < steps; i += 1) quat.integrate(q, q, omega, dt);
    const total = 2 * dt * steps;
    const expected = axisAngle([0, 0, 1], total);
    const c = Math.abs(q[0] * expected[0] + q[1] * expected[1] + q[2] * expected[2] + q[3] * expected[3]);
    expect(Math.abs(1 - c)).toBeLessThan(1e-3);
  });

  it('keeps unit length after 10000 integration steps', () => {
    const q = quat.identity(quat.create());
    for (let i = 0; i < 10000; i += 1) {
      quat.integrate(q, q, [0.3, -0.7, 1.1], 1e-3);
      const len = Math.hypot(q[0], q[1], q[2], q[3]);
      expect(Math.abs(len - 1)).toBeLessThan(1e-6);
    }
  });

  it('returns uniform unit quaternions from random', () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const seen = new Set();
    for (let i = 0; i < 1000; i += 1) {
      const q = quat.random(quat.create(), rng);
      close(Math.hypot(q[0], q[1], q[2], q[3]), 1);
      seen.add(q.join(','));
    }
    expect(seen.size).toBe(1000);
  });
});
