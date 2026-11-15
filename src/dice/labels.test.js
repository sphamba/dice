import { describe, expect, it } from 'vitest';
import { DICE_TYPES, createShape } from './shapes.js';
import { faceRects, faceVertexUvs } from './labels.js';

const RADIUS = 0.75;
const EPS = 1e-9;
const FACE_COUNT = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

function overlap(a, b) {
  return (
    a.u0 < b.u1 - EPS &&
    b.u0 < a.u1 - EPS &&
    a.v0 < b.v1 - EPS &&
    b.v0 < a.v1 - EPS
  );
}

describe('faceRects', () => {
  it('packs one rectangle per face inside the unit square', () => {
    for (const type of DICE_TYPES) {
      const count = FACE_COUNT[type];
      const rects = faceRects(count);
      expect(rects).toHaveLength(count);
      for (const rect of rects) {
        expect(rect.u0).toBeGreaterThanOrEqual(0);
        expect(rect.v0).toBeGreaterThanOrEqual(0);
        expect(rect.u1).toBeLessThanOrEqual(1);
        expect(rect.v1).toBeLessThanOrEqual(1);
        expect(rect.u1).toBeGreaterThan(rect.u0);
        expect(rect.v1).toBeGreaterThan(rect.v0);
      }
    }
  });

  it('never overlaps two rectangles of the same atlas', () => {
    for (const type of DICE_TYPES) {
      const rects = faceRects(FACE_COUNT[type]);
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          expect(overlap(rects[i], rects[j])).toBe(false);
        }
      }
    }
  });
});

describe('faceVertexUvs', () => {
  it('gives every face of every type one rectangle and corner UVs inside it', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, RADIUS);
      const layout = faceVertexUvs(shape);
      expect(layout).toHaveLength(shape.faces.length);
      for (let f = 0; f < layout.length; f += 1) {
        const { rect, uvs } = layout[f];
        expect(rect.u0).toBeGreaterThanOrEqual(0);
        expect(rect.v0).toBeGreaterThanOrEqual(0);
        expect(rect.u1).toBeLessThanOrEqual(1);
        expect(rect.v1).toBeLessThanOrEqual(1);
        expect(uvs).toHaveLength(shape.faces[f].indices.length);
        for (const [u, v] of uvs) {
          expect(u).toBeGreaterThanOrEqual(rect.u0 - EPS);
          expect(u).toBeLessThanOrEqual(rect.u1 + EPS);
          expect(v).toBeGreaterThanOrEqual(rect.v0 - EPS);
          expect(v).toBeLessThanOrEqual(rect.v1 + EPS);
          expect(u).toBeGreaterThanOrEqual(0);
          expect(u).toBeLessThanOrEqual(1);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('maps different faces to non-overlapping rectangles', () => {
    for (const type of DICE_TYPES) {
      const layout = faceVertexUvs(createShape(type, RADIUS));
      for (let i = 0; i < layout.length; i += 1) {
        for (let j = i + 1; j < layout.length; j += 1) {
          expect(overlap(layout[i].rect, layout[j].rect)).toBe(false);
        }
      }
    }
  });
});
