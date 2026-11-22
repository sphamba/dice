import { describe, expect, it } from 'vitest';
import { DICE_TYPES, createShape } from './shapes.js';
import { BEVEL_RADIUS, DIE_RADIUS } from '../physics/body.js';

const RADIUS = 0.75;
const EPS = 1e-6;

const FACE_COUNT = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const OPPOSITE_SUM = { d6: 7, d8: 9, d10: 9, d12: 13, d20: 21 };
const FACE_VALUES = {
  d6: [1, 2, 3, 4, 5, 6],
  d8: [1, 2, 3, 4, 5, 6, 7, 8],
  d10: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  d12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  d20: Array.from({ length: 20 }, (_, i) => i + 1),
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const l = len(a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

function planeDistance(shape, face) {
  return dot(face.normal, shape.vertices[face.indices[0]]);
}

function newellNormal(vertices, indices) {
  const n = [0, 0, 0];
  for (let k = 0; k < indices.length; k++) {
    const a = vertices[indices[k]];
    const b = vertices[indices[(k + 1) % indices.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit(n);
}

function faceAreaCentroid(vertices, indices) {
  const origin = vertices[indices[0]];
  let area = 0;
  const acc = [0, 0, 0];
  for (let k = 1; k + 1 < indices.length; k++) {
    const a = vertices[indices[k]];
    const b = vertices[indices[k + 1]];
    const triArea = len(cross(sub(a, origin), sub(b, origin))) / 2;
    area += triArea;
    for (let c = 0; c < 3; c++) acc[c] += triArea * (origin[c] + a[c] + b[c]) / 3;
  }
  return { area, centroid: acc.map((v) => v / area) };
}

function volumeAndCenterOfMass(shape) {
  let volume = 0;
  const acc = [0, 0, 0];
  for (const face of shape.faces) {
    const d = planeDistance(shape, face);
    const { area, centroid } = faceAreaCentroid(shape.vertices, face.indices);
    volume += (area * d) / 3;
    for (let c = 0; c < 3; c++) acc[c] += area * d * centroid[c];
  }
  return { volume, center: acc.map((v) => (3 * v) / (4 * volume)) };
}

function oppositePairs(shape) {
  const pairs = [];
  const used = new Set();
  for (let k = 0; k < shape.faces.length; k++) {
    if (used.has(k)) continue;
    let opposite = -1;
    let best = 0;
    for (let j = 0; j < shape.faces.length; j++) {
      if (j === k || used.has(j)) continue;
      const d = dot(shape.faces[k].normal, shape.faces[j].normal);
      if (d < best) {
        best = d;
        opposite = j;
      }
    }
    used.add(k);
    used.add(opposite);
    pairs.push({ a: k, b: opposite, alignment: best });
  }
  return pairs;
}

describe('DICE_TYPES', () => {
  it('lists the supported dice', () => {
    expect(DICE_TYPES).toEqual(['d4', 'd6', 'd8', 'd10', 'd12', 'd20']);
  });
});

describe.each(DICE_TYPES)('%s', (type) => {
  const shape = createShape(type, RADIUS);

  it('reports its type and radius', () => {
    expect(shape.type).toBe(type);
    expect(shape.radius).toBe(RADIUS);
  });

  it('has a closed convex face structure', () => {
    expect(shape.faces).toHaveLength(FACE_COUNT[type]);
    expect(shape.vertices.length - shape.edges.length + shape.faces.length).toBe(2);

    const seen = new Set();
    for (const [i, j] of shape.edges) {
      expect(i).toBeLessThan(j);
      expect(seen.has(`${i},${j}`)).toBe(false);
      seen.add(`${i},${j}`);
    }

    const uses = new Map();
    for (const face of shape.faces) {
      expect(face.indices.length).toBeGreaterThanOrEqual(3);
      for (let k = 0; k < face.indices.length; k++) {
        const i = face.indices[k];
        const j = face.indices[(k + 1) % face.indices.length];
        const key = i < j ? `${i},${j}` : `${j},${i}`;
        uses.set(key, (uses.get(key) ?? 0) + 1);
      }
    }
    expect([...uses.keys()].sort()).toEqual([...seen].sort());
    expect([...uses.values()].every((n) => n === 2)).toBe(true);
  });

  it('has planar faces with outward normals and is convex', () => {
    for (const face of shape.faces) {
      expect(len(face.normal)).toBeCloseTo(1, 12);
      const d = planeDistance(shape, face);
      expect(d).toBeGreaterThan(0);
      for (const index of face.indices) {
        expect(Math.abs(dot(face.normal, shape.vertices[index]) - d)).toBeLessThan(EPS);
      }
      for (const vertex of shape.vertices) {
        expect(dot(face.normal, vertex) - d).toBeLessThan(EPS);
      }
      const winding = newellNormal(shape.vertices, face.indices);
      expect(dot(winding, face.normal)).toBeGreaterThan(1 - EPS);
    }
  });

  it('fits the circumscribed sphere and is centered on its center of mass', () => {
    const radii = shape.vertices.map(len);
    expect(Math.max(...radii)).toBeCloseTo(RADIUS, 9);
    expect(Math.abs(Math.max(...radii) - RADIUS)).toBeLessThan(1e-9);

    for (const vertex of shape.vertices) {
      expect(len(vertex)).toBeLessThanOrEqual(RADIUS + 1e-9);
    }

    const { volume, center } = volumeAndCenterOfMass(shape);
    expect(volume).toBeGreaterThan(0);
    expect(Math.abs(volume - shape.volume)).toBeLessThan(Math.abs(shape.volume) * 1e-9);
    expect(len(center)).toBeLessThan(1e-9);
  });

  it('has a symmetric positive definite inertia tensor', () => {
    const m = shape.inertia;
    expect(m).toHaveLength(9);
    expect(Math.abs(m[1] - m[3])).toBeLessThan(Math.abs(m[0]) * 1e-12);
    expect(Math.abs(m[2] - m[6])).toBeLessThan(Math.abs(m[0]) * 1e-12);
    expect(Math.abs(m[5] - m[7])).toBeLessThan(Math.abs(m[0]) * 1e-12);

    const minor2 = m[0] * m[4] - m[1] * m[3];
    const det =
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6]);
    expect(m[0]).toBeGreaterThan(0);
    expect(minor2).toBeGreaterThan(0);
    expect(det).toBeGreaterThan(0);
  });

  it('has unique unit edge directions', () => {
    expect(shape.edgeDirs.length).toBeGreaterThan(0);
    for (const dir of shape.edgeDirs) {
      expect(len(dir)).toBeCloseTo(1, 12);
    }
    for (let i = 0; i < shape.edgeDirs.length; i++) {
      for (let j = i + 1; j < shape.edgeDirs.length; j++) {
        expect(Math.abs(dot(shape.edgeDirs[i], shape.edgeDirs[j]))).toBeLessThan(1 - 1e-9);
      }
    }
    if (type === 'd6') expect(shape.edgeDirs).toHaveLength(3);
  });

  if (type !== 'd4') {
    it('numbers faces with opposite faces summing to the standard total', () => {
      const values = shape.faces.map((face) => face.value).sort((a, b) => a - b);
      expect(values).toEqual(FACE_VALUES[type]);

      const pairs = oppositePairs(shape);
      expect(pairs).toHaveLength(FACE_VALUES[type].length / 2);
      for (const { a, b, alignment } of pairs) {
        expect(alignment).toBeLessThan(-1 + 1e-9);
        expect(shape.faces[a].value + shape.faces[b].value).toBe(OPPOSITE_SUM[type]);
      }
    });
  }
});

describe('d6', () => {
  it('has the inertia tensor of a cube of the same edge length', () => {
    const shape = createShape('d6', RADIUS);
    const [i, j] = shape.edges[0];
    const edge = len(sub(shape.vertices[i], shape.vertices[j]));
    const expected = edge ** 5 / 6;
    const m = shape.inertia;
    for (const k of [0, 4, 8]) {
      expect(Math.abs(m[k] - expected) / expected).toBeLessThan(1e-9);
    }
    for (const k of [1, 2, 3, 5, 6, 7]) {
      expect(Math.abs(m[k])).toBeLessThan(expected * 1e-9);
    }
  });

  it('scales volume with the cube of the radius', () => {
    const small = createShape('d6', 1);
    const large = createShape('d6', 2);
    expect(Math.abs(large.volume - small.volume * 8) / (small.volume * 8)).toBeLessThan(1e-12);
  });
});

describe('d4', () => {
  const shape = createShape('d4', RADIUS);

  it('numbers vertices 1 to 4', () => {
    expect([...shape.vertexValues].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(shape.vertexValues).toHaveLength(shape.vertices.length);
  });

  it('gives each face the value of the vertex opposite to it', () => {
    for (const face of shape.faces) {
      const missing = shape.vertices.map((_, i) => i).filter((i) => !face.indices.includes(i));
      expect(missing).toHaveLength(1);
      expect(face.value).toBe(shape.vertexValues[missing[0]]);
    }
    expect(shape.faces.map((face) => face.value).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });
});

describe('createShape', () => {
  it('caches shapes per type and radius', () => {
    expect(createShape('d20', 1)).toBe(createShape('d20', 1));
    expect(createShape('d20', 1)).not.toBe(createShape('d20', 2));
    expect(createShape('d20', 1)).not.toBe(createShape('d12', 1));
  });

  it('returns a frozen shape', () => {
    const shape = createShape('d10', 1);
    expect(Object.isFrozen(shape)).toBe(true);
    expect(Object.isFrozen(shape.vertices)).toBe(true);
    expect(Object.isFrozen(shape.faces)).toBe(true);
    expect(Object.isFrozen(shape.faces[0])).toBe(true);
    expect(Object.isFrozen(shape.faces[0].indices)).toBe(true);
    expect(Object.isFrozen(shape.edges)).toBe(true);
    expect(Object.isFrozen(shape.edgeDirs)).toBe(true);
    expect(Object.isFrozen(shape.inertia)).toBe(true);
  });
});

describe('app die size', () => {
  it('gives the d6 a 12.8 mm edge at DIE_RADIUS', () => {
    const shape = createShape('d6', DIE_RADIUS);
    const [i, j] = shape.edges[0];
    const edge = len(sub(shape.vertices[i], shape.vertices[j]));
    expect(edge * 1000).toBeCloseTo(12.8, 9);
  });

  it('puts every shape exactly on the circumsphere of DIE_RADIUS', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      expect(Math.max(...shape.vertices.map(len)), type).toBeCloseTo(DIE_RADIUS, 9);
    }
  });
});

describe('coreVertices', () => {
  it('insets every vertex by the renderer bevel scale 1 - BEVEL_RADIUS / rho', () => {
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const rho = dot(shape.faces[0].normal, shape.vertices[shape.faces[0].indices[0]]);
      const inset = 1 - BEVEL_RADIUS / rho;
      expect(shape.coreVertices, type).toHaveLength(shape.vertices.length);
      shape.vertices.forEach((vertex, i) => {
        expect(shape.coreVertices[i][0], type).toBeCloseTo(vertex[0] * inset, 12);
        expect(shape.coreVertices[i][1], type).toBeCloseTo(vertex[1] * inset, 12);
        expect(shape.coreVertices[i][2], type).toBeCloseTo(vertex[2] * inset, 12);
      });
    }
  });

  it('freezes the core vertices with the shape', () => {
    const shape = createShape('d8', 1);
    expect(Object.isFrozen(shape.coreVertices)).toBe(true);
    expect(Object.isFrozen(shape.coreVertices[0])).toBe(true);
  });
});
