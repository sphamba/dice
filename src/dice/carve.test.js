import { describe, expect, it } from 'vitest';
import { DICE_TYPES, createShape } from './shapes.js';
import { DIE_RADIUS } from '../physics/body.js';
import { ATLAS_SIZE, buildLabelAtlas, faceFrame, faceRects, toFace2D } from './labels.js';
import { diceFragmentSource, floorFragmentSource } from '../render/shaders.js';
import {
  CARVE_DEPTH,
  buildCarveAtlas,
  carveCell,
  distanceTransform,
  signedDistance,
} from './carve.js';

const SPACING = 1e-4;

function diskMask(w, h, cx, cy, radius) {
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const dx = i - cx;
      const dy = j - cy;
      mask[j * w + i] = dx * dx + dy * dy <= radius * radius ? 1 : 0;
    }
  }
  return mask;
}

// Pixels of a set that touch its edge: the nearest pixel of a set from any
// point is always one of them, ties included.
function boundaryPoints(mask, w, h) {
  const xs = [];
  const ys = [];
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const p = j * w + i;
      if (!mask[p]) continue;
      if (
        i === 0 ||
        j === 0 ||
        i === w - 1 ||
        j === h - 1 ||
        !mask[p - 1] ||
        !mask[p + 1] ||
        !mask[p - w] ||
        !mask[p + w]
      ) {
        xs.push(i);
        ys.push(j);
      }
    }
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys) };
}

function nearestDistance({ xs, ys }, w, h) {
  const out = new Float64Array(w * h);
  const count = xs.length;
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      let best = Infinity;
      for (let k = 0; k < count; k += 1) {
        const dx = i - xs[k];
        const dy = j - ys[k];
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      out[j * w + i] = Math.sqrt(best);
    }
  }
  return out;
}

// Brute-force signed distance in pixel units, negative inside the mask.
function exactSignedDistance(mask, w, h) {
  const inverted = new Uint8Array(w * h);
  for (let p = 0; p < inverted.length; p += 1) inverted[p] = mask[p] ? 0 : 1;
  const toOutside = nearestDistance(boundaryPoints(inverted, w, h), w, h);
  const toInside = nearestDistance(boundaryPoints(mask, w, h), w, h);
  const out = new Float64Array(w * h);
  for (let p = 0; p < out.length; p += 1) {
    out[p] = mask[p] ? -toOutside[p] : toInside[p];
  }
  return out;
}

function diskMaskAt(w, h, disks) {
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      for (const [cx, cy, radius] of disks) {
        const dx = i - cx;
        const dy = j - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          mask[j * w + i] = 1;
          break;
        }
      }
    }
  }
  return mask;
}

function exactnessReport(mask, w, h) {
  const sdf = signedDistance(mask, w, h, 1, 1);
  const exact = exactSignedDistance(mask, w, h);
  let finite = true;
  let worst = 0;
  for (let p = 0; p < sdf.length; p += 1) {
    if (!Number.isFinite(sdf[p])) finite = false;
    else worst = Math.max(worst, Math.abs(sdf[p] - exact[p]));
  }
  return { finite, worst };
}

function decode(cell, w, i, j) {
  const p = (j * w + i) * 4;
  return [
    (cell[p] / 255) * 2 - 1,
    (cell[p + 1] / 255) * 2 - 1,
    (cell[p + 2] / 255) * 2 - 1,
    cell[p + 3] / 255,
  ];
}

function bytes(cell, w, i, j) {
  const p = (j * w + i) * 4;
  return [cell[p], cell[p + 1], cell[p + 2], cell[p + 3]];
}

const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('carve constants', () => {
  it('derives the carve depth from the die radius', () => {
    expect(CARVE_DEPTH).toBe(0.0289 * DIE_RADIUS);
  });
});

describe('distanceTransform (Felzenszwalb-Huttenlocher)', () => {
  const w = 97;
  const h = 97;
  const centre = 48;
  const radius = 40;

  it('matches the brute-force exact distance on a synthetic disk, inside and out', () => {
    const mask = diskMask(w, h, centre, centre, radius);
    const dt = distanceTransform(mask, w, h, 1, 1);
    const sources = [];
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        if (mask[j * w + i]) sources.push([i, j]);
      }
    }
    let worst = 0;
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        let exact = Infinity;
        for (const [sx, sy] of sources) {
          exact = Math.min(exact, Math.hypot(i - sx, j - sy));
        }
        worst = Math.max(worst, Math.abs(dt[j * w + i] - exact));
      }
    }
    expect(worst).toBeLessThanOrEqual(0.5);
  });

  it('signs the field negative inside the mask and positive outside', () => {
    const mask = diskMask(w, h, centre, centre, radius);
    const sdf = signedDistance(mask, w, h, 1, 1);
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        const inside = mask[j * w + i] !== 0;
        expect(sdf[j * w + i] < 0).toBe(inside);
      }
    }
    expect(sdf[centre * w + centre]).toBeLessThan(-radius);
    expect(sdf[centre * w + centre]).toBeGreaterThan(-radius - 2);
  });
});

describe('signedDistance on non-square masks', () => {
  it('agrees with the brute-force field on a small mask, inside and out', () => {
    const w = 64;
    const h = 64;
    const mask = diskMaskAt(w, h, [[20, 22, 9], [44, 40, 5]]);
    const { finite, worst } = exactnessReport(mask, w, h);
    expect(finite).toBe(true);
    expect(worst).toBeLessThanOrEqual(0.5);
  });

  it('stays finite and exact with a glyph in the lower half of a tall mask', () => {
    const w = 341;
    const h = 512;
    const mask = diskMaskAt(w, h, [[99, 148, 22], [99, 364, 22]]);
    const { finite, worst } = exactnessReport(mask, w, h);
    expect(finite).toBe(true);
    expect(worst).toBeLessThanOrEqual(0.5);
  }, 60000);

  it('stays finite and exact with a glyph in each quadrant of both orientations', () => {
    for (const [w, h] of [[160, 320], [320, 160], [200, 280]]) {
      const mask = diskMaskAt(w, h, [
        [0.3 * w, 0.3 * h, 10],
        [0.7 * w, 0.3 * h, 8],
        [0.3 * w, 0.7 * h, 12],
        [0.7 * w, 0.8 * h, 6],
      ]);
      const { finite, worst } = exactnessReport(mask, w, h);
      expect(finite).toBe(true);
      expect(worst).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('carveCell profiles', () => {
  it('dimples a synthetic pip: flat at the centre and outside, walls tilting inward', () => {
    const w = 64;
    const h = 64;
    const c = 32;
    const mask = diskMask(w, h, c, c, 8);
    const cell = carveCell(mask, w, h, SPACING, SPACING);

    const centreN = decode(cell, w, c, c);
    expect(Math.abs(centreN[0])).toBeLessThanOrEqual(0.01);
    expect(Math.abs(centreN[1])).toBeLessThanOrEqual(0.01);
    expect(centreN[2]).toBeCloseTo(1, 2);

    expect(bytes(cell, w, 5, 5)).toEqual([128, 128, 255, 255]);

    const right = decode(cell, w, c + 7, c);
    expect(right[0]).toBeLessThan(-0.2);
    expect(Math.abs(right[1])).toBeLessThanOrEqual(0.02);
    const left = decode(cell, w, c - 7, c);
    expect(left[0]).toBeGreaterThan(0.2);
    expect(Math.abs(left[0] + right[0])).toBeLessThanOrEqual(0.02);

    for (let p = 2; p < cell.length; p += 4) {
      expect(cell[p]).toBeGreaterThanOrEqual(127);
    }
  });

  it('cuts a symmetric groove across a synthetic stroke', () => {
    const w = 64;
    const h = 64;
    const mask = new Uint8Array(w * h);
    for (let j = 12; j <= 52; j += 1) {
      for (let i = 28; i <= 36; i += 1) mask[j * w + i] = 1;
    }
    const cell = carveCell(mask, w, h, SPACING, SPACING);

    const bottom = decode(cell, w, 32, 32);
    expect(Math.abs(bottom[0])).toBeLessThanOrEqual(0.01);
    expect(Math.abs(bottom[1])).toBeLessThanOrEqual(0.01);
    expect(bottom[3]).toBe(1);

    const leftWall = decode(cell, w, 29, 32);
    const rightWall = decode(cell, w, 35, 32);
    expect(leftWall[0]).toBeGreaterThan(0.15);
    expect(rightWall[0]).toBeLessThan(-0.15);
    expect(Math.abs(leftWall[0] + rightWall[0])).toBeLessThanOrEqual(0.02);
    expect(Math.abs(leftWall[1])).toBeLessThanOrEqual(0.02);
    expect(Math.abs(rightWall[1])).toBeLessThanOrEqual(0.02);

    expect(leftWall[3]).toBeLessThan(1);
    expect(leftWall[3]).toBeGreaterThan(0.7);
  });
});

describe('carve orientation in the face frame', () => {
  const SIZE = 1024;

  function cellGeometry(shape, face) {
    const frame = faceFrame(shape, face);
    const rect = faceRects(shape.faces.length)[shape.faces.indexOf(face)];
    return {
      frame,
      spacingX: (2 * frame.radius) / (SIZE * (rect.u1 - rect.u0)),
      spacingY: (2 * frame.radius) / (SIZE * (rect.v1 - rect.v0)),
      w: Math.round(SIZE * (rect.u1 - rect.u0)),
      h: Math.round(SIZE * (rect.v1 - rect.v0)),
    };
  }

  function glyphCentre(shape, face, frame) {
    if (shape.type === 'd6') return [0, 0];
    if (shape.type === 'd4') {
      const [x, y] = toFace2D(frame, shape.vertices[face.indices[0]]);
      return [x * 0.62, y * 0.62];
    }
    return [0, 0];
  }

  for (const type of DICE_TYPES) {
    it(`tilts the world normal right of and above the glyph centre toward it (${type})`, () => {
      const shape = createShape(type, DIE_RADIUS);
      const face = type === 'd6' ? shape.faces.find((f) => f.value === 5) : shape.faces[0];
      const g = cellGeometry(shape, face);
      const [gx, gy] = glyphCentre(shape, face, g.frame);
      const radius = 0.1 * g.frame.radius;

      const mask = new Uint8Array(g.w * g.h);
      for (let j = 0; j < g.h; j += 1) {
        for (let i = 0; i < g.w; i += 1) {
          const x = (i + 0.5 - g.w / 2) * g.spacingX;
          const y = (g.h / 2 - (j + 0.5)) * g.spacingY;
          const dx = x - gx;
          const dy = y - gy;
          mask[j * g.w + i] = dx * dx + dy * dy <= radius * radius ? 1 : 0;
        }
      }
      const cell = carveCell(mask, g.w, g.h, g.spacingX, g.spacingY);

      const n = face.normal;
      const t = g.frame.right;
      const b = norm3(cross3(n, t));
      const worldNormal = (m) =>
        norm3([
          t[0] * m[0] + b[0] * m[1] + n[0] * m[2],
          t[1] * m[0] + b[1] * m[1] + n[1] * m[2],
          t[2] * m[0] + b[2] * m[1] + n[2] * m[2],
        ]);
      const sample = (x, y) => {
        const i = Math.round(g.w / 2 + x / g.spacingX - 0.5);
        const j = Math.round(g.h / 2 - y / g.spacingY - 0.5);
        return decode(cell, g.w, i, j);
      };

      for (const [ox, oy] of [[0.8 * radius, 0], [0, 0.8 * radius]]) {
        const len = Math.hypot(ox, oy);
        const toward = norm3([
          t[0] * (-ox / len) + b[0] * (-oy / len),
          t[1] * (-ox / len) + b[1] * (-oy / len),
          t[2] * (-ox / len) + b[2] * (-oy / len),
        ]);
        const wn = worldNormal(sample(gx + ox, gy + oy));
        expect(dot3(wn, toward)).toBeGreaterThan(0.15);
        expect(dot3(wn, n)).toBeGreaterThan(0);
      }
    });
  }
});

describe('buildCarveAtlas', () => {
  it('maps every cell from the atlas alpha and writes rows bottom-up', () => {
    const shape = createShape('d6', DIE_RADIUS);
    const size = 96;
    const rects = faceRects(shape.faces.length);
    const rect = rects[0];
    const x0 = Math.round(rect.u0 * size);
    const y0 = Math.round((1 - rect.v1) * size);
    const w = Math.round(size * (rect.u1 - rect.u0));
    const h = Math.round(size * (rect.v1 - rect.v0));
    const cx = (size * (rect.u0 + rect.u1)) / 2;
    const cy = size * (1 - (rect.v0 + rect.v1) / 2);
    const radius = 6;

    const source = new Uint8ClampedArray(size * size * 4);
    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        const dx = i + 0.5 - cx;
        const dy = j + 0.5 - cy;
        if (dx * dx + dy * dy <= radius * radius) source[(j * size + i) * 4 + 3] = 255;
      }
    }
    const canvas = {
      getContext: () => ({
        getImageData: (x, y, sw, sh) => ({ data: source, width: sw, height: sh }),
      }),
    };
    const { size: outSize, data } = buildCarveAtlas(shape, { canvas, size, rects });
    expect(outSize).toBe(size);
    expect(data).toHaveLength(size * size * 4);

    const frame = faceFrame(shape, shape.faces[0]);
    const spacingX = (2 * frame.radius) / (size * (rect.u1 - rect.u0));
    const spacingY = (2 * frame.radius) / (size * (rect.v1 - rect.v0));
    const mask = new Uint8Array(w * h);
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        mask[j * w + i] = source[((y0 + j) * size + x0 + i) * 4 + 3] >= 128 ? 1 : 0;
      }
    }
    const expected = carveCell(mask, w, h, spacingX, spacingY);
    for (let j = 0; j < h; j += 1) {
      const outRow = size - 1 - (y0 + j);
      const outStart = (outRow * size + x0) * 4;
      expect(data.slice(outStart, outStart + w * 4)).toEqual(expected.slice(j * w * 4, (j + 1) * w * 4));
    }

    for (let j = 0; j < size; j += 1) {
      for (let i = 0; i < size; i += 1) {
        if (i >= x0 && i < x0 + w && j >= size - y0 - h && j < size - y0) continue;
        const p = (j * size + i) * 4;
        expect([data[p], data[p + 1], data[p + 2], data[p + 3]]).toEqual([128, 128, 255, 255]);
      }
    }
  });
});

describe('buildCarveAtlas on the real d6 label atlas', () => {
  // Fakes the canvas rasteriser: the recorded label shapes are filled as solid
  // ellipses, so the pip positions and sizes come from buildLabelAtlas itself.
  function rasterisedLabelAtlas(shape) {
    const ellipses = [];
    const alpha = new Uint8ClampedArray(ATLAS_SIZE * ATLAS_SIZE);
    let painted = false;
    const paint = () => {
      if (painted) return;
      painted = true;
      for (const { x, y, rx, ry } of ellipses) {
        for (let j = Math.floor(y - ry); j <= Math.ceil(y + ry); j += 1) {
          for (let i = Math.floor(x - rx); i <= Math.ceil(x + rx); i += 1) {
            if (i < 0 || j < 0 || i >= ATLAS_SIZE || j >= ATLAS_SIZE) continue;
            const dx = (i + 0.5 - x) / rx;
            const dy = (j + 0.5 - y) / ry;
            if (dx * dx + dy * dy <= 1) alpha[j * ATLAS_SIZE + i] = 255;
          }
        }
      }
    };
    const ctx = {
      fillStyle: '#000',
      beginPath() {},
      ellipse(x, y, rx, ry) {
        ellipses.push({ x, y, rx, ry });
      },
      fill() {},
      getImageData: (x, y, w, h) => {
        paint();
        const data = new Uint8ClampedArray(alpha.length * 4);
        for (let p = 0; p < alpha.length; p += 1) data[p * 4 + 3] = alpha[p];
        return { data, width: w, height: h };
      },
    };
    const previous = globalThis.OffscreenCanvas;
    globalThis.OffscreenCanvas = class {
      constructor(width) {
        this.width = width;
        this.height = width;
      }
      getContext() {
        return ctx;
      }
    };
    try {
      return { atlas: buildLabelAtlas(shape, [0.78, 0.22, 0.18]), ellipses };
    } finally {
      if (previous === undefined) delete globalThis.OffscreenCanvas;
      else globalThis.OffscreenCanvas = previous;
    }
  }

  it('carves every interior glyph pixel of every cell, pip centres aside', () => {
    const shape = createShape('d6', DIE_RADIUS);
    const { atlas, ellipses } = rasterisedLabelAtlas(shape);
    const source = atlas.canvas.getContext('2d').getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE).data;
    const { data } = buildCarveAtlas(shape, atlas);

    const flat = [];
    shape.faces.forEach((face, f) => {
      const rect = atlas.rects[f];
      const x0 = Math.round(rect.u0 * ATLAS_SIZE);
      const x1 = Math.round(rect.u1 * ATLAS_SIZE);
      const y0 = Math.round((1 - rect.v1) * ATLAS_SIZE);
      const y1 = Math.round((1 - rect.v0) * ATLAS_SIZE);
      const w = x1 - x0;
      const h = y1 - y0;
      const mask = new Uint8Array(w * h);
      for (let j = 0; j < h; j += 1) {
        for (let i = 0; i < w; i += 1) {
          mask[j * w + i] = source[((y0 + j) * ATLAS_SIZE + x0 + i) * 4 + 3] >= 128 ? 1 : 0;
        }
      }
      const sdf = signedDistance(mask, w, h, 1, 1);
      const centres = ellipses
        .filter((e) => e.x >= x0 && e.x < x1 && e.y >= y0 && e.y < y1)
        .map((e) => [e.x - x0, e.y - y0]);

      for (let j = 0; j < h; j += 1) {
        for (let i = 0; i < w; i += 1) {
          const p = j * w + i;
          if (!Number.isFinite(sdf[p])) {
            flat.push({ face: f, i, j, why: 'NaN' });
            continue;
          }
          if (!mask[p] || sdf[p] > -1) continue;
          const outRow = ATLAS_SIZE - 1 - (y0 + j);
          const q = (outRow * ATLAS_SIZE + x0 + i) * 4;
          if (data[q] !== 128 || data[q + 1] !== 128 || data[q + 2] !== 255) continue;
          // The profile is stationary at the pip top, so its deepest samples
          // round to a flat byte over a couple of pixels around the centre.
          const nearCentre = centres.some(
            ([cx, cy]) => Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= 2,
          );
          if (!nearCentre) flat.push({ face: f, i, j, value: face.value, sdf: sdf[p] });
        }
      }
    });
    expect(flat).toEqual([]);
  });
});

describe('dice shader hook', () => {
  it('samples the carve atlas and dims the ambient term by the cavity', () => {
    expect(diceFragmentSource).toContain('uniform highp sampler2D uCarve;');
    expect(diceFragmentSource).toContain('uAmbient * hemi * ao * cavity');
    expect(floorFragmentSource).toContain('litColor(uColor, normalize(vNormal), 1.0, vWorldPos.z)');
  });
});
