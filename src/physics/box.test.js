import { describe, expect, it } from 'vitest';
import { METERS_PER_DEVICE_PIXEL, MIN_BOX_EDGE, boxFromViewport } from './box.js';

const near = (actual, expected, eps = 1e-4) => expect(Math.abs(actual - expected)).toBeLessThan(eps);

describe('boxFromViewport', () => {
  it('uses the physical size of an iPhone 15 screen', () => {
    const { W, H, D, metersPerPixel } = boxFromViewport(393, 852, 3);
    near(W, 0.0681);
    near(H, 0.1476);
    expect(D).toBe(W);
    near(metersPerPixel, 3 * METERS_PER_DEVICE_PIXEL);
  });

  it('keeps the box size when the browser zoom changes css size and ratio', () => {
    const wide = boxFromViewport(393, 852, 3);
    const zoomed = boxFromViewport(786, 1704, 1.5);
    near(zoomed.W, wide.W);
    near(zoomed.H, wide.H);
    near(zoomed.D, wide.D);
  });

  it('raises the scale so the shortest edge is at least MIN_BOX_EDGE', () => {
    const { W, H, D } = boxFromViewport(200, 300, 1);
    expect(Math.min(W, H)).toBeCloseTo(MIN_BOX_EDGE, 12);
    expect(D).toBeCloseTo(MIN_BOX_EDGE, 12);
  });

  it('keeps the aspect ratio through the guard', () => {
    const { W, H } = boxFromViewport(200, 300, 1);
    expect(H / W).toBeCloseTo(300 / 200, 12);
  });
});
