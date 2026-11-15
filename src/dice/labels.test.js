import { describe, expect, it } from 'vitest';
import { DICE_TYPES, createShape } from './shapes.js';
import { buildLabelAtlas, faceRects, faceVertexUvs } from './labels.js';

const RADIUS = 0.75;
const EPS = 1e-9;
const FACE_COUNT = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const PIP_COUNT = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
const PIP_RADIUS_FRACTION = 0.13;
const PIP_OFFSET_FRACTION = 0.42;
const D6_COLOR = [0.78, 0.22, 0.18];

class RecordingContext {
  constructor() {
    this.ellipses = [];
    this._path = [];
  }
  beginPath() {
    this._path = [];
  }
  ellipse(x, y, rx, ry) {
    this._path.push({ x, y, rx, ry });
  }
  fill() {
    if (this._path.length === 0) throw new Error('fill without an open path');
    this.ellipses.push(...this._path);
    this._path = [];
  }
  fillRect() {}
}

function recordAtlas(shape, color) {
  const previous = globalThis.OffscreenCanvas;
  const contexts = [];
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.ctx = new RecordingContext();
      contexts.push(this.ctx);
    }
    getContext() {
      return this.ctx;
    }
  };
  let atlas;
  try {
    atlas = buildLabelAtlas(shape, color);
  } finally {
    if (previous === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = previous;
  }
  return { atlas, ellipses: contexts[0].ellipses };
}

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

describe('buildLabelAtlas d6 pips', () => {
  it('draws every pip inside its own cell at the face-radius scale', () => {
    const shape = createShape('d6', RADIUS);
    const { atlas, ellipses } = recordAtlas(shape, D6_COLOR);
    const { size, rects } = atlas;
    const total = shape.faces.reduce((n, face) => n + PIP_COUNT[face.value], 0);
    expect(ellipses).toHaveLength(total);

    let index = 0;
    shape.faces.forEach((face, f) => {
      const rect = rects[f];
      const left = size * rect.u0;
      const right = size * rect.u1;
      const top = size * (1 - rect.v1);
      const bottom = size * (1 - rect.v0);
      const cellW = right - left;
      const cellH = bottom - top;
      for (let k = 0; k < PIP_COUNT[face.value]; k += 1) {
        const pip = ellipses[index];
        index += 1;
        expect(pip.rx).toBeCloseTo((PIP_RADIUS_FRACTION * cellW) / 2, 6);
        expect(pip.ry).toBeCloseTo((PIP_RADIUS_FRACTION * cellH) / 2, 6);
        expect(pip.x - pip.rx).toBeGreaterThanOrEqual(left - EPS);
        expect(pip.x + pip.rx).toBeLessThanOrEqual(right + EPS);
        expect(pip.y - pip.ry).toBeGreaterThanOrEqual(top - EPS);
        expect(pip.y + pip.ry).toBeLessThanOrEqual(bottom + EPS);
      }
    });
  });

  it('places pips at the classic offsets around the cell center', () => {
    const shape = createShape('d6', RADIUS);
    const { atlas, ellipses } = recordAtlas(shape, D6_COLOR);
    const { size, rects } = atlas;
    const withCenter = new Set([1, 3, 5]);
    const offset = PIP_OFFSET_FRACTION / 2;
    let index = 0;
    shape.faces.forEach((face, f) => {
      const rect = rects[f];
      const centerX = (size * (rect.u0 + rect.u1)) / 2;
      const centerY = size * (1 - (rect.v0 + rect.v1) / 2);
      const cellW = size * (rect.u1 - rect.u0);
      const cellH = size * (rect.v1 - rect.v0);
      for (let k = 0; k < PIP_COUNT[face.value]; k += 1) {
        const pip = ellipses[index];
        index += 1;
        const gx = Math.round((pip.x - centerX) / (offset * cellW));
        const gy = Math.round((centerY - pip.y) / (offset * cellH));
        expect(pip.x - centerX).toBeCloseTo(gx * offset * cellW, 6);
        expect(centerY - pip.y).toBeCloseTo(gy * offset * cellH, 6);
      }
      if (!withCenter.has(face.value)) return;
      const center = ellipses
        .slice(index - PIP_COUNT[face.value], index)
        .find((pip) => Math.abs(pip.x - centerX) < 1e-6 && Math.abs(pip.y - centerY) < 1e-6);
      expect(center).toBeDefined();
    });
    const four = ellipses.slice(0, 4);
    expect(new Set(four.map((pip) => Math.round(pip.x))).size).toBe(2);
  });
});
