import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FLING_WINDOW_MS,
  MAX_DRAG_SPEED,
  MAX_FLING_SPEED,
  createPointer,
  flingVelocity,
} from './pointer.js';
import { FIXED_DT } from '../physics/world.js';

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

describe('createPointer', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(bodies, D = 0.068) {
    let nextFrame = null;
    vi.stubGlobal('requestAnimationFrame', (fn) => {
      nextFrame = fn;
      return 1;
    });
    const canvas = fakeCanvas();
    const pointer = createPointer(canvas, { world: { bodies, box: { W: 0.068, H: 0.14, D } }, toWorld });
    return { canvas, pointer, pump: () => nextFrame?.() };
  }

  it('grabs the highest die under the point and drives it at hold height', () => {
    const low = fakeBody(0, 0, 0.014);
    const high = fakeBody(0.002, 0, 0.03);
    const { canvas, pointer, pump } = setup([low, high]);
    canvas.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0, timeStamp: 0 });
    expect(pointer.heldBodies()).toEqual([high]);

    pump();
    const speed = Math.hypot(...high.linearVelocity);
    expect(speed).toBeGreaterThan(0);
    expect(speed).toBeLessThanOrEqual(MAX_DRAG_SPEED * (1 + 1e-12));
    expect(high.linearVelocity[2]).toBeGreaterThan(0);
    expect(high.position[2]).toBeLessThan(0.068 - 2 * high.radius);

    canvas.fire('pointermove', { pointerId: 1, clientX: 10, clientY: 0, timeStamp: FIXED_DT * 1000 });
    pump();
    expect(high.linearVelocity[0]).toBeGreaterThan(0);
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
