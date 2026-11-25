import { describe, expect, it } from 'vitest';
import * as vec3 from '../math/vec3.js';
import { DICE_TYPES, createShape } from './shapes.js';
import { BEVEL_RADIUS, DIE_RADIUS } from '../physics/body.js';
import {
  D4_LABEL_CENTER,
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
const PIP_OFFSET_FRACTION = 0.38;
const LABEL_INK = 'rgb(255,255,255)';

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
    this.texts.push({ text, x: tx, y: ty, fontPx, fillStyle: this.fillStyle, at: this._matrix.slice() });
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

function recordAtlas(shape) {
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
    atlas = buildLabelAtlas(shape);
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
    const { atlas, ellipses } = recordAtlas(shape);
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
    const { atlas, ellipses } = recordAtlas(shape);
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

const CENTERED_TYPES = ['d8', 'd10', 'd12', 'd20'];

describe('buildLabelAtlas d4 corner numbers', () => {
  it('draws three distinct corner values inside every face cell', () => {
    const shape = createShape('d4', RADIUS);
    const { atlas, texts } = recordAtlas(shape);
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
        expect(label.fillStyle).toBe(LABEL_INK);
        expect(label.fontPx).toBeGreaterThan(0);
        expect(label.x).toBeCloseTo(centerX + D4_LABEL_CENTER * (size * uvs[k][0] - centerX), 6);
        expect(label.y).toBeCloseTo(centerY + D4_LABEL_CENTER * (size * (1 - uvs[k][1]) - centerY), 6);
        expect(label.x).toBeGreaterThan(box.left);
        expect(label.x).toBeLessThan(box.right);
        expect(label.y).toBeGreaterThan(box.top);
        expect(label.y).toBeLessThan(box.bottom);
      });
      expect(new Set(values).size).toBe(3);
    });
  });
});

const D4_CLEARANCE_MIN = 0.0001;
const D4_CLEARANCE_MAX = 0.00025;
const D4_GAP = 0.0002;
const D4_MIN_EM = 0.0035;
const D4_ADVANCE_EM = 0.56;
const D4_CAP_EM = 0.71;

// Ink of the limiting digit 4 (Arimo Bold), font space in em: y up, baseline at
// y = 0, origin at the pen position. Advance and the baseline offset of
// textBaseline 'middle' are measured in Chromium.
const D4_INK_ADVANCE_EM = 0.55615234375;
const D4_INK_MIDDLE_EM = 0.31;
const D4_INK = [
  [[0.458984, 0.140137], [0.458984, 0], [0.328125, 0], [0.328125, 0.140137],
    [0.015137, 0.140137], [0.015137, 0.243164], [0.305664, 0.687988], [0.458984, 0.687988],
    [0.458984, 0.242188], [0.550781, 0.242188], [0.550781, 0.140137]],
  [[0.126953, 0.242188], [0.328125, 0.242188], [0.328125, 0.467285], [0.331543, 0.555176],
    [0.33252, 0.563965], [0.303223, 0.510742], [0.286621, 0.484863]],
];
const BOX_CYCLE = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

function edgeDistances(polygon, [px, py]) {
  const distances = [];
  for (let k = 0; k < polygon.length; k += 1) {
    const a = polygon[k];
    const b = polygon[(k + 1) % polygon.length];
    const e = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(e[0], e[1]);
    if (len < 1e-12) continue;
    distances.push((e[0] * (py - a[1]) - e[1] * (px - a[0])) / len);
  }
  return distances;
}

// The drawn glyph box in face-2D units, taken from the paint transform the
// production code applied, so the fit size and the rotation both enter.
function glyphBox(label, scale, center) {
  const hw = 0.5 * D4_ADVANCE_EM * label.fontPx;
  const hh = 0.5 * D4_CAP_EM * label.fontPx;
  return BOX_CYCLE.map(([u, v]) => {
    const [x, y] = apply(label.at, u * hw, v * hh);
    return [(x - center[0]) / scale[0], (center[1] - y) / scale[1]];
  });
}

// The same glyph outline painted into face-2D units through the label's paint
// transform, with the center alignment and the middle baseline applied.
function glyphInk(label, scale, center) {
  return D4_INK.flat().map(([gx, gy]) => {
    const [x, y] = apply(
      label.at,
      (gx - D4_INK_ADVANCE_EM / 2) * label.fontPx,
      (D4_INK_MIDDLE_EM - gy) * label.fontPx,
    );
    return [(x - center[0]) / scale[0], (center[1] - y) / scale[1]];
  });
}

function segmentDistance(p, a, b) {
  const e = [b[0] - a[0], b[1] - a[1]];
  const len2 = e[0] * e[0] + e[1] * e[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * e[0] + (p[1] - a[1]) * e[1]) / len2));
  return Math.hypot(p[0] - (a[0] + t * e[0]), p[1] - (a[1] + t * e[1]));
}

function quadDistance(a, b) {
  let min = Infinity;
  for (const [from, to] of [[a, b], [b, a]]) {
    for (const p of from) {
      for (let k = 0; k < 4; k += 1) min = Math.min(min, segmentDistance(p, to[k], to[(k + 1) % 4]));
    }
  }
  return min;
}

function quadSeparated(a, b) {
  const axes = [];
  for (const quad of [a, b]) {
    for (let k = 0; k < 2; k += 1) {
      const e = [quad[k + 1][0] - quad[k][0], quad[k + 1][1] - quad[k][1]];
      const len = Math.hypot(e[0], e[1]);
      axes.push([-e[1] / len, e[0] / len]);
    }
  }
  return axes.some((axis) => {
    const pa = a.map((p) => p[0] * axis[0] + p[1] * axis[1]);
    const pb = b.map((p) => p[0] * axis[0] + p[1] * axis[1]);
    return Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa);
  });
}

function measureD4() {
  const shape = createShape('d4', DIE_RADIUS);
  const { atlas, texts } = recordAtlas(shape);
  const data = faceInsetData(shape, BEVEL_RADIUS);
  const { size, rects } = atlas;
  expect(texts).toHaveLength(shape.faces.length * 3);

  let worstMargin = Infinity;
  let minGap = Infinity;
  let minEm = Infinity;
  let overlaps = 0;
  let index = 0;
  shape.faces.forEach((face, f) => {
    const frame = faceFrame(shape, face);
    const rect = rects[f];
    const center = [
      (size * (rect.u0 + rect.u1)) / 2,
      size * (1 - (rect.v0 + rect.v1) / 2),
    ];
    const scale = [
      (size * (rect.u1 - rect.u0)) / (2 * frame.radius),
      (size * (rect.v1 - rect.v0)) / (2 * frame.radius),
    ];
    const inset = data[f].inset.slice(0, face.indices.length);
    const quads = [];
    for (let k = 0; k < face.indices.length; k += 1) {
      const label = texts[index];
      index += 1;
      minEm = Math.min(minEm, label.fontPx / scale[1]);
      const quad = glyphBox(label, scale, center);
      quads.push(quad);
      for (const point of glyphInk(label, scale, center)) {
        worstMargin = Math.min(worstMargin, ...edgeDistances(inset, point));
      }
    }
    for (let i = 0; i < quads.length; i += 1) {
      for (let j = i + 1; j < quads.length; j += 1) {
        if (!quadSeparated(quads[i], quads[j])) overlaps += 1;
        minGap = Math.min(minGap, quadDistance(quads[i], quads[j]));
      }
    }
  });
  return { worstMargin, minGap, minEm, overlaps };
}

describe('buildLabelAtlas d4 flat-face fit', () => {
  it('keeps every digit between 0.10 and 0.25 mm from the inset triangle border', () => {
    const { worstMargin, overlaps } = measureD4();
    expect(worstMargin).toBeGreaterThanOrEqual(D4_CLEARANCE_MIN);
    expect(worstMargin).toBeLessThanOrEqual(D4_CLEARANCE_MAX);
    expect(overlaps).toBe(0);
  });

  it('separates neighbouring numbers by 0.2 mm', () => {
    expect(measureD4().minGap).toBeGreaterThanOrEqual(D4_GAP);
  });

  it('draws numbers of at least 3.5 mm em', () => {
    expect(measureD4().minEm).toBeGreaterThanOrEqual(D4_MIN_EM);
  });
});

const D6_CLEARANCE_MIN = 0.0001;
const D6_CLEARANCE_MAX = 0.0003;

// Smallest distance from any d6 pip ink, padded by one atlas texel, to the
// border of the flat square (the face plane minus the rounded edge band).
function measureD6Clearance() {
  const shape = createShape('d6', DIE_RADIUS);
  const { atlas, ellipses } = recordAtlas(shape);
  const { size, rects } = atlas;
  let min = Infinity;
  let index = 0;
  shape.faces.forEach((face, f) => {
    const frame = faceFrame(shape, face);
    const rect = rects[f];
    const centerX = (size * (rect.u0 + rect.u1)) / 2;
    const centerY = size * (1 - (rect.v0 + rect.v1) / 2);
    const sx = (size * (rect.u1 - rect.u0)) / (2 * frame.radius);
    const sy = (size * (rect.v1 - rect.v0)) / (2 * frame.radius);
    const texel = Math.max(1 / sx, 1 / sy);
    const rho = vec3.dot(shape.vertices[face.indices[0]], face.normal);
    const flat = rho - BEVEL_RADIUS;
    for (let k = 0; k < PIP_COUNT[face.value]; k += 1) {
      const pip = ellipses[index];
      index += 1;
      const x = (pip.x - centerX) / sx;
      const y = (centerY - pip.y) / sy;
      const extent = Math.max(Math.abs(x) + pip.rx / sx, Math.abs(y) + pip.ry / sy);
      min = Math.min(min, flat - extent - texel);
    }
  });
  return min;
}

describe('buildLabelAtlas d6 flat-face fit', () => {
  it('keeps every pip plus one texel inside the flat square', () => {
    const clearance = measureD6Clearance();
    expect(clearance).toBeGreaterThanOrEqual(0);
    expect(clearance).toBeGreaterThanOrEqual(D6_CLEARANCE_MIN);
    expect(clearance).toBeLessThanOrEqual(D6_CLEARANCE_MAX);
  });
});

describe('buildLabelAtlas centered numbers', () => {
  it('centers the complete face value inside every cell', () => {
    for (const type of CENTERED_TYPES) {
      const shape = createShape(type, RADIUS);
      const { atlas, texts } = recordAtlas(shape);
      expect(texts).toHaveLength(shape.faces.length);
      expect(new Set(shape.faces.map((face) => face.value)).size).toBe(shape.faces.length);

      shape.faces.forEach((face, f) => {
        const box = cellBox(atlas.size, atlas.rects[f]);
        const label = texts[f];
        expect(label.text).toBe(String(face.value));
        expect(label.fillStyle).toBe(LABEL_INK);
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
      const { texts } = recordAtlas(shape);
      for (const label of texts) digits.add(Math.abs(Number(label.text)).toString().length);
    }
    expect(digits.has(1)).toBe(true);
    expect(digits.has(2)).toBe(true);
  });

  it('keeps the 6 and 9 underlines inside their own cell', () => {
    const shape = createShape('d10', RADIUS);
    const { atlas, texts, rects } = recordAtlas(shape);
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
