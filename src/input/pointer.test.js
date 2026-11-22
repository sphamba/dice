import { describe, expect, it } from 'vitest';
import {
  FLING_WINDOW_MS,
  MAX_DRAG_SPEED,
  MAX_FLING_SPEED,
  createPointer,
  flingVelocity,
} from './pointer.js';
import { createWorld } from '../physics/world.js';
import { DIE_RADIUS, createBody } from '../physics/body.js';
import { DICE_TYPES, createShape } from '../dice/shapes.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

const near = (actual, expected, eps = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThan(eps);

const BOX = { W: 0.0681, H: 0.1476, D: 0.0681 };

// Circumradius over root three: the d6 face is a square of this half-edge at this height.
const FACE_HALF = DIE_RADIUS / Math.sqrt(3);

const toWorld = (px, py) => [px * 0.001, py * 0.001];

// Samples carry CSS-independent world x/y and a timeStamp in milliseconds, oldest first.
describe('flingVelocity', () => {
  it('returns the speed of a constant motion in world units per second', () => {
    const velocity = flingVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 20, x: 0.02, y: 0.01 },
      { t: 40, x: 0.04, y: 0.02 },
    ]);
    near(velocity[0], 1);
    near(velocity[1], 0.5);
    near(velocity[2], 0);
  });

  it('clamps the speed to MAX_FLING_SPEED and keeps the direction', () => {
    const velocity = flingVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 16, x: 0.5, y: -0.5 },
    ]);
    const speed = Math.hypot(velocity[0], velocity[1]);
    near(speed, MAX_FLING_SPEED, 1e-9);
    near(velocity[0], MAX_FLING_SPEED / Math.SQRT2, 1e-9);
    near(velocity[1], -MAX_FLING_SPEED / Math.SQRT2, 1e-9);
  });

  it('ignores samples older than the fling window', () => {
    const velocity = flingVelocity([
      { t: 0, x: 0, y: 0 },
      { t: 10, x: 5, y: 5 },
      { t: 1000, x: 0, y: 0 },
      { t: 1040, x: 0.02, y: 0 },
    ]);
    expect(1040 - 1000).toBeLessThanOrEqual(FLING_WINDOW_MS);
    near(velocity[0], 0.5);
    near(velocity[1], 0);
  });

  it('returns zero without a usable time span', () => {
    expect(Array.from(flingVelocity([]))).toEqual([0, 0, 0]);
    expect(Array.from(flingVelocity([{ t: 5, x: 1, y: 1 }]))).toEqual([0, 0, 0]);
    expect(Array.from(flingVelocity([{ t: 5, x: 0, y: 0 }, { t: 5, x: 1, y: 1 }]))).toEqual([
      0, 0, 0,
    ]);
  });
});

function fakeCanvas() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture() {},
    hasPointerCapture: () => false,
    releasePointerCapture() {},
    fire: (type, event) => listeners.get(type)(event),
  };
}

function makeDie({
  type = 'd6',
  position = [0, 0, 0.03],
  orientation = [0, 0, 0, 1],
  radius = DIE_RADIUS,
} = {}) {
  return createBody(createShape(type, radius), { position, orientation });
}

function scene(bodies) {
  const canvas = fakeCanvas();
  const world = createWorld(BOX);
  for (const body of bodies) world.addBody(body);
  const pointer = createPointer(canvas, { world, toWorld });
  return { world, body: bodies[0], canvas, pointer };
}

const holdHeight = (body) => BOX.D - 2 * body.radius;

const pressWorld = (canvas, pointerId, x, y, t = 0) =>
  canvas.fire('pointerdown', { pointerId, clientX: x / 0.001, clientY: y / 0.001, timeStamp: t });

const moveWorld = (canvas, pointerId, x, y, t) =>
  canvas.fire('pointermove', { pointerId, clientX: x / 0.001, clientY: y / 0.001, timeStamp: t });

function run(world, fps, seconds) {
  const frames = Math.round(seconds * fps);
  for (let frame = 0; frame < frames; frame += 1) world.update(1 / fps);
}

// The grabbed material point: the world lever from the center, the point itself, the spin.
function grabbedPoint(body, offset) {
  const lever = vec3.transformQuat(new Float64Array(3), offset, body.orientation);
  return {
    lever,
    point: vec3.add(new Float64Array(3), body.position, lever),
    spin: Math.hypot(...body.angularVelocity),
  };
}

// The topmost vertex of a die is on the upper surface, so a press at its user-space xy picks it.
const topVertex = (shape) => shape.vertices.reduce((best, v) => (v[2] > best[2] ? v : best));

describe('face picking', () => {
  it('keeps a tilted grab anchored to the pressed material point', () => {
    const orientation = quat.setAxisAngle(new Float64Array(4), [1, 0, 0], 0.6);
    const body = makeDie({ orientation });
    const grabbed = [FACE_HALF * 0.55, FACE_HALF * 0.3, FACE_HALF];
    const worldPoint = vec3.add(
      new Float64Array(3),
      vec3.transformQuat(new Float64Array(3), grabbed, orientation),
      body.position,
    );
    const { world, canvas, pointer } = scene([body]);
    pressWorld(canvas, 1, worldPoint[0], worldPoint[1]);
    expect(pointer.heldBodies()).toEqual([body]);
    run(world, 60, 1.5);
    const { point } = grabbedPoint(body, grabbed);
    expect(Math.hypot(point[0] - worldPoint[0], point[1] - worldPoint[1])).toBeLessThan(0.001);
    expect(Math.abs(point[2] - holdHeight(body))).toBeLessThan(0.001);
  });

  it('holds nothing for a press inside the bounding circle but outside the face', () => {
    const body = makeDie();
    const { canvas, pointer } = scene([body]);
    pressWorld(canvas, 1, FACE_HALF * 1.4, 0);
    expect(pointer.heldBodies()).toEqual([]);
  });

  it('holds the die with the nearest surface, not the highest center', () => {
    const high = makeDie({ position: [0, 0, 0.03], radius: 0.005 });
    const wide = makeDie({ position: [0, 0, 0.025], radius: 0.02 });
    const { canvas, pointer } = scene([high, wide]);
    pressWorld(canvas, 1, 0, 0);
    expect(pointer.heldBodies()).toEqual([wide]);
  });
});

describe('hanging', () => {
  it('hangs every die type with its center directly below the grabbed vertex', () => {
    for (const type of DICE_TYPES) {
      const grabbed = topVertex(createShape(type, DIE_RADIUS));
      const body = makeDie({ type });
      const { world, canvas } = scene([body]);
      pressWorld(canvas, 1, grabbed[0], grabbed[1]);
      run(world, 60, 1.5);
      const { lever, point, spin } = grabbedPoint(body, grabbed);
      expect(Math.hypot(lever[0], lever[1]), type).toBeLessThan(0.001);
      expect(Math.hypot(point[0] - grabbed[0], point[1] - grabbed[1]), type).toBeLessThan(0.001);
      expect(Math.abs(point[2] - holdHeight(body)), type).toBeLessThan(0.001);
      expect(spin, type).toBeLessThan(0.1);
    }
  });

  it('swings after a sudden pointer move and calms within 1.5 s', () => {
    const body = makeDie();
    const grabbed = [0, 0, FACE_HALF];
    const { world, canvas } = scene([body]);
    pressWorld(canvas, 1, 0, 0);
    run(world, 60, 1.5);
    // The tall axis: 20 mm of swing room, farther than the die reaches from any wall.
    moveWorld(canvas, 1, 0, 0.02, 2000);
    let previous = 0;
    let crossings = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      world.update(1 / 60);
      const offsetY = -grabbedPoint(body, grabbed).lever[1];
      if (previous !== 0 && offsetY !== 0 && Math.sign(offsetY) !== Math.sign(previous)) {
        crossings += 1;
      }
      previous = offsetY;
    }
    expect(crossings).toBeGreaterThanOrEqual(1);
    const { lever, point, spin } = grabbedPoint(body, grabbed);
    expect(Math.hypot(lever[0], lever[1])).toBeLessThan(0.001);
    expect(Math.hypot(point[0], point[1] - 0.02)).toBeLessThan(0.001);
    expect(Math.abs(point[2] - holdHeight(body))).toBeLessThan(0.001);
    expect(spin).toBeLessThan(0.1);
  });

  it('calms a spun held die without collisions', () => {
    const body = makeDie();
    const grabbed = [0, 0, FACE_HALF];
    const { world, canvas } = scene([body]);
    pressWorld(canvas, 1, 0, 0);
    vec3.set(body.angularVelocity, 20, 0, 30);
    run(world, 60, 1.5);
    const { lever, point, spin } = grabbedPoint(body, grabbed);
    expect(spin).toBeLessThan(0.1);
    expect(Math.hypot(lever[0], lever[1])).toBeLessThan(0.001);
    expect(Math.hypot(point[0], point[1])).toBeLessThan(0.001);
  });

  it('settles the grab point at 30, 60 and 144 fps', () => {
    for (const fps of [30, 60, 144]) {
      const body = makeDie();
      const { world, canvas } = scene([body]);
      const grabbed = [FACE_HALF * 0.55, FACE_HALF * 0.3, FACE_HALF];
      pressWorld(canvas, 1, grabbed[0], grabbed[1]);
      run(world, fps, 1.5);
      const { lever, point, spin } = grabbedPoint(body, grabbed);
      expect(Math.hypot(lever[0], lever[1]), `${fps} fps`).toBeLessThan(0.001);
      expect(Math.hypot(point[0] - grabbed[0], point[1] - grabbed[1]), `${fps} fps`).toBeLessThan(
        0.001,
      );
      expect(Math.abs(point[2] - holdHeight(body)), `${fps} fps`).toBeLessThan(0.001);
      expect(spin, `${fps} fps`).toBeLessThan(0.1);
    }
  });

  it('tracks a pointer jump within the drag speed without overshoot at every frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const body = makeDie();
      const { world, canvas } = scene([body]);
      const grabbed = [0, 0, FACE_HALF];
      pressWorld(canvas, 1, 0, 0);
      run(world, fps, 1.5);
      moveWorld(canvas, 1, 0.02, 0, 4000);
      let peak = 0;
      let peakSpeed = 0;
      for (let frame = 0; frame < fps / 2; frame += 1) {
        world.update(1 / fps);
        const { lever, point } = grabbedPoint(body, grabbed);
        const velocity = vec3.add(
          new Float64Array(3),
          body.linearVelocity,
          vec3.cross(new Float64Array(3), body.angularVelocity, lever),
        );
        peak = Math.max(peak, point[0] - 0.02);
        peakSpeed = Math.max(peakSpeed, Math.hypot(velocity[0], velocity[1]));
      }
      expect(peak, `${fps} fps`).toBeLessThan(0.002);
      expect(peakSpeed, `${fps} fps`).toBeLessThanOrEqual(MAX_DRAG_SPEED * (1 + 1e-9));
      expect(Math.hypot(grabbedPoint(body, grabbed).point[0] - 0.02), `${fps} fps`).toBeLessThan(
        0.001,
      );
    }
  });
});

describe('release', () => {
  it('shares one die between two pointers in insertion order and releases each grab alone', () => {
    const body = makeDie({ position: [0, 0, DIE_RADIUS] });
    const grabbed = [0, 0, FACE_HALF];
    const { world, canvas, pointer } = scene([body]);
    const pointVelocity = (axis) => {
      const { lever } = grabbedPoint(body, grabbed);
      const velocity = vec3.add(
        new Float64Array(3),
        body.linearVelocity,
        vec3.cross(new Float64Array(3), body.angularVelocity, lever),
      );
      return velocity[axis];
    };
    pressWorld(canvas, 1, 0, 0);
    pressWorld(canvas, 2, 0, 0);
    const held = pointer.heldBodies();
    expect(held).toHaveLength(2);
    expect(held[0]).toBe(body);
    expect(held[1]).toBe(body);

    moveWorld(canvas, 2, 0.02, 0, 16);
    world.update(1 / 60);
    expect(pointVelocity(0)).toBeGreaterThan(0);

    canvas.fire('pointerup', { pointerId: 2, clientX: 0.02 / 0.001, clientY: 0, timeStamp: 32 });
    expect(pointer.heldBodies()).toEqual([body]);
    world.update(1 / 60);
    expect(pointVelocity(0)).toBeLessThan(0);

    canvas.fire('pointerup', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 48 });
    expect(pointer.heldBodies()).toEqual([]);
  });

  it('releases with the pointer velocity and lets go of the die', () => {
    const body = makeDie({ position: [0, 0, DIE_RADIUS] });
    const { canvas, pointer } = scene([body]);
    pressWorld(canvas, 1, 0, 0);
    canvas.fire('pointermove', { pointerId: 1, clientX: 10, clientY: 0, timeStamp: 40 });
    canvas.fire('pointerup', { pointerId: 1, clientX: 10, clientY: 0, timeStamp: 80 });
    expect(pointer.heldBodies()).toEqual([]);
    near(body.linearVelocity[0], 0.01 / 0.08, 1e-9);
    expect(body.linearVelocity[2]).toBe(0);
    expect(Math.hypot(...body.angularVelocity)).toBeLessThanOrEqual(60);
  });

  it('keeps the other grab alive when one pointer is cancelled', () => {
    const body = makeDie();
    const { canvas, pointer } = scene([body]);
    pressWorld(canvas, 1, 0, 0);
    pressWorld(canvas, 2, 0, 0);
    canvas.fire('pointercancel', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 16 });
    expect(pointer.heldBodies()).toEqual([body]);
    canvas.fire('pointerup', { pointerId: 2, clientX: 0, clientY: 0, timeStamp: 32 });
    expect(pointer.heldBodies()).toEqual([]);
  });
});
