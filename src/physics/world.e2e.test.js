import { describe, expect, it } from 'vitest';
import { boxFromViewport } from './box.js';
import { DIE_RADIUS, createBody } from './body.js';
import { DICE_TYPES, createShape } from '../dice/shapes.js';
import { FIXED_DT, createWorld } from './world.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

const BOX = boxFromViewport(393, 852, 3);

const GRAVITY = 9.81;

const STEPS_PER_SECOND = Math.round(1 / FIXED_DT);

const vec = () => new Float64Array(3);

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomQuat(random) {
  const u1 = random();
  const u2 = random();
  const u3 = random();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  return [
    s1 * Math.sin(2 * Math.PI * u2),
    s1 * Math.cos(2 * Math.PI * u2),
    s2 * Math.sin(2 * Math.PI * u3),
    s2 * Math.cos(2 * Math.PI * u3),
  ];
}

function randomUnit(out, random) {
  return quat.normalize(out, Float64Array.from([random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5]));
}

const scratchVertex = vec();

function worldVertex(body, vertex) {
  return vec3.add(
    scratchVertex,
    vec3.transformQuat(scratchVertex, vertex, body.orientation),
    body.position,
  );
}

function lowestVertex(body) {
  let low = Infinity;
  for (const vertex of body.shape.vertices) low = Math.min(low, worldVertex(body, vertex)[2]);
  return low;
}

function deepestFaceAgainstFloor(body) {
  let best = -Infinity;
  for (const face of body.shape.faces) {
    const normal = vec3.transformQuat(vec(), face.normal, body.orientation);
    best = Math.max(best, -normal[2]);
  }
  return best;
}

function boxOvershoot(box, body) {
  let worst = 0;
  for (const local of body.shape.vertices) {
    const vertex = worldVertex(body, local);
    worst = Math.max(
      worst,
      -vertex[0] - box.W / 2,
      vertex[0] - box.W / 2,
      -vertex[1] - box.H / 2,
      vertex[1] - box.H / 2,
      -vertex[2],
      vertex[2] - box.D,
    );
  }
  return worst;
}

function dropBody(type, position = [0, 0, BOX.D / 2], orientation = [0, 0, 0, 1]) {
  return createBody(createShape(type, DIE_RADIUS), { position, orientation });
}

describe('settling', () => {
  for (const type of DICE_TYPES) {
    it(`settles ${type} flat on a face within 5 s`, () => {
      const random = mulberry32(20240501);
      const world = createWorld(BOX);
      const body = dropBody(type, [0, 0, BOX.D / 2], randomQuat(random));
      world.addBody(body);

      for (let step = 0; step < 5 * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);

      expect(vec3.length(body.linearVelocity)).toBeLessThan(0.005);
      expect(vec3.length(body.angularVelocity)).toBeLessThan(0.1);
      expect(Math.abs(lowestVertex(body))).toBeLessThan(0.0005);
      expect(deepestFaceAgainstFloor(body)).toBeGreaterThan(0.99);
    });
  }
});

describe('containment', () => {
  it('keeps every vertex of ten dice inside the box under random gravity', () => {
    const random = mulberry32(770311);
    const world = createWorld(BOX);
    const bodies = [];
    for (let index = 0; index < 10; index += 1) {
      const body = dropBody(DICE_TYPES[index % DICE_TYPES.length], [
        (random() - 0.5) * (BOX.W - 2 * DIE_RADIUS) * 0.9,
        (random() - 0.5) * (BOX.H - 2 * DIE_RADIUS) * 0.9,
        DIE_RADIUS + random() * (BOX.D - 2 * DIE_RADIUS),
      ], randomQuat(random));
      vec3.set(
        body.linearVelocity,
        (random() - 0.5) * 2 * 3,
        (random() - 0.5) * 2 * 3,
        (random() - 0.5) * 2 * 3,
      );
      vec3.set(
        body.angularVelocity,
        (random() - 0.5) * 2 * 60,
        (random() - 0.5) * 2 * 60,
        (random() - 0.5) * 2 * 60,
      );
      world.addBody(body);
      bodies.push(body);
    }

    const gravity = vec();
    const tilt = quat.create();
    let worst = 0;
    const steps = 10 * STEPS_PER_SECOND;
    for (let step = 0; step < steps; step += 1) {
      if (step % Math.round(0.2 / FIXED_DT) === 0) {
        randomUnit(tilt, random);
        vec3.scale(gravity, vec3.transformQuat(gravity, [0, 0, -1], tilt), random() * 4 * GRAVITY);
        world.setGravity(gravity);
      }
      world.step(FIXED_DT);
      for (const body of bodies) worst = Math.max(worst, boxOvershoot(BOX, body));
    }
    expect(worst).toBeLessThan(0.001);
  }, 30000);
});

describe('mixed dice', () => {
  it('settles three dice on a level floor with a finite state', () => {
    const types = ['d6', 'd8', 'd20'];
    const world = createWorld(BOX);
    const bodies = types.map((type, index) =>
      dropBody(type, [0, (index - 1) * BOX.H * 0.3, BOX.D * 0.4 + index * 0.004]),
    );
    for (const body of bodies) world.addBody(body);

    for (let step = 0; step < 5 * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);

    for (const body of bodies) {
      expect(Number.isFinite(vec3.length(body.linearVelocity))).toBe(true);
      expect(Number.isFinite(vec3.length(body.angularVelocity))).toBe(true);
      expect(vec3.length(body.linearVelocity)).toBeLessThan(0.005);
      expect(vec3.length(body.angularVelocity)).toBeLessThan(0.1);
      expect(Math.abs(lowestVertex(body))).toBeLessThan(0.0005);
      expect(boxOvershoot(BOX, body)).toBeLessThan(0.001);
    }
  }, 30000);
});

describe('tilted gravity', () => {
  it('slides a settled die down a 10 degree tilt and stays contained', () => {
    const world = createWorld({ W: 0.5, H: 0.5, D: 0.2 });
    const body = dropBody('d6', [0, 0, 0.05]);
    world.addBody(body);

    for (let step = 0; step < 3 * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);
    const startX = body.position[0];

    const radians = (10 * Math.PI) / 180;
    world.setGravity([GRAVITY * Math.sin(radians), 0, -GRAVITY * Math.cos(radians)]);
    for (let step = 0; step < 0.5 * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);

    expect(body.position[0] - startX).toBeGreaterThan(0.02);
    expect(boxOvershoot(world.box, body)).toBeLessThan(0.001);
    expect(Number.isFinite(vec3.length(body.linearVelocity))).toBe(true);
  }, 30000);
});

describe('die against die', () => {
  it('lets two stacked d6 rest without mutual penetration', () => {
    const world = createWorld(BOX);
    const lower = dropBody('d6', [0, 0, BOX.D / 2 - 0.02]);
    const upper = dropBody('d6', [0, 0, BOX.D / 2 + 0.02]);
    world.addBody(lower);
    world.addBody(upper);

    for (let step = 0; step < 5 * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);

    const depths = world.contacts.filter((contact) => contact.surface === 'die').map((contact) => contact.depth);
    expect(depths.length).toBeGreaterThan(0);
    expect(Math.max(...depths)).toBeLessThan(0.0005);
  });
});

describe('floor events', () => {
  it('reports the impact speed once and stays silent at rest', () => {
    const world = createWorld(BOX);
    const body = dropBody('d6');
    world.addBody(body);
    const dropHeight = lowestVertex(body);
    const expected = Math.sqrt(2 * GRAVITY * dropHeight);

    const impacts = [];
    const steps = 5 * STEPS_PER_SECOND;
    for (let step = 0; step < steps; step += 1) {
      world.events.length = 0;
      world.step(FIXED_DT);
      for (const event of world.events) {
        if (event.surface === 'floor') impacts.push({ step, speed: event.speed });
      }
    }

    expect(impacts.length).toBeGreaterThan(0);
    expect(Math.abs(impacts[0].speed - expected) / expected).toBeLessThan(0.2);
    expect(impacts.filter((impact) => impact.step > STEPS_PER_SECOND)).toEqual([]);
  });
});

describe('energy', () => {
  it('never lifts a dropped die above its drop height', () => {
    const world = createWorld(BOX);
    const body = dropBody('d6');
    world.addBody(body);
    const dropHeight = lowestVertex(body);

    let peak = -Infinity;
    let touched = false;
    for (let step = 0; step < 3 * STEPS_PER_SECOND; step += 1) {
      world.step(FIXED_DT);
      const low = lowestVertex(body);
      if (low < 0.0005) touched = true;
      if (touched) peak = Math.max(peak, low);
    }

    expect(touched).toBe(true);
    expect(peak).toBeLessThanOrEqual(dropHeight);
  });
});
