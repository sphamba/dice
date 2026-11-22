import { describe, expect, it } from 'vitest';
import * as vec3 from '../math/vec3.js';
import { DICE_TYPES, createShape } from './shapes.js';
import { BEVEL_RADIUS, DIE_RADIUS } from '../physics/body.js';
import {
  buildLabelAtlas,
  faceFrame,
  faceInsetData,
  faceRects,
  faceVertexUvs,
  toFace2D,
} from './labels.js';

const RADIUS = 0.75;
const EPS = 1e-9;
const FACE_COUNT = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const PIP_COUNT = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 };
const PIP_RADIUS_FRACTION = 0.13;
const PIP_OFFSET_FRACTION = 0.42;
const D6_COLOR = [0.78, 0.22, 0.18];

const IDENTITY = [1, 0, 0, 1, 0, 0];

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

class RecordingContext {
  constructor() {
    this.ellipses = [];
    this.texts = [];
    this.rects = [];
    this.fillStyle = '#000';
    this.font = '10px sans-serif';
    this._path = [];
    this._matrix = IDENTITY;
    this._stack = [];
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
  save() {
    this._stack.push(this._matrix.slice());
  }
  restore() {
    this._matrix = this._stack.pop();
  }
  translate(x, y) {
    this._matrix = multiply(this._matrix, [1, 0, 0, 1, x, y]);
  }
  rotate(angle) {
    this._matrix = multiply(this._matrix, [
      Math.cos(angle),
      Math.sin(angle),
      -Math.sin(angle),
      Math.cos(angle),
      0,
      0,
    ]);
  }
  scale(x, y) {
    this._matrix = multiply(this._matrix, [x, 0, 0, y, 0, 0]);
  }
  measureText(text) {
    return { width: 56 * text.length };
  }
  fillText(text, x, y) {
    const [tx, ty] = apply(this._matrix, x, y);
    const fontPx = Number.parseFloat(this.font.replace(/^[^0-9]*/, ''));
    this.texts.push({ text, x: tx, y: ty, fontPx, fillStyle: this.fillStyle });
  }
  fillRect(x, y, w, h) {
    const corners = [
      apply(this._matrix, x, y),
      apply(this._matrix, x + w, y),
      apply(this._matrix, x, y + h),
      apply(this._matrix, x + w, y + h),
    ];
    this.rects.push({
      left: Math.min(...corners.map((c) => c[0])),
      right: Math.max(...corners.map((c) => c[0])),
      top: Math.min(...corners.map((c) => c[1])),
      bottom: Math.max(...corners.map((c) => c[1])),
      fillStyle: this.fillStyle,
    });
  }
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
  return {
    atlas,
    ellipses: contexts[0].ellipses,
    texts: contexts[0].texts,
    rects: contexts[0].rects,
  };
}

function cellBox(size, rect) {
  return {
    left: size * rect.u0,
    right: size * rect.u1,
    top: size * (1 - rect.v1),
    bottom: size * (1 - rect.v0),
  };
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

const DIE_COLORS = [
  { die: [0.78, 0.22, 0.18], ink: 'rgb(245,242,237)' },
  { die: [0.93, 0.92, 0.88], ink: 'rgb(20,18,18)' },
];

const CENTERED_TYPES = ['d8', 'd10', 'd12', 'd20'];

describe('buildLabelAtlas d4 corner numbers', () => {
  it('draws three distinct corner values inside every face cell', () => {
    const shape = createShape('d4', RADIUS);
    const { atlas, texts } = recordAtlas(shape, DIE_COLORS[0].die);
    const { size, rects } = atlas;
    const layout = faceVertexUvs(shape);
    expect(texts).toHaveLength(shape.faces.length * 3);

    let index = 0;
    shape.faces.forEach((face, f) => {
      const box = cellBox(size, rects[f]);
      const { rect, uvs } = layout[f];
      const centerX = (size * (rect.u0 + rect.u1)) / 2;
      const centerY = size * (1 - (rect.v0 + rect.v1) / 2);
      const values = [];
      face.indices.forEach((vi, k) => {
        const label = texts[index];
        index += 1;
        values.push(label.text);
        expect(label.text).toBe(String(shape.vertexValues[vi]));
        expect(label.fillStyle).toBe(DIE_COLORS[0].ink);
        expect(label.fontPx).toBeGreaterThan(0);
        expect(label.x).toBeCloseTo(centerX + 0.62 * (size * uvs[k][0] - centerX), 6);
        expect(label.y).toBeCloseTo(centerY + 0.62 * (size * (1 - uvs[k][1]) - centerY), 6);
        expect(label.x).toBeGreaterThan(box.left);
        expect(label.x).toBeLessThan(box.right);
        expect(label.y).toBeGreaterThan(box.top);
        expect(label.y).toBeLessThan(box.bottom);
      });
      expect(new Set(values).size).toBe(3);
    });
  });
});

describe('buildLabelAtlas centered numbers', () => {
  it('centers the complete face value inside every cell', () => {
    for (const type of CENTERED_TYPES) {
      const shape = createShape(type, RADIUS);
      const { atlas, texts } = recordAtlas(shape, DIE_COLORS[1].die);
      expect(texts).toHaveLength(shape.faces.length);
      expect(new Set(shape.faces.map((face) => face.value)).size).toBe(shape.faces.length);

      shape.faces.forEach((face, f) => {
        const box = cellBox(atlas.size, atlas.rects[f]);
        const label = texts[f];
        expect(label.text).toBe(String(face.value));
        expect(label.fillStyle).toBe(DIE_COLORS[1].ink);
        expect(label.fontPx).toBeGreaterThan(0);
        expect(label.x).toBeCloseTo((box.left + box.right) / 2, 6);
        expect(label.y).toBeCloseTo((box.top + box.bottom) / 2, 6);
        expect(label.x).toBeGreaterThan(box.left);
        expect(label.x).toBeLessThan(box.right);
        expect(label.y).toBeGreaterThan(box.top);
        expect(label.y).toBeLessThan(box.bottom);
      });
    }
  });

  it('covers one-digit and two-digit values', () => {
    const digits = new Set();
    for (const type of CENTERED_TYPES) {
      const shape = createShape(type, RADIUS);
      const { texts } = recordAtlas(shape, DIE_COLORS[0].die);
      for (const label of texts) digits.add(Math.abs(Number(label.text)).toString().length);
    }
    expect(digits.has(1)).toBe(true);
    expect(digits.has(2)).toBe(true);
  });

  it('keeps the 6 and 9 underlines inside their own cell', () => {
    const shape = createShape('d10', RADIUS);
    const { atlas, texts, rects } = recordAtlas(shape, DIE_COLORS[0].die);
    const marked = shape.faces.map((face, f) => ({ face, f })).filter(({ face }) => ['6', '9'].includes(String(face.value)));
    expect(marked).toHaveLength(2);
    expect(rects).toHaveLength(2);
    marked.forEach(({ f }, i) => {
      const box = cellBox(atlas.size, atlas.rects[f]);
      const underline = rects[i];
      expect(underline.left).toBeGreaterThanOrEqual(box.left - EPS);
      expect(underline.right).toBeLessThanOrEqual(box.right + EPS);
      expect(underline.top).toBeGreaterThanOrEqual(box.top - EPS);
      expect(underline.bottom).toBeLessThanOrEqual(box.bottom + EPS);
      expect(underline.top).toBeGreaterThan(texts[f].y);
    });
  });
});

describe('faceInsetData', () => {
  it('returns frame right, corner face-2D positions and 5 padded inset points', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const data = faceInsetData(shape, BEVEL_RADIUS);
      expect(data).toHaveLength(shape.faces.length);
      shape.faces.forEach((face, f) => {
        const { right, face2D, inset, scale } = data[f];
        const frame = faceFrame(shape, face);
        const n = face.normal;
        const rho = vec3.dot(shape.vertices[face.indices[0]], n);
        expect(scale).toBeCloseTo(1 - BEVEL_RADIUS / rho, 15);
        expect(vec3.length(right)).toBeCloseTo(1, 12);
        const a0 = shape.vertices[face.indices[0]];
        const b0 = shape.vertices[face.indices[1]];
        const edge = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
        const edgeLen = Math.hypot(edge[0], edge[1], edge[2]);
        for (let c = 0; c < 3; c += 1) {
          expect(right[c]).toBeCloseTo(edge[c] / edgeLen, 12);
        }

        expect(inset).toHaveLength(5);
        for (let k = face.indices.length; k < 5; k += 1) {
          expect(inset[k]).toEqual(inset[face.indices.length - 1]);
        }
        for (let k = 0; k < face.indices.length; k += 1) {
          const v = shape.vertices[face.indices[k]];
          const corner2D = toFace2D(frame, v);
          expect(face2D[k][0]).toBeCloseTo(corner2D[0], 12);
          expect(face2D[k][1]).toBeCloseTo(corner2D[1], 12);
          const shifted = [
            scale * v[0] + BEVEL_RADIUS * n[0],
            scale * v[1] + BEVEL_RADIUS * n[1],
            scale * v[2] + BEVEL_RADIUS * n[2],
          ];
          expect(Math.abs(vec3.dot(shifted, n) - rho)).toBeLessThanOrEqual(1e-9);
          const inset2D = toFace2D(frame, shifted);
          expect(inset[k][0]).toBeCloseTo(inset2D[0], 12);
          expect(inset[k][1]).toBeCloseTo(inset2D[1], 12);
        }
      });
    }
  });

  it('gives a CCW inset polygon strictly inside the face polygon', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const data = faceInsetData(shape, BEVEL_RADIUS);
      shape.faces.forEach((face, f) => {
        const { inset } = data[f];
        let area = 0;
        for (let k = 0; k < 5; k += 1) {
          const a = inset[k];
          const b = inset[(k + 1) % 5];
          area += a[0] * b[1] - a[1] * b[0];
        }
        expect(area).toBeGreaterThan(0);

        const frame = faceFrame(shape, face);
        const corners = face.indices.map((vi) => toFace2D(frame, shape.vertices[vi]));
        for (let k = 0; k < corners.length; k += 1) {
          const a = corners[k];
          const b = corners[(k + 1) % corners.length];
          const e = [b[0] - a[0], b[1] - a[1]];
          for (const p of inset) {
            const cr = e[0] * (p[1] - a[1]) - e[1] * (p[0] - a[0]);
            expect(cr).toBeGreaterThan(0);
          }
        }
      });
    }
  });
});
