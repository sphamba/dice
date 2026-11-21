import { describe, expect, it } from 'vitest';
import * as mat4 from '../math/mat4.js';
import { CAMERA_MARGIN, createCamera, floorClearDepth, worldZFromDepth } from './camera.js';

const BOX = { W: 0.4, H: 0.3, D: 0.12 };
const EPS = 1e-6;

const near = (a, b, eps = EPS) => expect(Math.abs(a - b)).toBeLessThan(eps);

function toNdc(viewProjection, point) {
  const clip = mat4.multiply(mat4.create(), viewProjection, [point[0], point[1], point[2], 1]);
  return [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]];
}

const depth = (ndcZ) => (ndcZ + 1) / 2;

describe('createCamera', () => {
  const camera = createCamera(BOX);
  const viewProjection = mat4.multiply(mat4.create(), camera.projection, camera.view);

  it('maps the floor footprint corners to the clip square edges', () => {
    const corners = [
      [-BOX.W / 2, -BOX.H / 2, -1, -1],
      [BOX.W / 2, -BOX.H / 2, 1, -1],
      [BOX.W / 2, BOX.H / 2, 1, 1],
      [-BOX.W / 2, BOX.H / 2, -1, 1],
    ];
    for (const [x, y, nx, ny] of corners) {
      for (const z of [0, BOX.D]) {
        const ndc = toNdc(viewProjection, [x, y, z]);
        near(ndc[0], nx, 1e-5);
        near(ndc[1], ny, 1e-5);
      }
    }
  });

  it('maps the box center to the clip center', () => {
    const ndc = toNdc(viewProjection, [0, 0, BOX.D / 2]);
    near(ndc[0], 0);
    near(ndc[1], 0);
  });

  it('gives higher points a smaller depth', () => {
    const low = depth(toNdc(viewProjection, [0.1, -0.05, 0])[2]);
    const lid = depth(toNdc(viewProjection, [0.1, -0.05, BOX.D])[2]);
    expect(low).toBeGreaterThan(lid);
    expect(lid).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(1);
  });

  it('keeps z in [0, D] inside the near/far range', () => {
    const top = depth(toNdc(viewProjection, [0, 0, BOX.D])[2]);
    const bottom = depth(toNdc(viewProjection, [0, 0, 0])[2]);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(1);
    expect(CAMERA_MARGIN).toBeGreaterThan(0);
  });
});

describe('depth helpers', () => {
  const camera = createCamera(BOX);
  const viewProjection = mat4.multiply(mat4.create(), camera.projection, camera.view);

  it('worldZFromDepth inverts the camera window depth', () => {
    for (const z of [0, BOX.D / 2, BOX.D]) {
      const ndc = toNdc(viewProjection, [0.03, -0.07, z]);
      near(worldZFromDepth(depth(ndc[2]), BOX), z, 1e-6);
    }
  });

  it('floorClearDepth matches the window depth of the floor plane', () => {
    const ndc = toNdc(viewProjection, [0.07, -0.02, 0]);
    near(floorClearDepth(BOX), depth(ndc[2]), 1e-6);
    near(worldZFromDepth(floorClearDepth(BOX), BOX), 0, 1e-9);
  });
});
