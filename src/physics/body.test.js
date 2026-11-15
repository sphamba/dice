import { describe, expect, it } from 'vitest';
import { DIE_DENSITY, applyImpulse, createBody, updateDerived } from './body.js';
import * as mat3 from '../math/mat3.js';
import * as quat from '../math/quat.js';

const near = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps);

const nearRel = (actual, expected, eps = 1e-12) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.abs(expected));

const tensor = (x, y, z) => mat3.fromDiagonal(new Float64Array(9), x, y, z);

const makeShape = ({ inertia = tensor(2e-5, 3e-5, 4e-5) } = {}) => ({
  radius: 0.0139,
  volume: 4.096e-6,
  inertia,
});

const massOf = (shape, density = DIE_DENSITY) => density * shape.volume;

describe('createBody', () => {
  it('derives the inverse mass and the radius from the shape and the die density', () => {
    const shape = makeShape();
    const body = createBody(shape);
    expect(body.shape).toBe(shape);
    expect(body.radius).toBe(0.0139);
    nearRel(body.invMass, 1 / massOf(shape));
    expect(Array.from(body.position)).toEqual([0, 0, 0]);
    expect(Array.from(body.orientation)).toEqual([0, 0, 0, 1]);
    expect(Array.from(body.linearVelocity)).toEqual([0, 0, 0]);
    expect(Array.from(body.angularVelocity)).toEqual([0, 0, 0]);
  });

  it('takes a density, a position and an orientation', () => {
    const shape = makeShape();
    const body = createBody(shape, {
      density: 600,
      position: [0.01, 0.02, 0.03],
      orientation: [0, 0, 0, 1],
    });
    nearRel(body.invMass, 1 / massOf(shape, 600));
    expect(Array.from(body.position)).toEqual([0.01, 0.02, 0.03]);
  });

  it('inverts the body frame inertia tensor and scales it by the mass', () => {
    const shape = makeShape();
    const m = massOf(shape);
    const body = createBody(shape);
    nearRel(body.invInertiaBody[0], 1 / (2e-5 * m));
    nearRel(body.invInertiaBody[4], 1 / (3e-5 * m));
    nearRel(body.invInertiaBody[8], 1 / (4e-5 * m));
  });
});

describe('updateDerived', () => {
  it('keeps the body frame tensor at identity orientation', () => {
    const body = createBody(makeShape());
    for (let i = 0; i < 9; i += 1) near(body.invInertiaWorld[i], body.invInertiaBody[i]);
  });

  it('rotates the inertia tensor into the world frame', () => {
    const body = createBody(makeShape());
    const m = massOf(body.shape);
    quat.setAxisAngle(body.orientation, [0, 0, 1], Math.PI / 2);
    updateDerived(body);
    const scale = body.invInertiaWorld[0];
    nearRel(body.invInertiaWorld[0], 1 / (3e-5 * m));
    nearRel(body.invInertiaWorld[4], 1 / (2e-5 * m));
    nearRel(body.invInertiaWorld[8], 1 / (4e-5 * m));
    expect(Math.abs(body.invInertiaWorld[1]) / scale).toBeLessThan(1e-6);
    expect(Math.abs(body.invInertiaWorld[3]) / scale).toBeLessThan(1e-6);
  });
});

describe('applyImpulse', () => {
  it('changes the linear velocity by impulse over mass', () => {
    const body = createBody(makeShape());
    applyImpulse(body, [0, 0, 1], [0.01, 0, 0]);
    nearRel(body.linearVelocity[2], 1 / massOf(body.shape));
  });

  it('spins the body with the world frame lever arm cross impulse', () => {
    const body = createBody(makeShape());
    applyImpulse(body, [0, 0, 1], [0.01, 0, 0]);
    const invInertiaY = 1 / (3e-5 * massOf(body.shape));
    nearRel(body.angularVelocity[1], -0.01 * invInertiaY);
  });
});
