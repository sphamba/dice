import { describe, expect, it } from 'vitest';
import { ANGULAR_DAMPING, LINEAR_DAMPING, integratePositions, integrateVelocities } from './integrator.js';
import { createBody } from './body.js';
import * as mat3 from '../math/mat3.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

const near = (actual, expected, eps = 1e-12) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps);

const nearRel = (actual, expected, eps = 1e-12) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.abs(expected));

const DT = 1 / 480;
const STEPS = 480;

const makeBody = () =>
  createBody({
    radius: 0.0139,
    volume: 4.096e-6,
    inertia: mat3.fromDiagonal(new Float64Array(9), 2e-5, 3e-5, 4e-5),
  });

const NO_DAMPING = { linear: 0, angular: 0 };

const run = (body, gravity, damping = NO_DAMPING) => {
  for (let i = 0; i < STEPS; i += 1) {
    integrateVelocities([body], gravity, DT, damping);
    integratePositions([body], DT);
  }
};

describe('integrateVelocities', () => {
  it('adds gravity times dt to the velocity', () => {
    const body = makeBody();
    integrateVelocities([body], [0, 0, -9.81], DT, NO_DAMPING);
    nearRel(body.linearVelocity[2], -9.81 * DT);
  });

  it('damps both velocities with the exponential factor', () => {
    const body = makeBody();
    vec3.set(body.linearVelocity, 1, 0, 0);
    vec3.set(body.angularVelocity, 0, 2, 0);
    integrateVelocities([body], [0, 0, 0], 0.5);
    nearRel(body.linearVelocity[0], 1 / (1 + LINEAR_DAMPING * 0.5));
    nearRel(body.angularVelocity[1], 2 / (1 + ANGULAR_DAMPING * 0.5));
  });
});

describe('integratePositions', () => {
  it('matches the symplectic Euler sum in free fall', () => {
    const body = makeBody();
    run(body, [0, 0, -9.81]);
    const t = STEPS * DT;
    nearRel(body.linearVelocity[2], -9.81 * t, 1e-13);
    nearRel(body.position[2], -9.81 * DT * DT * STEPS * (STEPS + 1) / 2, 1e-13);
  });

  it('moves with the new velocity after a velocity update', () => {
    const body = makeBody();
    const gravity = [0, 0, -9.81];
    integrateVelocities([body], gravity, DT, NO_DAMPING);
    integratePositions([body], DT);
    nearRel(body.linearVelocity[2], -9.81 * DT);
    nearRel(body.position[2], -9.81 * DT * DT);
  });

  it('turns a constant angular velocity into the matching axis angle', () => {
    const body = makeBody();
    vec3.set(body.angularVelocity, 0, 0, 2);
    run(body, [0, 0, 0]);
    const expected = quat.setAxisAngle(quat.create(), [0, 0, 1], 2);
    for (let i = 0; i < 4; i += 1) near(body.orientation[i], expected[i], 1e-3);
    expect(Math.hypot(...body.orientation)).toBeCloseTo(1, 6);
  });
});
