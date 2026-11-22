import { describe, expect, it } from 'vitest';
import {
  FIXED_DT,
  MAX_STEPS,
  SLEEP_SPEED,
  SLEEP_TIME,
  WAKE_GRAVITY_DELTA,
  createWorld,
} from './world.js';
import { LINEAR_DAMPING } from './integrator.js';
import { DIE_RADIUS, createBody } from './body.js';
import { createShape } from '../dice/shapes.js';
import * as mat3 from '../math/mat3.js';
import * as vec3 from '../math/vec3.js';

const nearRel = (actual, expected, eps = 1e-12) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.abs(expected));

const BOX = { W: 0.0681, H: 0.1476, D: 0.0681 };

const makeBody = (position = [0, 0, 0.034]) =>
  createBody(
    {
      radius: 0.0139,
      volume: 4.096e-6,
      inertia: mat3.fromDiagonal(new Float64Array(9), 2e-5, 3e-5, 4e-5),
    },
    { position },
  );

const countSteps = (world, run) => {
  let steps = 0;
  const step = world.step;
  world.step = (dt) => {
    steps += 1;
    step(dt);
  };
  run();
  world.step = step;
  return steps;
};

describe('createWorld', () => {
  it('starts empty with gravity towards the floor and the given box', () => {
    const world = createWorld(BOX);
    expect(world.bodies).toEqual([]);
    expect(Array.from(world.gravity)).toEqual([0, 0, -9.81]);
    expect(world.box).toEqual(BOX);
    expect(world.events).toEqual([]);
    expect(world.asleep).toBe(false);
  });

  it('runs 480 fixed steps per simulated second', () => {
    expect(FIXED_DT).toBeCloseTo(1 / 480, 15);
  });

  it('adds and removes bodies', () => {
    const world = createWorld(BOX);
    const body = makeBody();
    world.addBody(body);
    expect(world.bodies).toEqual([body]);
    world.removeBody(body);
    expect(world.bodies).toEqual([]);
  });

  it('replaces the gravity vector on setGravity', () => {
    const world = createWorld(BOX);
    const gravity = [1, 0, -2];
    world.setGravity(gravity);
    expect(Array.from(world.gravity)).toEqual(gravity);
    gravity[0] = 9;
    expect(world.gravity[0]).toBe(1);
  });
});

describe('step', () => {
  it('integrates velocity before position', () => {
    const world = createWorld(BOX);
    const body = makeBody();
    world.addBody(body);
    world.step(FIXED_DT);
    const velocity = -9.81 * FIXED_DT / (1 + LINEAR_DAMPING * FIXED_DT);
    nearRel(body.linearVelocity[2], velocity);
    nearRel(body.position[2], 0.034 + velocity * FIXED_DT);
  });
});

describe('update', () => {
  it('runs at most MAX_STEPS steps per call', () => {
    const world = createWorld(BOX);
    world.addBody(makeBody());
    expect(countSteps(world, () => world.update(1.0))).toBe(MAX_STEPS);
  });

  it('runs one step per fixed timestep of frame time', () => {
    const world = createWorld(BOX);
    world.addBody(makeBody());
    expect(countSteps(world, () => world.update(10 * FIXED_DT))).toBe(10);
  });

  it('drops the remainder when it hits the step cap', () => {
    const world = createWorld(BOX);
    world.addBody(makeBody());
    countSteps(world, () => world.update(1.0));
    expect(countSteps(world, () => world.update(0))).toBe(0);
  });

  it('clears the events at the start of the update', () => {
    const world = createWorld(BOX);
    world.events.push({ type: 'stale' });
    world.update(FIXED_DT);
    expect(world.events).toEqual([]);
  });
});

describe('beforeStep', () => {
  it('runs once per fixed step with the step dt', () => {
    const world = createWorld(BOX);
    const body = makeBody();
    world.addBody(body);
    const calls = [];
    world.beforeStep = (dt) => {
      calls.push(dt);
      vec3.set(body.linearVelocity, 1, 0, 0);
    };
    world.update(2 * FIXED_DT);
    expect(calls).toEqual([FIXED_DT, FIXED_DT]);
    expect(body.position[0]).toBeGreaterThan(0);
  });
});

describe('falling dice', () => {
  it('rests a dropped die on the floor of the box', () => {
    const world = createWorld(BOX);
    const body = createBody(createShape('d6', 0.0139), { position: [0, 0, BOX.H / 2] });
    world.addBody(body);

    for (let i = 0; i < 480; i += 1) world.step(FIXED_DT);

    expect(body.position[2]).toBeGreaterThan(0);
    expect(body.position[2]).toBeLessThan(BOX.H / 2);
    expect(Math.abs(body.linearVelocity[2])).toBeLessThan(0.01);
  });
});

describe('setBox', () => {
  it('moves a body back inside a smaller box and stops it', () => {
    const world = createWorld(BOX);
    const body = makeBody([0.1, 0, 0.01]);
    world.addBody(body);
    vec3.set(body.linearVelocity, 1, 0, 0);
    vec3.set(body.angularVelocity, 0, 0, 5);

    world.setBox({ W: 0.04, H: 0.04, D: 0.04 });

    const half = 0.02 - body.radius;
    expect(body.position[0]).toBeCloseTo(half, 12);
    expect(body.position[2]).toBeCloseTo(body.radius, 12);
    expect(Array.from(body.linearVelocity)).toEqual([0, 0, 0]);
    expect(Array.from(body.angularVelocity)).toEqual([0, 0, 0]);
  });

  it('ignores a zero-sized box and keeps the last valid one', () => {
    const world = createWorld(BOX);
    const body = createBody(createShape('d6', DIE_RADIUS), { position: [0.01, 0.02, 0.03] });
    world.addBody(body);

    world.setBox({ W: 0, H: 0, D: 0 });

    expect(world.box).toEqual(BOX);
    expect(Array.from(body.position)).toEqual([0.01, 0.02, 0.03]);
    for (let index = 0; index < STEPS_PER_SECOND; index += 1) world.step(FIXED_DT);
    expect(body.position[2]).toBeGreaterThan(0);
  });

  it('leaves a body inside the new box alone', () => {
    const world = createWorld(BOX);
    const body = makeBody([0.01, 0.02, 0.03]);
    world.addBody(body);
    vec3.set(body.linearVelocity, 1, 0, 0);

    world.setBox({ W: 0.1, H: 0.1, D: 0.1 });

    expect(body.position[0]).toBeCloseTo(0.01, 12);
    expect(Array.from(body.linearVelocity)).toEqual([1, 0, 0]);
  });
});

const STEPS_PER_SECOND = Math.round(1 / FIXED_DT);

// A die dropped from mid-box, left long enough to settle and fall asleep.
const restingWorld = () => {
  const world = createWorld(BOX);
  const body = createBody(createShape('d6', DIE_RADIUS), { position: [0, 0, BOX.H / 2] });
  world.addBody(body);
  for (let i = 0; i < 3 * STEPS_PER_SECOND; i += 1) world.step(FIXED_DT);
  return { world, body };
};

describe('sleep', () => {
  it('sleeps after SLEEP_TIME below the speed threshold', () => {
    const world = createWorld(BOX);
    world.setGravity([0, 0, 0]);
    world.addBody(makeBody());
    const window = Math.round(SLEEP_TIME / FIXED_DT);

    for (let i = 0; i < window - 2; i += 1) world.step(FIXED_DT);
    expect(world.asleep).toBe(false);

    for (let i = 0; i < 3; i += 1) world.step(FIXED_DT);
    expect(world.asleep).toBe(true);
  });

  it('sleeps once a dropped die settles and zeroes its velocities', () => {
    const { world, body } = restingWorld();
    expect(world.asleep).toBe(true);
    expect(Array.from(body.linearVelocity)).toEqual([0, 0, 0]);
    expect(Array.from(body.angularVelocity)).toEqual([0, 0, 0]);
  });

  it('keeps a fast world awake', () => {
    const world = createWorld(BOX);
    world.setGravity([0, 0, 0]);
    const body = makeBody();
    world.addBody(body);
    vec3.set(body.linearVelocity, SLEEP_SPEED * 2, 0, 0);
    for (let i = 0; i < Math.round(SLEEP_TIME / FIXED_DT) + 2; i += 1) world.step(FIXED_DT);
    expect(world.asleep).toBe(false);
  });
});

describe('waking', () => {
  it('wakes when the drive moves a held die', () => {
    const { world, body } = restingWorld();
    world.beforeStep = () => vec3.set(body.linearVelocity, 0.2, 0, 0);
    const startX = body.position[0];

    world.step(FIXED_DT);

    expect(world.asleep).toBe(false);
    expect(body.position[0]).toBeGreaterThan(startX);
  });

  it('wakes on a non-zero velocity', () => {
    const { world, body } = restingWorld();
    vec3.set(body.linearVelocity, 0.5, 0, 0);
    world.step(FIXED_DT);
    expect(world.asleep).toBe(false);
  });

  it('wakes on addBody', () => {
    const { world } = restingWorld();
    world.addBody(makeBody([0.05, 0.05, 0.05]));
    expect(world.asleep).toBe(false);
  });

  it('wakes on removeBody', () => {
    const { world, body } = restingWorld();
    world.removeBody(body);
    expect(world.asleep).toBe(false);
  });

  it('wakes on setBox', () => {
    const { world } = restingWorld();
    world.setBox({ W: BOX.W, H: BOX.H, D: BOX.D });
    expect(world.asleep).toBe(false);
  });

  it('wakes on a gravity change above WAKE_GRAVITY_DELTA', () => {
    const { world } = restingWorld();
    world.setGravity([0, 0, world.gravity[2] + 2 * WAKE_GRAVITY_DELTA]);
    expect(world.asleep).toBe(false);
  });

  it('stays asleep on a gravity change below WAKE_GRAVITY_DELTA', () => {
    const { world } = restingWorld();
    world.setGravity([0, 0, world.gravity[2] + WAKE_GRAVITY_DELTA * 0.8]);
    expect(world.asleep).toBe(true);

    world.step(FIXED_DT);
    expect(world.asleep).toBe(true);
  });

  it('integrates nothing, detects no contacts and emits no events while asleep', () => {
    const { world, body } = restingWorld();
    const position = Array.from(body.position);
    world.contacts.length = 0;
    world.events.length = 0;

    world.step(FIXED_DT);

    expect(Array.from(body.position)).toEqual(position);
    expect(Array.from(body.linearVelocity)).toEqual([0, 0, 0]);
    expect(Array.from(body.angularVelocity)).toEqual([0, 0, 0]);
    expect(world.contacts).toEqual([]);
    expect(world.events).toEqual([]);
  });
});
