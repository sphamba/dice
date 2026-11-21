import { describe, expect, it } from 'vitest';
import { FLOOR_VERTICES, aoTargetSize } from './renderer.js';

describe('aoTargetSize', () => {
  it('gives the phone-box example size', () => {
    expect(aoTargetSize({ W: 0.0675, H: 0.1462 }, 1200, 2600)).toEqual([338, 731]);
  });

  it('never exceeds the backing size and stays at least 1x1', () => {
    expect(aoTargetSize({ W: 0.5, H: 0.5 }, 100, 100)).toEqual([100, 100]);
    expect(aoTargetSize({ W: 0.0001, H: 0.0001 }, 10, 10)).toEqual([1, 1]);
  });
});

// GL triangle strips emit (v0,v1,v2) then (v2,v1,v3), so the second triangle's
// winding is reversed by the strip itself. CCW in NDC is front-facing.
function signedArea(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

describe('floor mesh winding', () => {
  it('emits both strip triangles front-facing', () => {
    const v = [];
    for (let i = 0; i < FLOOR_VERTICES.length; i += 2) {
      v.push([FLOOR_VERTICES[i], FLOOR_VERTICES[i + 1]]);
    }
    expect(v).toHaveLength(4);
    expect(signedArea(v[0], v[1], v[2])).toBeGreaterThan(0);
    expect(signedArea(v[2], v[1], v[3])).toBeGreaterThan(0);
  });

  it('covers the full -1..1 quad', () => {
    const xs = [...FLOOR_VERTICES].filter((_, i) => i % 2 === 0);
    const ys = [...FLOOR_VERTICES].filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(-1);
    expect(Math.max(...xs)).toBe(1);
    expect(Math.min(...ys)).toBe(-1);
    expect(Math.max(...ys)).toBe(1);
  });
});
