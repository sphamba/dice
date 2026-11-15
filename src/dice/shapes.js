import { cross, dot, length, normalize, scale, sub } from '../math/vec3.js';

const PHI = (1 + Math.sqrt(5)) / 2;

export const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

// Die-shaped pentagonal trapezohedron: equal ring radii and every vertex on the
// circumsphere, which makes the kites right kites and keeps them exactly planar
// (r = cos(36 deg) * (z1 + z2) / (z2 - z1) * r). Height to width is 1.0056.
const D10_RING_RADIUS = Math.sqrt(44 + 20 * Math.sqrt(5));
const D10_RING_HEIGHT = 1;
const D10_APEX_HEIGHT = 5 + 2 * Math.sqrt(5);

const PLANE_EPS = 1e-9;

const CACHE = new Map();

const rect = () => [0, 0, 0];
const sub3 = (a, b) => sub(rect(), a, b);
const cross3 = (a, b) => cross(rect(), a, b);
const mul3 = (a, s) => scale(rect(), a, s);
const unit3 = (a) => normalize(rect(), a);

function orbit([x, y, z]) {
  const seen = new Set();
  const vertices = [];
  for (const axis of [[x, y, z], [z, x, y], [y, z, x]]) {
    for (let mask = 0; mask < 8; mask++) {
      const vertex = axis.map((c, i) => (c === 0 ? 0 : (mask >> i) & 1 ? -c : c));
      const key = vertex.map((c) => c.toFixed(12)).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      vertices.push(vertex);
    }
  }
  return vertices;
}

function d10Vertices() {
  const vertices = [
    [0, 0, D10_APEX_HEIGHT],
    [0, 0, -D10_APEX_HEIGHT],
  ];
  for (let k = 0; k < 5; k++) {
    const upper = (2 * Math.PI * k) / 5;
    const lower = upper + Math.PI / 5;
    vertices.push([
      D10_RING_RADIUS * Math.cos(upper),
      D10_RING_RADIUS * Math.sin(upper),
      D10_RING_HEIGHT,
    ]);
    vertices.push([
      D10_RING_RADIUS * Math.cos(lower),
      D10_RING_RADIUS * Math.sin(lower),
      -D10_RING_HEIGHT,
    ]);
  }
  return vertices;
}

const VERTEX_BUILDERS = {
  d4: () => [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ],
  d6: () => orbit([1, 1, 1]),
  d8: () => orbit([1, 0, 0]),
  d10: d10Vertices,
  d12: () => [...orbit([1, 1, 1]), ...orbit([0, 1 / PHI, PHI])],
  d20: () => orbit([0, 1, PHI]),
};

function newell(vertices, indices) {
  const n = [0, 0, 0];
  for (let k = 0; k < indices.length; k++) {
    const a = vertices[indices[k]];
    const b = vertices[indices[(k + 1) % indices.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

// A plane through three vertices that leaves every other vertex behind it, with
// the origin inside, is a face plane; enumerating vertex triples finds all faces.
function findFaceIndices(vertices) {
  const found = new Map();
  const count = vertices.length;
  for (let i = 0; i < count - 2; i++) {
    for (let j = i + 1; j < count - 1; j++) {
      for (let k = j + 1; k < count; k++) {
        let normal = unit3(cross3(sub3(vertices[j], vertices[i]), sub3(vertices[k], vertices[i])));
        if (length(normal) === 0) continue;
        let offset = dot(normal, vertices[i]);
        if (offset === 0) continue;
        if (offset < 0) {
          normal = mul3(normal, -1);
          offset = -offset;
        }
        const onFace = [];
        let outside = false;
        for (let m = 0; m < count; m++) {
          const side = dot(normal, vertices[m]) - offset;
          if (side > PLANE_EPS) {
            outside = true;
            break;
          }
          if (side >= -PLANE_EPS) onFace.push(m);
        }
        if (outside || onFace.length < 3) continue;
        found.set(onFace.join(','), { indices: onFace, normal });
      }
    }
  }
  return [...found.values()];
}

function orderPolygon(vertices, indices, normal) {
  const center = rect();
  for (const index of indices) {
    center[0] += vertices[index][0];
    center[1] += vertices[index][1];
    center[2] += vertices[index][2];
  }
  for (let c = 0; c < 3; c++) center[c] /= indices.length;

  const u = unit3(sub3(vertices[indices[0]], center));
  const v = cross3(normal, u);
  return [...indices].sort((a, b) => {
    const pa = sub3(vertices[a], center);
    const pb = sub3(vertices[b], center);
    return Math.atan2(dot(pa, v), dot(pa, u)) - Math.atan2(dot(pb, v), dot(pb, u));
  });
}

function buildFaces(vertices) {
  return findFaceIndices(vertices).map((face) => ({
    indices: orderPolygon(vertices, face.indices, face.normal),
    normal: face.normal,
  }));
}

// Signed tetrahedra from the origin give volume, center of mass and the second
// moment matrix; the inertia tensor is trace(M) * I - M.
function massProperties(vertices, faces) {
  let volume = 0;
  const moment = new Array(9).fill(0);
  const center = [0, 0, 0];
  for (const face of faces) {
    const a = vertices[face.indices[0]];
    for (let k = 1; k + 1 < face.indices.length; k++) {
      const b = vertices[face.indices[k]];
      const c = vertices[face.indices[k + 1]];
      const tetraVolume = dot(a, cross3(b, c)) / 6;
      if (tetraVolume === 0) continue;
      volume += tetraVolume;
      const sum = [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
      const corners = [a, b, c, sum];
      for (let r = 0; r < 3; r++) {
        for (let col = 0; col < 3; col++) {
          let value = 0;
          for (const corner of corners) value += corner[r] * corner[col];
          moment[r * 3 + col] += (tetraVolume * value) / 20;
        }
        center[r] += (tetraVolume * sum[r]) / 4;
      }
    }
  }
  for (let c = 0; c < 3; c++) center[c] /= volume;
  const trace = moment[0] + moment[4] + moment[8];
  const inertia = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 3; col++) {
      inertia[r * 3 + col] = (r === col ? trace : 0) - moment[r * 3 + col];
    }
  }
  return { volume, center, inertia };
}

function assignFaceValues(faces, firstValue) {
  const count = faces.length;
  const byNormal = faces
    .map((_, index) => index)
    .sort((x, y) => {
      const a = faces[x].normal;
      const b = faces[y].normal;
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    });
  const used = new Set();
  let pair = 0;
  for (const index of byNormal) {
    if (used.has(index)) continue;
    let opposite = -1;
    let best = 0;
    for (let j = 0; j < count; j++) {
      if (j === index || used.has(j)) continue;
      const alignment = dot(faces[index].normal, faces[j].normal);
      if (alignment < best) {
        best = alignment;
        opposite = j;
      }
    }
    faces[index].value = firstValue + pair;
    faces[opposite].value = firstValue + count - 1 - pair;
    used.add(index);
    used.add(opposite);
    pair++;
  }
}

function buildEdges(faces) {
  const edges = new Map();
  for (const face of faces) {
    for (let k = 0; k < face.indices.length; k++) {
      const i = face.indices[k];
      const j = face.indices[(k + 1) % face.indices.length];
      const key = i < j ? `${i},${j}` : `${j},${i}`;
      if (!edges.has(key)) edges.set(key, i < j ? [i, j] : [j, i]);
    }
  }
  return [...edges.values()].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

function buildEdgeDirs(edges, vertices) {
  const dirs = [];
  for (const [i, j] of edges) {
    const dir = unit3(sub3(vertices[j], vertices[i]));
    if (dirs.some((other) => Math.abs(dot(other, dir)) > 1 - 1e-9)) continue;
    const pivot = dir.find((c) => Math.abs(c) > 1e-12);
    if (pivot !== undefined && pivot < 0) {
      dir[0] = -dir[0];
      dir[1] = -dir[1];
      dir[2] = -dir[2];
    }
    dirs.push(dir);
  }
  return dirs;
}

function unitRadiusFactor(vertices) {
  let max = 0;
  for (const vertex of vertices) max = Math.max(max, length(vertex));
  return max > 0 ? 1 / max : 1;
}

function assemble(type, radius) {
  const vertices = VERTEX_BUILDERS[type]().map((vertex) => [...vertex]);
  const toUnit = unitRadiusFactor(vertices);
  for (let i = 0; i < vertices.length; i++) vertices[i] = mul3(vertices[i], toUnit);

  const faces = buildFaces(vertices);
  const start = massProperties(vertices, faces);
  for (let i = 0; i < vertices.length; i++) vertices[i] = sub3(vertices[i], start.center);
  const recenter = unitRadiusFactor(vertices);
  for (let i = 0; i < vertices.length; i++) vertices[i] = mul3(vertices[i], recenter);

  const mass = massProperties(vertices, faces);
  for (let i = 0; i < vertices.length; i++) vertices[i] = mul3(vertices[i], radius);

  const shapeFaces = faces.map((face) => ({
    indices: [...face.indices],
    normal: unit3(newell(vertices, face.indices)),
    value: 0,
  }));

  if (type === 'd4') {
    const vertexValues = vertices.map((_, index) => index + 1);
    for (const face of shapeFaces) {
      const missing = vertexValues.findIndex((_, index) => !face.indices.includes(index));
      face.value = vertexValues[missing];
    }
    return { vertexValues, shapeFaces, vertices, mass };
  }
  assignFaceValues(shapeFaces, type === 'd10' ? 0 : 1);
  return { shapeFaces, vertices, mass };
}

function freezeShape(shape) {
  for (const vertex of shape.vertices) Object.freeze(vertex);
  for (const face of shape.faces) {
    Object.freeze(face.indices);
    Object.freeze(face.normal);
    Object.freeze(face);
  }
  for (const dir of shape.edgeDirs) Object.freeze(dir);
  Object.freeze(shape.vertices);
  Object.freeze(shape.faces);
  Object.freeze(shape.edges);
  Object.freeze(shape.edgeDirs);
  Object.freeze(shape.inertia);
  if (shape.vertexValues) Object.freeze(shape.vertexValues);
  return Object.freeze(shape);
}

export function createShape(type, radius) {
  if (!Object.hasOwn(VERTEX_BUILDERS, type)) throw new Error(`unknown dice type: ${type}`);
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError(`invalid radius: ${radius}`);

  const key = `${type}|${radius}`;
  const cached = CACHE.get(key);
  if (cached) return cached;

  const { shapeFaces, vertices, mass, vertexValues } = assemble(type, radius);
  const edges = buildEdges(shapeFaces);
  const shape = {
    type,
    radius,
    vertices,
    faces: shapeFaces,
    edges,
    edgeDirs: buildEdgeDirs(edges, vertices),
    volume: mass.volume * radius ** 3,
    inertia: mass.inertia.map((value) => value * radius ** 5),
  };
  if (vertexValues) shape.vertexValues = vertexValues;
  const frozen = freezeShape(shape);
  CACHE.set(key, frozen);
  return frozen;
}
