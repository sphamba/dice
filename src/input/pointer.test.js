import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FLING_WINDOW_MS,
  MAX_DRAG_SPEED,
  MAX_FLING_SPEED,
  createPointer,
  flingVelocity,
} from './pointer.js';
import { FIXED_DT, createWorld } from '../physics/world.js';
import { createBody } from '../physics/body.js';
import * as mat3 from '../math/mat3.js';

const near = (actual, expected, eps = 1e-9) => expect(Math.abs(actual - expected)).toBeLessThan(eps);

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

function fakeBody(x, y, z, radius = 0.014) {
  return {
    position: Float64Array.from([x, y, z]),
    linearVelocity: new Float64Array(3),
    angularVelocity: new Float64Array(3),
    radius,
  };
}

const toWorld = (px, py) => [px * 0.001, py * 0.001];

const BOX = { W: 0.0681, H: 0.1476, D: 0.0681 };

const makeDie = (position) =>
  createBody(
    {
      radius: 0.0139,
      volume: 4.096e-6,
      inertia: mat3.fromDiagonal(new Float64Array(9), 2e-5, 3e-5, 4e-5),
    },
    { position },
  );

function dragWorld(position = [0, 0, 0.0139]) {
  const world = createWorld(BOX);
  const body = world.addBody(makeDie(position));
  const canvas = fakeCanvas();
  const pointer = createPointer(canvas, { world, toWorld });
  return { world, body, canvas, pointer };
}

describe('createPointer', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(bodies, D = 0.068) {
    const canvas = fakeCanvas();
    const pointer = createPointer(canvas, {
      world: { bodies, box: { W: 0.068, H: 0.14, D } },
      toWorld,
    });
    return { canvas, pointer };
  }

  it('grabs the highest die under the point', () => {
    const low = fakeBody(0, 0, 0.014);
    const high = fakeBody(0.002, 0, 0.03);
    const { canvas, pointer } = setup([low, high]);
    canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
    expect(pointer.heldBodies()).toEqual([high]);
  });

  it('drives the held die at hold height within one frame of a still pointer', () => {
    const { world, body, canvas } = dragWorld([0, 0, 0.0139]);
    canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
    world.update(1 / 60);
    const holdZ = BOX.D - 2 * body.radius;
    expect(Math.abs(body.position[2] - holdZ)).toBeLessThan(0.001);
    expect(Math.hypot(body.position[0], body.position[1])).toBeLessThan(0.001);
    expect(Math.hypot(...body.linearVelocity)).toBeLessThanOrEqual(MAX_DRAG_SPEED * (1 + 1e-12));
  });

  it('keeps a still die at hold height at every frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const { world, body, canvas } = dragWorld();
      canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
      const holdZ = BOX.D - 2 * body.radius;
      for (let frame = 0; frame < fps / 10; frame += 1) world.update(1 / fps);
      let peak = 0;
      for (let frame = 0; frame < fps; frame += 1) {
        world.update(1 / fps);
        peak = Math.max(peak, Math.abs(body.position[2] - holdZ));
      }
      expect(peak).toBeLessThan(0.001);
    }
  });

  it('follows a pointer jump without overshoot at every frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const { world, body, canvas } = dragWorld();
      canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
      for (let frame = 0; frame < fps / 2; frame += 1) world.update(1 / fps);
      canvas.fire('pointermove', { pointerId: 1, clientX: 20, clientY: 0, timeStamp: (fps / 2) * 1000 / fps });
      let peak = 0;
      for (let frame = 0; frame < fps / 2; frame += 1) {
        world.update(1 / fps);
        peak = Math.max(peak, body.position[0] - 0.02);
      }
      expect(peak).toBeLessThan(0.002);
      expect(Math.abs(body.position[0] - 0.02)).toBeLessThan(0.001);
    }
  });

  it('shares one die between two pointers in insertion order and releases each grab alone', () => {
    const { world, body, canvas, pointer } = dragWorld([0, 0, 0.0139]);
    canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
    canvas.fire('pointerdown', { pointerId: 2, clientX: 0, clientY: 0, timeStamp: 0 });
    const held = pointer.heldBodies();
    expect(held).toHaveLength(2);
    expect(held[0]).toBe(body);
    expect(held[1]).toBe(body);

    canvas.fire('pointermove', { pointerId: 2, clientX: 20, clientY: 0, timeStamp: 16 });
    world.update(1 / 60);
    expect(body.linearVelocity[0]).toBeGreaterThan(0);

    canvas.fire('pointerup', { pointerId: 2, clientX: 20, clientY: 0, timeStamp: 32 });
    expect(pointer.heldBodies()).toEqual([body]);
    world.update(1 / 60);
    expect(body.linearVelocity[0]).toBeLessThan(0);

    canvas.fire('pointerup', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 48 });
    expect(pointer.heldBodies()).toEqual([]);
  });

  it('releases with the pointer velocity and lets go of the die', () => {
    const body = fakeBody(0, 0, 0.014);
    const { canvas, pointer } = setup([body]);
    canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
    canvas.fire('pointermove', { pointerId: 1, clientX: 10, clientY: 0, timeStamp: 40 });
    canvas.fire('pointerup', { pointerId: 1, clientX: 10, clientY: 0, timeStamp: 80 });
    expect(pointer.heldBodies()).toEqual([]);
    near(body.linearVelocity[0], 0.01 / 0.08, 1e-9);
    expect(body.linearVelocity[2]).toBe(0);
    expect(Math.hypot(...body.angularVelocity)).toBeLessThanOrEqual(60);
  });
});
