import * as vec3 from '../math/vec3.js';
import { integratePositions, integrateVelocities } from './integrator.js';
import { solveContacts } from './contacts.js';

export const FIXED_DT = 1 / 480;

export const MAX_STEPS = 16;

export const MAX_FRAME_DT = 0.1;

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

function clampIntoBox(box, body) {
  const r = body.radius;
  const target = vec3.set(
    new Float64Array(3),
    clamp(body.position[0], -box.W / 2 + r, box.W / 2 - r),
    clamp(body.position[1], -box.H / 2 + r, box.H / 2 - r),
    clamp(body.position[2], r, box.D - r),
  );
  if (vec3.distance(target, body.position) === 0) return;
  vec3.copy(body.position, target);
  vec3.set(body.linearVelocity, 0, 0, 0);
  vec3.set(body.angularVelocity, 0, 0, 0);
}

export function createWorld({ W, H, D }) {
  let accumulator = 0;
  const world = {
    bodies: [],
    gravity: Float64Array.from([0, 0, -9.81]),
    box: { W, H, D },
    events: [],
    addBody(body) {
      world.bodies.push(body);
      return body;
    },
    removeBody(body) {
      const index = world.bodies.indexOf(body);
      if (index !== -1) world.bodies.splice(index, 1);
      return body;
    },
    setGravity(gravity) {
      vec3.copy(world.gravity, gravity);
    },
    setBox(box) {
      Object.assign(world.box, box);
      for (const body of world.bodies) clampIntoBox(world.box, body);
    },
    step(dt) {
      integrateVelocities(world.bodies, world.gravity, dt);
      solveContacts(world, dt);
      integratePositions(world.bodies, dt);
    },
    update(frameDt) {
      world.events.length = 0;
      accumulator += Math.min(frameDt, MAX_FRAME_DT);
      let steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
        world.step(FIXED_DT);
        accumulator -= FIXED_DT;
        steps += 1;
      }
      // Drop the remainder after a long stall so the world does not spiral.
      if (steps === MAX_STEPS) accumulator = 0;
    },
  };
  return world;
}
