import * as vec3 from '../math/vec3.js';
import { detectContacts } from './collision.js';
import { BEVEL_RADIUS } from './body.js';
import { integratePositions, integrateVelocities } from './integrator.js';
import { solveContacts, RESTITUTION_BOX, RESTITUTION_THRESHOLD } from './contacts.js';

export const FIXED_DT = 1 / 480;

export const MAX_STEPS = 16;

export const MAX_FRAME_DT = 0.1;

export const SLEEP_SPEED = 0.01;

export const SLEEP_TIME = 0.5;

export const WAKE_GRAVITY_DELTA = 0.5;

// Fastest point speed of a body: linear speed plus the spin of its farthest point.
function pointSpeed(body) {
  return vec3.length(body.linearVelocity) + body.radius * vec3.length(body.angularVelocity);
}

function fastestPoint(bodies) {
  let fastest = 0;
  for (const body of bodies) fastest = Math.max(fastest, pointSpeed(body));
  return fastest;
}

function moving(bodies) {
  for (const body of bodies) {
    if (vec3.length(body.linearVelocity) > 0 || vec3.length(body.angularVelocity) > 0) return true;
  }
  return false;
}

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

const scratchPoint = new Float64Array(3);
const scratchPush = new Float64Array(3);

// Per-vertex projection on the core polyhedron: holding every core vertex a bevel
// radius inside each wall keeps the rounded surface inside, while a face may rest flush.
function containBody(box, body) {
  const vertices = body.shape?.coreVertices;
  if (!vertices) return;
  const r = BEVEL_RADIUS;
  let underX = 0;
  let overX = 0;
  let underY = 0;
  let overY = 0;
  let underZ = 0;
  let overZ = 0;
  for (const vertex of vertices) {
    const point = vec3.add(
      scratchPoint,
      vec3.transformQuat(scratchPoint, vertex, body.orientation),
      body.position,
    );
    underX = Math.max(underX, -box.W / 2 + r - point[0]);
    overX = Math.max(overX, point[0] - box.W / 2 + r);
    underY = Math.max(underY, -box.H / 2 + r - point[1]);
    overY = Math.max(overY, point[1] - box.H / 2 + r);
    underZ = Math.max(underZ, r - point[2]);
    overZ = Math.max(overZ, point[2] - box.D + r);
  }
  const push = vec3.set(scratchPush, underX - overX, underY - overY, underZ - overZ);
  if (push[0] === 0 && push[1] === 0 && push[2] === 0) return;
  vec3.add(body.position, body.position, push);
  for (let axis = 0; axis < 3; axis += 1) {
    if (push[axis] === 0) continue;
    const into = push[axis] > 0 ? -1 : 1;
    const speed = body.linearVelocity[axis] * into;
    if (speed <= 0) continue;
    // A wall is elastic like the floor and the lid: it reflects the incoming speed.
    body.linearVelocity[axis] = speed < RESTITUTION_THRESHOLD ? 0 : -into * RESTITUTION_BOX * speed;
  }
}

export function createWorld({ W, H, D }) {
  let accumulator = 0;
  let asleep = false;
  let stillTime = 0;
  const sleepGravity = new Float64Array(3);

  const wake = () => {
    asleep = false;
    stillTime = 0;
  };

  const sleep = () => {
    asleep = true;
    stillTime = 0;
    vec3.copy(sleepGravity, world.gravity);
    // Impulses cached before the sleep describe a motion that no longer exists.
    world.contactCache = null;
    for (const body of world.bodies) {
      vec3.set(body.linearVelocity, 0, 0, 0);
      vec3.set(body.angularVelocity, 0, 0, 0);
    }
  };

  const world = {
    bodies: [],
    gravity: Float64Array.from([0, 0, -9.81]),
    box: { W, H, D },
    contacts: [],
    events: [],
    soundSteps: [],
    simTime: 0,
    beforeStep: null,
    get asleep() {
      return asleep;
    },
    wake,
    addBody(body) {
      world.bodies.push(body);
      wake();
      return body;
    },
    removeBody(body) {
      const index = world.bodies.indexOf(body);
      if (index !== -1) world.bodies.splice(index, 1);
      wake();
      return body;
    },
    setGravity(gravity) {
      vec3.copy(world.gravity, gravity);
      if (asleep && vec3.distance(world.gravity, sleepGravity) > WAKE_GRAVITY_DELTA) wake();
    },
    setBox(box) {
      // A viewport can report 0x0 for one event; that box cannot hold a body and would crush it.
      if (!(box.W > 0 && box.H > 0 && box.D > 0)) return;
      Object.assign(world.box, box);
      for (const body of world.bodies) clampIntoBox(world.box, body);
      wake();
    },
    step(dt) {
      // The drive still runs while asleep: it is the only in-scope signal that a die is held.
      if (world.beforeStep) world.beforeStep(dt);
      if (asleep) {
        if (!moving(world.bodies)) return;
        wake();
      }
      const time = world.simTime + dt;
      integrateVelocities(world.bodies, world.gravity, dt);
      detectContacts(world, dt);
      solveContacts(world, dt, time);
      integratePositions(world.bodies, dt);
      for (const body of world.bodies) containBody(world.box, body);
      world.simTime = time;
      if (fastestPoint(world.bodies) < SLEEP_SPEED) {
        stillTime += dt;
        if (stillTime >= SLEEP_TIME) sleep();
      } else {
        stillTime = 0;
      }
    },
    update(frameDt) {
      world.events.length = 0;
      world.soundSteps.length = 0;
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
