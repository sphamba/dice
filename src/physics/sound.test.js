import { describe, expect, it } from 'vitest';
import { boxFromViewport } from './box.js';
import { DIE_RADIUS, createBody } from './body.js';
import { createShape } from '../dice/shapes.js';
import { FIXED_DT, createWorld } from './world.js';
import {
  ROLL_RISE_MAX,
  ROLL_RISE_MIN,
  ROLL_SPEED_MAX,
  ROLL_SPEED_MIN,
  ROLL_SPIN_MAX,
  ROLL_SPIN_MIN,
  rollVelocity,
} from './roll.js';
import * as vec3 from '../math/vec3.js';

const BOX = boxFromViewport(393, 852, 3);

const FRAME_DT = 1 / 60;

const SURFACES = ['die', 'floor', 'wall', 'lid'];

const SOUND_SEEDS = [20240901, 11, 42, 777, 1301, 88, 5150, 60607, 3, 91, 2024, 65535];

const SOUND_FRAMES = 120;

const vec = () => new Float64Array(3);

const randomRange = (min, max, random) => min + random() * (max - min);

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

function randomAxis(out, random) {
  return vec3.normalize(out, vec3.set(out, random() - 0.5, random() - 0.5, random() - 0.5));
}

function rolledWorld(seed) {
  const random = mulberry32(seed);
  const world = createWorld(BOX);
  for (let index = 0; index < 2; index += 1) {
    world.addBody(
      createBody(createShape('d6', DIE_RADIUS), {
        position: [(index - 0.5) * BOX.W * 0.5, 0, BOX.D * 0.6],
        orientation: randomQuat(random),
      }),
    );
  }
  for (let step = 0; step < Math.round(3 / FIXED_DT); step += 1) world.step(FIXED_DT);
  for (const body of world.bodies) {
    rollVelocity(body.linearVelocity, {
      box: world.box,
      gravity: world.gravity,
      position: body.position,
      angle: random() * 2 * Math.PI,
      speed: randomRange(ROLL_SPEED_MIN, ROLL_SPEED_MAX, random),
      rise: randomRange(ROLL_RISE_MIN, ROLL_RISE_MAX, random),
    });
    vec3.scale(
      body.angularVelocity,
      randomAxis(vec(), random),
      randomRange(ROLL_SPIN_MIN, ROLL_SPIN_MAX, random),
    );
  }
  return world;
}

describe('sound stream', () => {
  for (const seed of SOUND_SEEDS) {
    it(`exports finite non-negative hits on a rising step clock for seed ${seed}`, () => {
      const world = rolledWorld(seed);
      let hits = 0;
      let lastTime = -Infinity;
      const distinctTimes = new Set();
      for (let frame = 0; frame < SOUND_FRAMES; frame += 1) {
        world.update(FRAME_DT);
        const records = world.soundSteps;
        for (const record of records) {
          for (const field of ['t', 'px', 'py', 'pz', 'normal', 'friction', 'slip']) {
            expect(Number.isFinite(record[field]), `${field} of seed ${seed} hit`).toBe(true);
          }
          expect(SURFACES).toContain(record.surface);
          expect(record.a).toBeTruthy();
          expect(record.normal).toBeGreaterThanOrEqual(0);
          expect(record.friction).toBeGreaterThanOrEqual(0);
          expect(record.slip).toBeGreaterThanOrEqual(0);
          if (record.t !== lastTime) {
            expect(record.t).toBeGreaterThan(lastTime);
            lastTime = record.t;
            distinctTimes.add(record.t);
          }
          hits += 1;
        }
        records.length = 0;
        expect(records).toHaveLength(0);
      }
      expect(hits).toBeGreaterThan(0);
      expect(distinctTimes.size).toBeGreaterThan(1);
    }, 60000);
  }

  it('keeps the stream empty after a drain until the next update', () => {
    const world = rolledWorld(SOUND_SEEDS[0]);
    let refilled = 0;
    for (let frame = 0; frame < SOUND_FRAMES && refilled < 3; frame += 1) {
      world.update(FRAME_DT);
      if (world.soundSteps.length === 0) continue;
      world.soundSteps.length = 0;
      expect(world.soundSteps).toHaveLength(0);
      refilled += 1;
    }
    expect(refilled).toBe(3);
  }, 60000);

  it('exports a contact point, two body refs and a surface per hit', () => {
    const world = rolledWorld(SOUND_SEEDS[1]);
    let sawBodyBox = false;
    let sawDieDie = false;
    for (let frame = 0; frame < SOUND_FRAMES; frame += 1) {
      world.update(FRAME_DT);
      for (const record of world.soundSteps) {
        expect(world.bodies).toContain(record.a);
        if (record.b === null) {
          expect(record.surface).not.toBe('die');
          sawBodyBox = true;
        } else {
          expect(world.bodies).toContain(record.b);
          expect(record.surface).toBe('die');
          sawDieDie = true;
        }
        const depth = vec3.distance(
          vec3.set(vec(), record.px, record.py, record.pz),
          record.a.position,
        );
        expect(depth).toBeLessThanOrEqual(record.a.radius * 2);
      }
      world.soundSteps.length = 0;
    }
    expect(sawBodyBox || sawDieDie).toBe(true);
  }, 60000);

  it('leaves poses and events identical with and without a drain', () => {
    const drained = rolledWorld(SOUND_SEEDS[2]);
    const kept = rolledWorld(SOUND_SEEDS[2]);
    for (let frame = 0; frame < SOUND_FRAMES; frame += 1) {
      drained.update(FRAME_DT);
      kept.update(FRAME_DT);
      expect(drained.events).toEqual(kept.events);
      for (let index = 0; index < drained.bodies.length; index += 1) {
        expect(drained.bodies[index].position).toEqual(kept.bodies[index].position);
        expect(drained.bodies[index].orientation).toEqual(kept.bodies[index].orientation);
        expect(drained.bodies[index].linearVelocity).toEqual(kept.bodies[index].linearVelocity);
        expect(drained.bodies[index].angularVelocity).toEqual(kept.bodies[index].angularVelocity);
      }
      drained.soundSteps.length = 0;
    }
  }, 60000);
});
