import { describe, expect, it } from 'vitest';
import * as mat3 from '../math/mat3.js';
import * as vec3 from '../math/vec3.js';
import { createBody } from './body.js';
import {
  BAUMGARTE,
  EVENT_MIN_SPEED,
  FRICTION_BOX,
  RESTITUTION_BOX,
  SLOP,
  SOLVER_ITERATIONS,
  solveContacts,
} from './contacts.js';
import { FIXED_DT } from './world.js';

const nearRel = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.max(Math.abs(expected), 1e-12));

const SHAPE = {
  radius: 0.0139,
  volume: 4.096e-6,
  inertia: mat3.fromDiagonal(new Float64Array(9), 2e-5, 3e-5, 4e-5),
};

const makeBody = (position = [0, 0, 0], velocity = [0, 0, 0]) => {
  const body = createBody(SHAPE, { position });
  vec3.copy(body.linearVelocity, Float64Array.from(velocity));
  return body;
};

const makeWorld = (...contacts) => ({ contacts, events: [] });

const floorContact = (a, { point = Array.from(a.position), depth = 0 } = {}) => ({
  a,
  b: null,
  surface: 'floor',
  point,
  normal: [0, 0, 1],
  depth,
});

const biasSpeed = (depth) => (BAUMGARTE * Math.max(depth - SLOP, 0)) / FIXED_DT;

describe('restitution', () => {
  it('resolves an approach speed above the threshold to the restitution target', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    nearRel(body.linearVelocity[2], RESTITUTION_BOX);
  });

  it('kills the approach speed below the threshold instead of bouncing', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -0.05]);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    nearRel(body.linearVelocity[2], 0, 1e-12);
  });

  it('leaves a separating contact untouched', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, 1]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);
    expect(body.linearVelocity[2]).toBe(1);
    expect(world.events).toEqual([]);
  });
});

describe('friction', () => {
  it('clamps the tangent impulse to mu times the accumulated normal impulse', () => {
    const body = makeBody([0, 0, 0.01], [1, 0, -0.5]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);

    const mass = 1 / body.invMass;
    const normalImpulse = world.events[0].impulse;
    const tangentImpulse = (1 - body.linearVelocity[0]) * mass;

    expect(body.linearVelocity[0]).toBeGreaterThan(0);
    expect(body.linearVelocity[0]).toBeLessThan(1);
    nearRel(tangentImpulse, FRICTION_BOX * normalImpulse);
    expect(tangentImpulse).toBeLessThanOrEqual(FRICTION_BOX * normalImpulse * (1 + 1e-12));
  });

  it('does not apply friction without a normal impulse', () => {
    const body = makeBody([0, 0, 0.01], [1, 0, 0]);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    expect(Array.from(body.linearVelocity)).toEqual([1, 0, 0]);
  });
});

describe('accumulated impulses', () => {
  it('keeps a resting contact stable over many iterations', () => {
    const depth = 0.0005;
    const body = makeBody([0, 0, 0.0139]);
    const world = makeWorld(floorContact(body, { depth }));
    const target = biasSpeed(depth);

    for (let step = 0; step < SOLVER_ITERATIONS * 20; step += 1) {
      world.events.length = 0;
      body.linearVelocity[2] -= 9.81 * FIXED_DT;
      solveContacts(world, FIXED_DT);
      nearRel(body.linearVelocity[2], target);
      expect(body.linearVelocity[0]).toBe(0);
      expect(body.linearVelocity[1]).toBe(0);
      expect(world.events).toEqual([]);
    }
  });

  it('never lets the normal impulse go negative', () => {
    const body = makeBody([0, 0, 0.0139], [0, 0, 0.02]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);
    expect(body.linearVelocity[2]).toBe(0.02);
    expect(world.events).toEqual([]);
  });
});

describe('speculative contacts', () => {
  const depth = -0.0001;
  const allowedApproach = -depth / FIXED_DT;

  it('allows an approach speed up to -depth/dt without a bias', () => {
    const body = makeBody([0, 0, 0.02], [0, 0, -0.03]);
    solveContacts(makeWorld(floorContact(body, { depth })), FIXED_DT);
    expect(body.linearVelocity[2]).toBe(-0.03);
  });

  it('slows a faster approach down to -depth/dt without a bias', () => {
    const approach = allowedApproach * 1.5;
    expect(approach).toBeLessThan(0.1);
    const body = makeBody([0, 0, 0.02], [0, 0, -approach]);
    solveContacts(makeWorld(floorContact(body, { depth })), FIXED_DT);
    nearRel(body.linearVelocity[2], -allowedApproach);
  });
});

describe('die-die contacts', () => {
  it('resolves two equal masses symmetrically', () => {
    const a = makeBody([0, 0, 0.01], [0, 0, -1]);
    const b = makeBody([0, 0, -0.01], [0, 0, 1]);
    const world = makeWorld({
      a,
      b,
      surface: 'die',
      point: [0, 0, 0],
      normal: [0, 0, 1],
      depth: 0,
    });

    solveContacts(world, FIXED_DT);

    const speed = (0.4 * 2) / 2;
    nearRel(a.linearVelocity[2], speed);
    nearRel(b.linearVelocity[2], -speed);
    nearRel(a.angularVelocity[1], 0, 1e-9);
    expect(world.events).toHaveLength(1);
    expect(world.events[0].surface).toBe('die');
    expect(world.events[0].b).toBe(b);
  });
});

describe('settling', () => {
  it('damps the spin of a body in contact', () => {
    const body = makeBody([0, 0, 0.0139]);
    vec3.set(body.angularVelocity, 0, 0, 5);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    expect(body.angularVelocity[2]).toBeGreaterThan(4);
    expect(body.angularVelocity[2]).toBeLessThan(5);
  });

  it('leaves the spin of a body without contacts alone', () => {
    const body = makeBody([0, 0, 0.1]);
    vec3.set(body.angularVelocity, 0, 0, 5);
    solveContacts(makeWorld(), FIXED_DT);
    expect(body.angularVelocity[2]).toBe(5);
  });
});

describe('impact events', () => {
  it('pushes one event per pair and step with the summed normal impulse', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    const corner = (x) =>
      floorContact(body, { point: [x, 0, 0.0139], depth: 0 });
    const world = makeWorld(corner(0.005), corner(-0.005));

    solveContacts(world, FIXED_DT);

    expect(world.events).toHaveLength(1);
    const [event] = world.events;
    expect(event.a).toBe(body);
    expect(event.b).toBe(null);
    expect(event.surface).toBe('floor');
    nearRel(event.speed, 1);
    expect(event.point[0]).toBeCloseTo(0.005, 12);
    const mass = 1 / body.invMass;
    nearRel(event.impulse, (body.linearVelocity[2] + 1) * mass);
  });

  it('ignores an approach below the event threshold', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -EVENT_MIN_SPEED / 2]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);
    expect(world.events).toEqual([]);
  });

  it('pushes no event for a resting contact', () => {
    const body = makeBody([0, 0, 0.0139]);
    const world = makeWorld(floorContact(body, { depth: SLOP }));
    solveContacts(world, FIXED_DT);
    expect(world.events).toEqual([]);
  });
});
