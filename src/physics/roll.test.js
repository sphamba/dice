import { describe, expect, it } from 'vitest';
import { boxFromViewport } from './box.js';
import { DIE_RADIUS, createBody } from './body.js';
import { createShape } from '../dice/shapes.js';
import { FIXED_DT, createWorld } from './world.js';
import {
  ROLL_RISE_MAX,
  ROLL_SPEED_MAX,
  ROLL_SPIN_MAX,
  headroom,
  liftSpeed,
  rollVelocity,
} from './roll.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

const BOXES = [
  ['desktop', boxFromViewport(1280, 800, 1)],
  ['phone', boxFromViewport(393, 852, 3)],
];

const GRAVITY = Float64Array.from([0, 0, -9.81]);

const NO_GRAVITY = Float64Array.from([0, 0, 0]);

const STEPS_PER_SECOND = Math.round(1 / FIXED_DT);

const SETTLE_SECONDS = 3;

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

function exactVertices(body) {
  return body.shape.vertices.map((vertex) =>
    vec3.add(vec(), vec3.transformQuat(vec(), vertex, body.orientation), body.position),
  );
}

const lowestVertex = (body) => Math.min(...exactVertices(body).map((point) => point[2]));

const highestVertex = (body) => Math.max(...exactVertices(body).map((point) => point[2]));

function spin(body, random) {
  const axis = vec3.set(vec(), random() - 0.5, random() - 0.5, random() - 0.5);
  vec3.scale(body.angularVelocity, vec3.normalize(axis, axis), ROLL_SPIN_MAX);
}

function toss(world, body, random, angle) {
  rollVelocity(body.linearVelocity, {
    box: world.box,
    gravity: world.gravity,
    position: body.position,
    angle,
    speed: ROLL_SPEED_MAX,
    rise: ROLL_RISE_MAX,
  });
  spin(body, random);
}

describe('liftSpeed', () => {
  it('turns a fraction of the headroom under the lid into an ascent speed', () => {
    const up = Float64Array.from([0, 0, 1]);
    const [, box] = BOXES[0];
    const rest = Float64Array.from([0, 0, DIE_RADIUS]);
    expect(headroom(box, rest, up)).toBeCloseTo(box.D - 2 * DIE_RADIUS, 12);
    expect(liftSpeed(box, GRAVITY, rest, ROLL_RISE_MAX)).toBeCloseTo(
      Math.sqrt(2 * 9.81 * ROLL_RISE_MAX * (box.D - 2 * DIE_RADIUS)),
      12,
    );
    expect(liftSpeed(box, NO_GRAVITY, rest, ROLL_RISE_MAX)).toBe(0);
  });

  it('gives no lift when the headroom is zero or negative', () => {
    const up = Float64Array.from([0, 0, 1]);
    const [, box] = BOXES[0];
    const atLid = Float64Array.from([0, 0, box.D - DIE_RADIUS]);
    expect(headroom(box, atLid, up)).toBeCloseTo(0, 12);
    expect(liftSpeed(box, GRAVITY, atLid, ROLL_RISE_MAX)).toBeCloseTo(0, 12);
    const pastLid = Float64Array.from([0, 0, box.D]);
    expect(headroom(box, pastLid, up)).toBe(0);
    expect(liftSpeed(box, GRAVITY, pastLid, ROLL_RISE_MAX)).toBe(0);
  });
});

describe.each(BOXES)('roll toss on the %s box', (name, box) => {
  it('tosses the die high without touching the lid, then settles it on the floor', () => {
    const up = Float64Array.from([0, 0, 1]);
    const rises = [];
    for (let index = 0; index < 8; index += 1) {
      const random = mulberry32(424242 + index);
      const world = createWorld(box);
      const body = createBody(createShape('d6', DIE_RADIUS), {
        position: [0, 0, box.D / 2],
        orientation: quat.random(new Float64Array(4), random),
      });
      world.addBody(body);
      for (let step = 0; step < SETTLE_SECONDS * STEPS_PER_SECOND; step += 1) world.step(FIXED_DT);

      const rest = body.position[2];
      const available = headroom(box, body.position, up);
      toss(world, body, random, (2 * Math.PI * index) / 8);

      let lidSteps = 0;
      let apex = -Infinity;
      let highest = -Infinity;
      for (let step = 0; step < SETTLE_SECONDS * STEPS_PER_SECOND; step += 1) {
        world.step(FIXED_DT);
        if (world.contacts.some((contact) => contact.surface === 'lid')) lidSteps += 1;
        apex = Math.max(apex, body.position[2]);
        highest = Math.max(highest, highestVertex(body));
      }

      expect(lidSteps).toBe(0);
      expect(highest).toBeLessThan(box.D);
      rises.push((apex - rest) / available);
      expect(Math.abs(lowestVertex(body))).toBeLessThan(0.0005);
      expect(vec3.length(body.linearVelocity)).toBeLessThan(0.005);
      expect(vec3.length(body.angularVelocity)).toBeLessThan(0.1);
    }
    expect(rises.reduce((sum, rise) => sum + rise, 0) / rises.length).toBeGreaterThan(0.5);
  });
});
