import { describe, expect, it } from 'vitest';
import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';
import { DICE_TYPES, createShape } from '../dice/shapes.js';
import { faceFrame, faceInsetData, toFace2D } from '../dice/labels.js';
import { BEVEL_RADIUS, DIE_RADIUS } from '../physics/body.js';
import { convexHull2D, pointHullDistance2D, projectedInsetHull } from './renderer.js';
import { aoPrepassFragmentSource, diceFragmentSource } from './shaders.js';

// JS copy of the shader bevel functions (shaders.js), identity model matrix.
function insetOffset(p, inset) {
  let bestD2 = Infinity;
  let best = [0, 0];
  let minCr = Infinity;
  for (let k = 0; k < 5; k += 1) {
    const a = inset[k];
    const b = inset[(k + 1) % 5];
    const e = [b[0] - a[0], b[1] - a[1]];
    const w = [p[0] - a[0], p[1] - a[1]];
    const t = Math.min(
      Math.max((w[0] * e[0] + w[1] * e[1]) / Math.max(e[0] * e[0] + e[1] * e[1], 1e-12), 0),
      1,
    );
    const d = [w[0] - t * e[0], w[1] - t * e[1]];
    const d2 = d[0] * d[0] + d[1] * d[1];
    if (d2 < bestD2) {
      bestD2 = d2;
      best = d;
    }
    minCr = Math.min(minCr, e[0] * w[1] - e[1] * w[0]);
  }
  return minCr >= 0 ? [0, 0] : best;
}

function bevelNormal(shape, data, f, p) {
  const N = shape.faces[f].normal;
  const T = data[f].right;
  const B = vec3.cross(vec3.create(), N, T);
  const q = insetOffset(p, data[f].inset);
  const len = Math.hypot(q[0], q[1], BEVEL_RADIUS);
  const nx = q[0] / len;
  const ny = q[1] / len;
  const nz = BEVEL_RADIUS / len;
  const world = [
    T[0] * nx + B[0] * ny + N[0] * nz,
    T[1] * nx + B[1] * ny + N[1] * nz,
    T[2] * nx + B[2] * ny + N[2] * nz,
  ];
  // Float64 division: vec3.normalize would round through a Float32Array.
  const l = Math.hypot(world[0], world[1], world[2]);
  return [world[0] / l, world[1] / l, world[2] / l];
}

describe('bevel normal (JS mirror of the shader)', () => {
  it('gives the face normal at the middle of every face', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const data = faceInsetData(shape, BEVEL_RADIUS);
      shape.faces.forEach((face, f) => {
        const n = bevelNormal(shape, data, f, [0, 0]);
        expect(n[0]).toBeCloseTo(face.normal[0], 9);
        expect(n[1]).toBeCloseTo(face.normal[1], 9);
        expect(n[2]).toBeCloseTo(face.normal[2], 9);
      });
    }
  });

  it('gives the two-face bisector at every edge midpoint, from both faces', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const data = faceInsetData(shape, BEVEL_RADIUS);
      shape.faces.forEach((face, f) => {
        face.indices.forEach((vi, k) => {
          const vj = face.indices[(k + 1) % face.indices.length];
          const g = shape.faces.findIndex(
            (o) => o !== face && o.indices.includes(vi) && o.indices.includes(vj),
          );
          expect(g).toBeGreaterThanOrEqual(0);
          const bisector = vec3.normalize(
            vec3.create(),
            vec3.add(vec3.create(), face.normal, shape.faces[g].normal),
          );
          const pA = [
            (data[f].face2D[k][0] + data[f].face2D[(k + 1) % face.indices.length][0]) / 2,
            (data[f].face2D[k][1] + data[f].face2D[(k + 1) % face.indices.length][1]) / 2,
          ];
          const nA = bevelNormal(shape, data, f, pA);
          const world = [
            (shape.vertices[vi][0] + shape.vertices[vj][0]) / 2,
            (shape.vertices[vi][1] + shape.vertices[vj][1]) / 2,
            (shape.vertices[vi][2] + shape.vertices[vj][2]) / 2,
          ];
          const nB = bevelNormal(shape, data, g, toFace2D(faceFrame(shape, shape.faces[g]), world));
          for (const n of [nA, nB]) {
            expect(n[0]).toBeCloseTo(bisector[0], 6);
            expect(n[1]).toBeCloseTo(bisector[1], 6);
            expect(n[2]).toBeCloseTo(bisector[2], 6);
          }
        });
      });
    }
  });
});

describe('inset hull helpers', () => {
  const model = mat4.fromRotationTranslation(mat4.create(), [0, 0, 0, 1], [0.01, -0.02, 0.005]);

  function d6Hull() {
    const shape = createShape('d6', DIE_RADIUS);
    const data = faceInsetData(shape, BEVEL_RADIUS);
    return { shape, hull: projectedInsetHull(shape, model, data[0].scale) };
  }

  it('builds the CCW inset top square for a flat-lying d6', () => {
    const { hull } = d6Hull();
    const half = DIE_RADIUS / Math.sqrt(3) - BEVEL_RADIUS;
    const expected = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) expected.push([0.01 + sx * half, -0.02 + sy * half]);
    }
    expect(hull).toHaveLength(4);
    for (const p of hull) {
      // mat4 state is Float32Array: corner coordinates carry ~2e-9 rounding.
      const match = expected.find(
        (e) => Math.abs(e[0] - p[0]) < 1e-7 && Math.abs(e[1] - p[1]) < 1e-7,
      );
      expect(match).toBeDefined();
    }
    let area = 0;
    for (let k = 0; k < hull.length; k += 1) {
      area += hull[k][0] * hull[(k + 1) % hull.length][1] - hull[k][1] * hull[(k + 1) % hull.length][0];
    }
    expect(area).toBeGreaterThan(0);
  });

  it('measures zero inside the hull and the segment distance outside', () => {
    const { hull } = d6Hull();
    expect(pointHullDistance2D(hull, [0.01, -0.02])).toBe(0);
    // The sharp cube silhouette sits exactly one bevel radius outside the hull.
    expect(pointHullDistance2D(hull, [0.01 + DIE_RADIUS / Math.sqrt(3), -0.02])).toBeCloseTo(
      BEVEL_RADIUS,
      8,
    );
    const square = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    expect(pointHullDistance2D(square, [0.9, 0.9])).toBe(0);
    expect(pointHullDistance2D(square, [2, 0])).toBeCloseTo(1, 12);
    expect(pointHullDistance2D(square, [2, 3])).toBeCloseTo(Math.sqrt(5), 12);
  });

  it('drops interior and collinear points', () => {
    const hull = convexHull2D([
      [0, 0],
      [2, 0],
      [4, 0],
      [4, 4],
      [2, 2],
      [0, 4],
    ]);
    expect(hull).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
  });
});

// JS copy of the shader bevelDrop: height of the emulated rounded surface
// below the face plane at inset offset q.
function bevelDrop(q, r) {
  return r - Math.sqrt(Math.max(r * r - (q[0] * q[0] + q[1] * q[1]), 0));
}

describe('rounded surface depth (emulated displacement)', () => {
  it('drops 0 at |q| = 0, r at |q| = r, and clamps to r beyond the band', () => {
    expect(bevelDrop([0, 0], BEVEL_RADIUS)).toBe(0);
    expect(bevelDrop([BEVEL_RADIUS, 0], BEVEL_RADIUS)).toBeCloseTo(BEVEL_RADIUS, 15);
    expect(bevelDrop([0, BEVEL_RADIUS], BEVEL_RADIUS)).toBeCloseTo(BEVEL_RADIUS, 15);
    expect(bevelDrop([2 * BEVEL_RADIUS, 0], BEVEL_RADIUS)).toBeCloseTo(BEVEL_RADIUS, 15);
  });

  it('follows the tangent sphere in between', () => {
    const half = BEVEL_RADIUS / 2;
    expect(bevelDrop([half, 0], BEVEL_RADIUS)).toBeCloseTo(BEVEL_RADIUS * (1 - Math.sqrt(3) / 2), 15);
  });

  it('writes the rounded depth, clamps the band, and never discards band fragments', () => {
    for (const [name, source] of [
      ['dice', diceFragmentSource],
      ['aoPrepass', aoPrepassFragmentSource],
    ]) {
      expect(source, name).toContain('gl_FragDepth =');
      expect(source, name).toContain('bevelDrop(q)');
      expect(source, name).not.toContain('dot(q, q) > uBevelRadius');
      expect(source, name).toContain('sqrt(max(');
      expect(source, name).toContain('min(1.0, uBevelRadius * inversesqrt(max(dot(q, q), 1e-12)))');
    }
    // The hull outline stays the only transparency test: the sharp mesh covers
    // every interior pixel exactly once, so a band discard punches holes.
    expect(aoPrepassFragmentSource).toContain('if (hullDistance(vWorldPos.xy) > uBevelRadius) discard;');
    // The forward pass drops fully uncovered outline fragments itself: alpha to
    // coverage does nothing on a single-sample drawing buffer.
    expect(diceFragmentSource.match(/discard;/g), 'one silhouette discard').toHaveLength(1);
    expect(diceFragmentSource).toContain('if (alpha <= 0.0) discard;');
  });
});

describe('face inset scale', () => {
  it('is one common scale per die type, so face 0 serves every face', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const data = faceInsetData(shape, BEVEL_RADIUS);
      const face0 = shape.faces[0];
      const rho = vec3.dot(shape.vertices[face0.indices[0]], face0.normal);
      shape.faces.forEach((face, f) => {
        const faceRho = vec3.dot(shape.vertices[face.indices[0]], face.normal);
        expect(faceRho).toBeCloseTo(rho, 12);
        expect(data[f].scale).toBeCloseTo(1 - BEVEL_RADIUS / rho, 12);
      });
    }
  });
});
