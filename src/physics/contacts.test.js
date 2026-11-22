import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as mat3 from '../math/mat3.js';
import * as vec3 from '../math/vec3.js';
import { DIE_RADIUS, createBody } from './body.js';
import {
  BAUMGARTE,
  EVENT_MIN_SPEED,
  FRICTION_DIE,
  FRICTION_FLOOR,
  FRICTION_LID,
  FRICTION_WALL,
  RESTITUTION_BOX,
  RESTITUTION_DIE,
  SLOP,
  SOLVER_ITERATIONS,
  solveContacts,
  WARM_START_DISTANCE,
  warmStartImpulses,
} from './contacts.js';
import { createShape } from '../dice/shapes.js';
import { FIXED_DT, createWorld } from './world.js';

const nearRel = (actual, expected, eps = 1e-9) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps * Math.max(Math.abs(expected), 1e-12));

const SHAPE = {
  radius: DIE_RADIUS,
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

  it('gives a speculative fresh contact the restitution target after the step', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    solveContacts(makeWorld(floorContact(body, { depth: -0.001 })), FIXED_DT);
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

  it('kills the approach speed of a contact carried over from the previous step', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    const world = makeWorld(floorContact(body));
    world.contactCache = [
      {
        a: body,
        b: null,
        surface: 'floor',
        point: Float64Array.from([0, 0, 0.01]),
        normal: { direction: Float64Array.from([0, 0, 1]), impulse: 0 },
        tangents: [
          { direction: Float64Array.from([0, 1, 0]), impulse: 0 },
          { direction: Float64Array.from([-1, 0, 0]), impulse: 0 },
        ],
      },
    ];
    solveContacts(world, FIXED_DT);
    nearRel(body.linearVelocity[2], 0, 1e-12);
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
    nearRel(tangentImpulse, FRICTION_FLOOR * normalImpulse);
    expect(tangentImpulse).toBeLessThanOrEqual(FRICTION_FLOOR * normalImpulse * (1 + 1e-12));
  });

  it('does not apply friction without a normal impulse', () => {
    const body = makeBody([0, 0, 0.01], [1, 0, 0]);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    expect(Array.from(body.linearVelocity)).toEqual([1, 0, 0]);
  });
});

describe('surface friction', () => {
  it('picks the coefficient from the contact surface', () => {
    const pair = (surface) => {
      const a = makeBody([0, 0, 0.01], [1, 0, -0.5]);
      const b = surface === 'die' ? makeBody([0, 0, -0.01], [-1, 0, 0.5]) : null;
      return { a, b, surface, point: [0, 0, 0], normal: [0, 0, 1], depth: 0 };
    };
    const cases = [
      ['floor', FRICTION_FLOOR],
      ['wall', FRICTION_WALL],
      ['lid', FRICTION_LID],
      ['die', FRICTION_DIE],
    ];
    for (const [surface, friction] of cases) {
      const world = makeWorld(pair(surface));
      solveContacts(world, FIXED_DT);
      expect(world.contactCache[0].surface).toBe(surface);
      expect(world.contactCache[0].friction).toBe(friction);
    }
  });
});

describe('friction disk', () => {
  it('clamps the combined tangent impulse on diagonal sliding', () => {
    const body = makeBody([0, 0, 0.01], [1, 1, -0.5]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);

    const mass = 1 / body.invMass;
    const normalImpulse = world.events[0].impulse;
    const slideX = (1 - body.linearVelocity[0]) * mass;
    const slideY = (1 - body.linearVelocity[1]) * mass;
    const tangentImpulse = Math.hypot(slideX, slideY);

    expect(body.linearVelocity[0]).toBeGreaterThan(0);
    expect(body.linearVelocity[1]).toBeGreaterThan(0);
    expect(tangentImpulse).toBeLessThanOrEqual(FRICTION_FLOOR * normalImpulse * (1 + 1e-12));
    nearRel(tangentImpulse, FRICTION_FLOOR * normalImpulse);
  });
});

describe('incline', () => {
  const GRAVITY = 9.81;

  const slideSpeed = (surface, degrees, seconds = 1) => {
    const radians = (degrees * Math.PI) / 180;
    const up = surface === 'lid' ? -1 : 1;
    const body = makeBody([0, 0, 0]);
    const world = makeWorld({
      a: body,
      b: null,
      surface,
      point: Array.from(body.position),
      normal: [0, 0, up],
      depth: 0,
    });
    const gravity = Float64Array.from([
      GRAVITY * Math.sin(radians),
      0,
      -up * GRAVITY * Math.cos(radians),
    ]);
    const steps = Math.round(seconds / FIXED_DT);
    for (let step = 0; step < steps; step += 1) {
      vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, gravity, FIXED_DT);
      solveContacts(world, FIXED_DT);
      world.events.length = 0;
    }
    return body.linearVelocity[0];
  };

  it('holds a floor contact at 20 degrees, below the critical 21.8 degrees', () => {
    expect(Math.abs(slideSpeed('floor', 20))).toBeLessThan(0.02);
  });

  it('lets a floor contact slide at 25 degrees', () => {
    expect(slideSpeed('floor', 25)).toBeGreaterThan(0.3);
  });

  it('lets a lid contact slide at 10 degrees, above the critical 5.7 degrees', () => {
    expect(slideSpeed('lid', 10)).toBeGreaterThan(0.3);
  });
});

describe('accumulated impulses', () => {
  it('keeps a resting contact stable over many iterations', () => {
    const depth = 0.0005;
    const body = makeBody([0, 0, DIE_RADIUS]);
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
    const body = makeBody([0, 0, DIE_RADIUS], [0, 0, 0.02]);
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

    const speed = (RESTITUTION_DIE * 2) / 2;
    nearRel(a.linearVelocity[2], speed);
    nearRel(b.linearVelocity[2], -speed);
    nearRel(a.angularVelocity[1], 0, 1e-9);
    expect(world.events).toHaveLength(1);
    expect(world.events[0].surface).toBe('die');
    expect(world.events[0].b).toBe(b);
  });
});

describe('warm start ordering', () => {
  it('measures every approach before the first replay', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    const corner = (x) => floorContact(body, { point: [x, 0, 0.01] });
    const world = makeWorld(corner(0.005), corner(-0.005));
    world.contactCache = [
      {
        a: body,
        b: null,
        surface: 'floor',
        point: Float64Array.from([0.005, 0, 0.01]),
        normal: { direction: Float64Array.from([0, 0, 1]), impulse: 0.05 },
        tangents: [
          { direction: Float64Array.from([0, 1, 0]), impulse: 0 },
          { direction: Float64Array.from([-1, 0, 0]), impulse: 0 },
        ],
      },
    ];

    solveContacts(world, FIXED_DT);

    for (const prepared of world.contactCache) nearRel(prepared.approach, 1);
  });
});

describe('contact spin', () => {
  it('leaves the spin of a body in contact to the contact impulses', () => {
    const body = makeBody([0, 0, DIE_RADIUS]);
    vec3.set(body.angularVelocity, 0, 0, 5);
    solveContacts(makeWorld(floorContact(body)), FIXED_DT);
    expect(body.angularVelocity[2]).toBe(5);
  });

  it('leaves the spin of a body without contacts alone', () => {
    const body = makeBody([0, 0, 0.1]);
    vec3.set(body.angularVelocity, 0, 0, 5);
    solveContacts(makeWorld(), FIXED_DT);
    expect(body.angularVelocity[2]).toBe(5);
  });
});

describe('energy loss', () => {
  it('has no viscous contact spin damping in the sources', () => {
    const files = readdirSync(new URL('../', import.meta.url), { recursive: true })
      .map((file) => String(file))
      .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source, `${file} contains CONTACT_ANGULAR_DAMPING`).not.toContain('CONTACT_ANGULAR_DAMPING');
    }
  });
});

describe('warm starting', () => {
  const NORMAL = Float64Array.from([0, 0, 1]);
  const TANGENT_Y = Float64Array.from([0, 1, 0]);
  const TANGENT_NEGATIVE_X = Float64Array.from([-1, 0, 0]);
  const POINT = Float64Array.from([0, 0, DIE_RADIUS]);

  const cachedContact = (body, normalImpulse, frictionImpulses = [0, 0]) => ({
    a: body,
    b: null,
    surface: 'floor',
    point: POINT,
    normal: { direction: NORMAL, impulse: normalImpulse },
    tangents: [
      { direction: TANGENT_Y, impulse: frictionImpulses[0] },
      { direction: TANGENT_NEGATIVE_X, impulse: frictionImpulses[1] },
    ],
  });

  const freshContact = (body, point = POINT) => ({
    a: body,
    b: null,
    surface: 'floor',
    point,
    normal: NORMAL,
  });

  it('starts a matched contact at the old normal impulse', () => {
    const body = makeBody([0, 0, DIE_RADIUS]);
    const warm = warmStartImpulses(
      [cachedContact(body, 0.02, [0.001, 0])],
      freshContact(body),
      FRICTION_FLOOR,
    );
    expect(warm.normal).toBe(0.02);
    expect(warm.tangents[0]).toBeCloseTo(0.001, 12);
    expect(warm.tangents[1]).toBeCloseTo(0, 12);
  });

  it('starts an unmatched contact at zero', () => {
    const body = makeBody([0, 0, DIE_RADIUS]);
    const far = Float64Array.from([WARM_START_DISTANCE * 2, 0, DIE_RADIUS]);
    const warm = warmStartImpulses(
      [cachedContact(body, 0.02, [0.001, 0])],
      freshContact(body, far),
      FRICTION_FLOOR,
    );
    expect(warm.normal).toBe(0);
    expect(warm.tangents[0]).toBeCloseTo(0, 12);
    expect(warm.tangents[1]).toBeCloseTo(0, 12);
  });

  it('starts at zero when the cached normal disagrees', () => {
    const body = makeBody([0, 0, DIE_RADIUS]);
    const cached = cachedContact(body, 0.02, [0.001, 0]);
    cached.normal = { direction: Float64Array.from([1, 0, 0]), impulse: 0.02 };
    const warm = warmStartImpulses([cached], freshContact(body), FRICTION_FLOOR);
    expect(warm.normal).toBe(0);
    expect(warm.tangents[0]).toBeCloseTo(0, 12);
    expect(warm.tangents[1]).toBeCloseTo(0, 12);
  });

  it('clamps the warm-started friction impulse to the friction disk', () => {
    const body = makeBody([0, 0, DIE_RADIUS]);
    const warm = warmStartImpulses(
      [cachedContact(body, 0.02, [1, 0])],
      freshContact(body),
      FRICTION_FLOOR,
    );
    nearRel(warm.tangents[0], FRICTION_FLOOR * 0.02);
    expect(warm.tangents[1]).toBeCloseTo(0, 12);
  });

  it('records the solved impulses on the world for the next step', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);
    expect(world.contactCache).toHaveLength(1);
    expect(world.contactCache[0].a).toBe(body);
    nearRel(world.contactCache[0].normal.impulse, world.events[0].impulse);
  });

  it('drops the snapshot when the step has no contacts', () => {
    const world = makeWorld();
    world.contactCache = [{}];
    solveContacts(world, FIXED_DT);
    expect(world.contactCache).toBe(null);
  });
});

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('impact impulse', () => {
  const mass = (body) => 1 / body.invMass;

  it('emits the impulse of a fresh flat drop', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -2]);
    const world = makeWorld(floorContact(body));
    solveContacts(world, FIXED_DT);
    expect(world.events).toHaveLength(1);
    nearRel(world.events[0].impulse, mass(body) * (1 + RESTITUTION_BOX) * 2, 0.01);
  });

  it('emits a near-zero impulse for a resting contact that carries the load', () => {
    // 30 m/s^2 keeps the resting approach g*dt above EVENT_MIN_SPEED, so the pair emits.
    const GRAVITY = 30;
    const body = makeBody([0, 0, DIE_RADIUS]);
    const world = makeWorld(floorContact(body, { depth: SLOP }));
    body.linearVelocity[2] -= GRAVITY * FIXED_DT;
    solveContacts(world, FIXED_DT);
    world.events.length = 0;
    body.linearVelocity[2] -= GRAVITY * FIXED_DT;
    solveContacts(world, FIXED_DT);

    const load = mass(body) * GRAVITY * FIXED_DT;
    expect(body.linearVelocity[2]).toBe(0);
    expect(world.events).toHaveLength(1);
    nearRel(world.contactCache[0].normal.impulse, load);
    expect(world.events[0].impulse).toBeLessThan(load * 1e-6);
  });

  it('emits only the new impulse for an impact on a loaded pair', () => {
    const LOAD = 5e-4;
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
    world.contactCache = [
      {
        a,
        b,
        surface: 'die',
        point: Float64Array.from([0, 0, 0]),
        normal: { direction: Float64Array.from([0, 0, 1]), impulse: LOAD },
        tangents: [
          { direction: Float64Array.from([0, 1, 0]), impulse: 0 },
          { direction: Float64Array.from([-1, 0, 0]), impulse: 0 },
        ],
      },
    ];

    solveContacts(world, FIXED_DT);

    const accumulated = world.contactCache[0].normal.impulse;
    expect(world.events).toHaveLength(1);
    nearRel(accumulated, 4.9152e-3);
    nearRel(world.events[0].impulse, accumulated - LOAD);
  });

  it('leaves the body states of a seeded run unchanged', () => {
    const random = mulberry32(63);
    const world = createWorld({ W: 0.4, H: 0.4, D: 0.4 });
    const bodies = ['d6', 'd6', 'd4'].map((type) => {
      const body = createBody(createShape(type, DIE_RADIUS), {
        position: [(random() - 0.5) * 0.1, (random() - 0.5) * 0.1, 0.1 + random() * 0.2],
      });
      vec3.set(
        body.linearVelocity,
        (random() - 0.5) * 0.5,
        (random() - 0.5) * 0.5,
        -1 - random(),
      );
      world.addBody(body);
      return body;
    });
    const expected = [
      [-0.064854969305141549, -0.090088088215029713, 0.0084669620230561349, 0.13975270813722962, -0.018083670637639403, -0.068998022837437542],
      [-0.042477726409306193, -0.013400587454831484, 0.0083433351392860396, 0.12091551109257789, -0.16156909091036672, -0.085581280375165408],
      [-0.085615861083748579, 0.065907222477889993, 0.0068454909408890673, -0.064207073574464424, 0.15445539940612971, 0.054507525284815603],
    ];

    const steps = Math.round(0.5 / FIXED_DT);
    for (let step = 0; step < steps; step += 1) world.step(FIXED_DT);

    bodies.forEach((body, index) => {
      const state = [...body.position, ...body.linearVelocity];
      state.forEach((value, axis) => nearRel(value, expected[index][axis], 1e-12));
    });
  });
});

describe('impact events', () => {
  it('pushes one event per pair and step with the summed normal impulse', () => {
    const body = makeBody([0, 0, 0.01], [0, 0, -1]);
    const corner = (x) =>
      floorContact(body, { point: [x, 0, DIE_RADIUS], depth: 0 });
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
    const body = makeBody([0, 0, DIE_RADIUS]);
    const world = makeWorld(floorContact(body, { depth: SLOP }));
    solveContacts(world, FIXED_DT);
    expect(world.events).toEqual([]);
  });
});
