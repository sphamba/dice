import { BEVEL_RADIUS } from './body.js';
import * as vec3 from '../math/vec3.js';

// Speculative skin in meters: a vertex within this gap still generates a contact.
export const SLOP = 1e-4;

// Rounded dice touch when the gap between their inset cores reaches one bevel radius
// per die; core overlaps are shifted by this amount so the SAT scores the rounded
// surfaces and accepts them while they are still up to 2r apart.
const RECESS = 2 * BEVEL_RADIUS;

export const BROADPHASE_MARGIN = SLOP;

const EPS = 1e-12;

// Plane distances below this are treated as zero, so a micro-tilted edge that grazes a
// clip plane yields no crossing point instead of a spurious vertex far from the corner.
const CLIP_WELD = 1e-5;

const vec = () => new Float64Array(3);

const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

function boxPlanes(box) {
  const { W, H, D } = box;
  return [
    { normal: [0, 0, 1], offset: 0, surface: 'floor' },
    { normal: [0, 0, -1], offset: -D, surface: 'lid' },
    { normal: [1, 0, 0], offset: -W / 2, surface: 'wall' },
    { normal: [-1, 0, 0], offset: -W / 2, surface: 'wall' },
    { normal: [0, 1, 0], offset: -H / 2, surface: 'wall' },
    { normal: [0, -1, 0], offset: -H / 2, surface: 'wall' },
  ];
}

// Frames are reused per body: the buffers and the views into them are built once, so a
// step rebuilds the geometry in place instead of allocating a vector per vertex.
const FRAMES = new WeakMap();

let frameGeneration = 0;

const scratchLever = vec();
const scratchSpin = vec();

function createFrame(shape) {
  const count = shape.coreVertices.length;
  const vertexBuffer = new Float64Array(3 * count);
  const velocityBuffer = new Float64Array(3 * count);
  const vertices = [];
  const velocities = [];
  for (let index = 0; index < count; index += 1) {
    vertices.push(vertexBuffer.subarray(index * 3, index * 3 + 3));
    velocities.push(velocityBuffer.subarray(index * 3, index * 3 + 3));
  }
  return {
    shape,
    generation: -1,
    groupCount: 0,
    vertices,
    velocities,
    faces: shape.faces.map((face) => ({
      indices: face.indices,
      normal: new Float64Array(3),
      min: 0,
      max: 0,
    })),
    edges: shape.edges.map(() => ({
      a: null,
      b: null,
      dir: new Float64Array(3),
      mid: new Float64Array(3),
      halfLen: 0,
    })),
    dirGroups: [],
  };
}

function buildFrame(frame, body) {
  const { vertices, velocities, faces, edges, dirGroups } = frame;
  const core = body.shape.coreVertices;
  const { position, orientation, linearVelocity, angularVelocity } = body;
  for (let index = 0; index < core.length; index += 1) {
    const vertex = vertices[index];
    vec3.transformQuat(vertex, core[index], orientation);
    vec3.add(vertex, vertex, position);
    vec3.sub(scratchLever, vertex, position);
    vec3.cross(scratchSpin, angularVelocity, scratchLever);
    vec3.add(velocities[index], linearVelocity, scratchSpin);
  }
  for (let index = 0; index < faces.length; index += 1) {
    const face = faces[index];
    vec3.transformQuat(face.normal, body.shape.faces[index].normal, orientation);
    // Own-frame span on this normal never changes with the partner, so pass 1 of the
    // SAT reads it instead of projecting the same core once per candidate pair.
    project(spanA, vertices, face.normal);
    face.min = spanA[0];
    face.max = spanA[1];
  }
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    const [from, to] = body.shape.edges[index];
    edge.a = vertices[from];
    edge.b = vertices[to];
    vec3.sub(edge.dir, edge.b, edge.a);
    vec3.normalize(edge.dir, edge.dir);
    vec3.add(edge.mid, edge.a, edge.b);
    vec3.scale(edge.mid, edge.mid, 0.5);
    edge.halfLen = 0.5 * vec3.distance(edge.a, edge.b);
  }
  for (const group of dirGroups) group.edges.length = 0;
  let groupCount = 0;
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    let group = null;
    for (let candidate = 0; candidate < groupCount; candidate += 1) {
      if (Math.abs(vec3.dot(dirGroups[candidate].dir, edge.dir)) > 1 - 1e-6) {
        group = dirGroups[candidate];
        break;
      }
    }
    if (!group) {
      if (groupCount === dirGroups.length) dirGroups.push({ dir: new Float64Array(3), edges: [] });
      group = dirGroups[groupCount];
      groupCount += 1;
      vec3.copy(group.dir, edge.dir);
    }
    group.edges.push(edge);
  }
  frame.groupCount = groupCount;
}

function detectBox(world, body, frame, dt) {
  const planes = boxPlanes(world.box);
  for (let i = 0; i < frame.vertices.length; i += 1) {
    const point = frame.vertices[i];
    const velocity = frame.velocities[i];
    for (const plane of planes) {
      const distance = vec3.dot(plane.normal, point) - plane.offset;
      const approach = vec3.dot(plane.normal, velocity);
      const margin = (approach < 0 ? -approach * dt : 0) + SLOP + BEVEL_RADIUS;
      if (distance >= margin) continue;
      world.contacts.push({
        a: body,
        b: null,
        surface: plane.surface,
        point: vec3.scaleAndAdd(vec(), point, plane.normal, -BEVEL_RADIUS),
        normal: Float64Array.from(plane.normal),
        depth: BEVEL_RADIUS - distance,
      });
    }
  }
}

const spanA = new Float64Array(2);
const spanB = new Float64Array(2);

// Duplicate-normal radius of the edge contact dedupe, in meters.
const NORMAL_DUPLICATE = 1e-6;

const scratchDir = vec();
const scratchRefDir = vec();
const scratchDelta = vec();
const scratchSide = vec();
const scratchEdgeAxis = vec();
const scratchPointDelta = vec();
const scratchClosestA = vec();
const scratchClosestB = vec();
const scratchVertexEdge = vec();
const scratchEdgeVector = vec();

// Candidate axes of the cross-axis pass: a flat buffer plus parallel arrays, so a pair
// with a few hundred candidates reaches the edge scan without allocating.
let axisDir = new Float64Array(0);
let axisOverlap = new Float64Array(0);
let axisGroupA = [];
let axisGroupB = [];

function reserveAxes(count) {
  if (count <= axisOverlap.length) return;
  const size = Math.max(2 * axisOverlap.length, 256);
  const dir = new Float64Array(3 * size);
  dir.set(axisDir);
  axisDir = dir;
  const overlap = new Float64Array(size);
  overlap.set(axisOverlap);
  axisOverlap = overlap;
  axisGroupA.length = size;
  axisGroupB.length = size;
}

function project(out, vertices, dir) {
  const x = dir[0];
  const y = dir[1];
  const z = dir[2];
  let min = Infinity;
  let max = -Infinity;
  for (const vertex of vertices) {
    const value = x * vertex[0] + y * vertex[1] + z * vertex[2];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  out[0] = min;
  out[1] = max;
}

// Picks the closest face plane pair and the closest core edge pair of the two inset
// cores. Pass 1 measures the classic SAT separation over the face normals and the
// unique edge-cross axes; if the core hulls are farther apart than any rounded
// contact can bridge within this step, the exact feature scan is skipped. Pass 2
// enumerates every parallel edge pair per axis (the closest segments along a cross
// axis are not necessarily the support extremes) plus vertex/vertex, vertex/edge and
// vertex/face pairs, each pruned by a cheap distance bound. Axes are oriented along
// refDir so the support edges hug the other die.
function separatingAxis(fa, fb, refDir, band) {
  let bestFace = null;
  let bestOverlap = Infinity;
  let maxSep = -Infinity;
  const considerFace = (face, owner, opposite) => {
    project(spanA, opposite.vertices, face.normal);
    const overlap = Math.min(face.max, spanA[1]) - Math.max(face.min, spanA[0]);
    if (-overlap > maxSep) maxSep = -overlap;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestFace = { normal: face.normal, owner, overlap };
    }
  };
  for (const face of fa.faces) considerFace(face, 'a', fb);
  for (const face of fb.faces) considerFace(face, 'b', fa);
  // A face axis that separates the cores by more than the contact band settles the
  // pair on its own: the cross axes only feed maxSep, and the best face is fixed.
  if (maxSep > band) return { face: bestFace, edge: null };

  let axisCount = 0;
  for (let indexA = 0; indexA < fa.groupCount; indexA += 1) {
    const ga = fa.dirGroups[indexA];
    for (let indexB = 0; indexB < fb.groupCount; indexB += 1) {
      const gb = fb.dirGroups[indexB];
      const dir = vec3.cross(scratchDir, ga.dir, gb.dir);
      if (vec3.lengthSq(dir) < EPS) continue;
      vec3.normalize(dir, dir);
      if (vec3.dot(dir, refDir) < 0) vec3.negate(dir, dir);
      project(spanA, fa.vertices, dir);
      project(spanB, fb.vertices, dir);
      const overlap = Math.min(spanA[1], spanB[1]) - Math.max(spanA[0], spanB[0]);
      if (-overlap > maxSep) maxSep = -overlap;
      if (maxSep > band) break;
      reserveAxes(axisCount + 1);
      axisDir[axisCount * 3] = dir[0];
      axisDir[axisCount * 3 + 1] = dir[1];
      axisDir[axisCount * 3 + 2] = dir[2];
      axisOverlap[axisCount] = overlap;
      axisGroupA[axisCount] = ga;
      axisGroupB[axisCount] = gb;
      axisCount += 1;
    }
  }
  if (maxSep > band) return { face: bestFace, edge: null };

  let bestEdge = null;
  let bestEdgeDist = Infinity;
  const limit = Math.max(-bestOverlap, RECESS + SLOP);
  for (let index = 0; index < axisCount; index += 1) {
    // The 3D edge distance is at least its projection: skip pairs that can neither
    // beat the face axis nor improve the best edge so far.
    if (-axisOverlap[index] >= Math.min(limit, bestEdgeDist)) continue;
    const dir = vec3.set(
      scratchDir,
      axisDir[index * 3],
      axisDir[index * 3 + 1],
      axisDir[index * 3 + 2],
    );
    for (const edgeA of axisGroupA[index].edges) {
      for (const edgeB of axisGroupB[index].edges) {
        const reach = Math.min(bestEdgeDist, limit);
        const gapOrder = vec3.compareDistance(
          edgeA.mid,
          edgeB.mid,
          reach + edgeA.halfLen + edgeB.halfLen,
        );
        if (gapOrder === 1) continue;
        if (
          gapOrder === 0 &&
          vec3.distance(edgeA.mid, edgeB.mid) - edgeA.halfLen - edgeB.halfLen >= reach
        ) {
          continue;
        }
        vec3.sub(scratchDelta, edgeA.mid, edgeB.mid);
        if (Math.abs(vec3.dot(scratchDelta, dir)) >= reach) continue;
        closestPoints(scratchClosestA, scratchClosestB, edgeA.a, edgeA.b, edgeB.a, edgeB.b);
        if (vec3.compareDistance(scratchClosestA, scratchClosestB, bestEdgeDist) === 1) continue;
        const dist = vec3.distance(scratchClosestA, scratchClosestB);
        if (dist < bestEdgeDist) {
          bestEdgeDist = dist;
          bestEdge = {
            normal: Float64Array.from(dir),
            ca: Float64Array.from(scratchClosestA),
            cb: Float64Array.from(scratchClosestB),
            dist,
          };
        }
      }
    }
  }
  // Corner-involving pairs: at generic poses the closest core features are often a
  // vertex pair or a vertex against an edge, which the edge x edge axes miss.
  for (const va of fa.vertices) {
    for (const vb of fb.vertices) {
      if (vec3.compareDistance(va, vb, bestEdgeDist) === 1) continue;
      const dist = vec3.distance(va, vb);
      if (dist >= bestEdgeDist) continue;
      bestEdgeDist = dist;
      bestEdge = vertexEdgeHit(va, vb, va, vb, dist, refDir);
    }
  }
  for (const [vertexFrame, edgeFrame, swap] of [
    [fa, fb, false],
    [fb, fa, true],
  ]) {
    for (const vertex of vertexFrame.vertices) {
      for (const edge of edgeFrame.edges) {
        const gapOrder = vec3.compareDistance(vertex, edge.mid, bestEdgeDist + edge.halfLen);
        if (gapOrder === 1) continue;
        if (gapOrder === 0 && vec3.distance(vertex, edge.mid) - edge.halfLen >= bestEdgeDist) continue;
        const point = closestVertexEdge(scratchVertexEdge, vertex, edge);
        const dist = vec3.distance(vertex, point);
        if (dist >= bestEdgeDist) continue;
        bestEdgeDist = dist;
        bestEdge = swap
          ? vertexEdgeHit(vertex, point, point, vertex, dist, refDir)
          : vertexEdgeHit(vertex, point, vertex, point, dist, refDir);
      }
    }
  }
  // Separated corner resting against the other core's face interior: the face path
  // cannot own this case (its incident face lands far from the contact once the
  // cores stop overlapping), and no edge/vertex pair reaches the same distance.
  for (const [vertexFrame, faceFrame, swap] of [
    [fa, fb, false],
    [fb, fa, true],
  ]) {
    for (const vertex of vertexFrame.vertices) {
      for (const face of faceFrame.faces) {
        const dist = vec3.dot(face.normal, vertex) - vec3.dot(face.normal, faceFrame.vertices[face.indices[0]]);
        if (dist <= EPS || dist >= bestEdgeDist) continue;
        const point = vec3.scaleAndAdd(vec(), vertex, face.normal, -dist);
        if (!insidePolygon(point, face, faceFrame)) continue;
        bestEdgeDist = dist;
        bestEdge = swap
          ? vertexEdgeHit(vertex, point, point, vertex, dist, refDir)
          : vertexEdgeHit(vertex, point, vertex, point, dist, refDir);
      }
    }
  }
  if (!bestFace && !bestEdge) return null;
  return { face: bestFace, edge: bestEdge };
}

function insidePolygon(point, face, frame) {
  let positive = 0;
  let negative = 0;
  for (let i = 0; i < face.indices.length; i += 1) {
    const current = frame.vertices[face.indices[i]];
    const next = frame.vertices[face.indices[(i + 1) % face.indices.length]];
    const side = vec3.dot(
      vec3.cross(
        scratchSide,
        vec3.sub(scratchEdgeAxis, next, current),
        vec3.sub(scratchPointDelta, point, current),
      ),
      face.normal,
    );
    if (side > EPS) positive += 1;
    else if (side < -EPS) negative += 1;
  }
  return positive === 0 || negative === 0;
}

function vertexEdgeHit(vertex, edgePoint, ca, cb, dist, refDir) {
  const normal = dist > EPS ? vec3.scale(vec(), vec3.sub(vec(), ca, cb), 1 / dist) : Float64Array.from(refDir);
  if (vec3.dot(normal, refDir) < 0) vec3.negate(normal, normal);
  return { normal: Float64Array.from(normal), ca: Float64Array.from(ca), cb: Float64Array.from(cb), dist };
}

function closestVertexEdge(out, vertex, edge) {
  const ab = vec3.sub(scratchEdgeVector, edge.b, edge.a);
  const t = clamp(vec3.dot(vec3.sub(scratchPointDelta, vertex, edge.a), ab) / Math.max(vec3.dot(ab, ab), EPS), 0, 1);
  return vec3.scaleAndAdd(out, edge.a, ab, t);
}

function findFace(frame, target) {
  let best = null;
  let bestDot = -Infinity;
  for (const face of frame.faces) {
    const value = vec3.dot(face.normal, target);
    if (value > bestDot) {
      bestDot = value;
      best = face;
    }
  }
  return best;
}

function sidePlanes(faceVertices, normal) {
  const center = vec();
  for (const vertex of faceVertices) vec3.add(center, center, vertex);
  vec3.scale(center, center, 1 / faceVertices.length);
  const planes = [];
  for (let i = 0; i < faceVertices.length; i += 1) {
    const point = faceVertices[i];
    const next = faceVertices[(i + 1) % faceVertices.length];
    const edge = vec3.sub(vec(), next, point);
    const side = vec3.normalize(vec(), vec3.cross(vec(), edge, normal));
    if (vec3.lengthSq(side) < EPS) continue;
    if (vec3.dot(side, vec3.sub(vec(), center, point)) > 0) vec3.negate(side, side);
    planes.push({ normal: side, offset: vec3.dot(side, point) });
  }
  return planes;
}

const snapWeld = (distance) => (Math.abs(distance) <= CLIP_WELD ? 0 : distance);

function clipPolygon(polygon, planes) {
  let poly = polygon;
  for (const plane of planes) {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const current = poly[i];
      const next = poly[(i + 1) % poly.length];
      const dc = snapWeld(vec3.dot(plane.normal, current) - plane.offset);
      const dn = snapWeld(vec3.dot(plane.normal, next) - plane.offset);
      if (dc <= 0) out.push(current);
      if ((dc < 0 && dn > 0) || (dc > 0 && dn < 0)) {
        const t = dc / (dc - dn);
        out.push(vec3.lerp(vec(), current, next, t));
      }
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  return poly;
}

function addFaceContacts(contacts, a, b, normal, refFrame, incFrame, closing, dt) {
  const target = refFrame.owner === 'a' ? vec3.negate(vec(), normal) : Float64Array.from(normal);
  const refFace = findFace(refFrame.frame, target);
  const refVertices = refFace.indices.map((index) => refFrame.frame.vertices[index]);
  const refOffset = vec3.dot(refFace.normal, refVertices[0]);
  const incidentFace = findFace(incFrame, vec3.negate(vec(), refFace.normal));
  const polygon = incidentFace.indices.map((index) => incFrame.vertices[index]);
  const clipped = clipPolygon(polygon, sidePlanes(refVertices, refFace.normal));
  for (const point of clipped) {
    // Point sits midway between the two rounded surfaces, r outside each core face.
    const separation = vec3.dot(refFace.normal, point) - refOffset;
    if (separation > RECESS + SLOP + closing * dt) continue;
    contacts.push({
      a,
      b,
      surface: 'die',
      point: vec3.scaleAndAdd(vec(), point, refFace.normal, -separation / 2),
      normal: Float64Array.from(normal),
      depth: RECESS - separation,
    });
  }
}

function closestPoints(outA, outB, p1, q1, p2, q2) {
  const d1 = vec3.sub(scratchEdgeAxis, q1, p1);
  const d2 = vec3.sub(scratchEdgeVector, q2, p2);
  const r = vec3.sub(scratchPointDelta, p1, p2);
  const a = vec3.dot(d1, d1);
  const e = vec3.dot(d2, d2);
  const f = vec3.dot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= EPS && e <= EPS) {
    vec3.copy(outA, p1);
    vec3.copy(outB, p2);
    return;
  }
  if (a <= EPS) {
    t = clamp(f / e, 0, 1);
  } else {
    const c = vec3.dot(d1, r);
    if (e <= EPS) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = vec3.dot(d1, d2);
      const denom = a * e - b * b;
      if (denom !== 0) s = clamp((b * f - c * e) / denom, 0, 1);
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  vec3.scaleAndAdd(outA, p1, d1, s);
  vec3.scaleAndAdd(outB, p2, d2, t);
}

function addEdgeContact(contacts, a, b, hit, dt, before) {
  const normal = hit.normal;
  const { ca, cb } = hit;
  const coreGap = vec3.distance(ca, cb);
  const velocityA = vec3.add(
    vec(),
    a.linearVelocity,
    vec3.cross(vec(), a.angularVelocity, vec3.sub(vec(), ca, a.position)),
  );
  const velocityB = vec3.add(
    vec(),
    b.linearVelocity,
    vec3.cross(vec(), b.angularVelocity, vec3.sub(vec(), cb, b.position)),
  );
  const towards = coreGap > EPS ? vec3.scale(vec(), vec3.sub(vec(), cb, ca), 1 / coreGap) : vec3.negate(vec(), normal);
  const closing = Math.max(0, -vec3.dot(vec3.sub(vec(), velocityB, velocityA), towards));
  if (coreGap >= RECESS + SLOP + closing * dt) return;
  // The cross axis is degenerate when perpendicular edges meet near a corner; the true
  // gap direction between the closest points is always a valid contact normal.
  const contactNormal = coreGap > EPS ? vec3.negate(vec(), towards) : Float64Array.from(normal);
  for (let index = before; index < contacts.length; index += 1) {
    const existing = contacts[index];
    const order = vec3.compareDistance(existing.normal, contactNormal, NORMAL_DUPLICATE);
    if (order === -1) return;
    if (order === 0 && vec3.distance(existing.normal, contactNormal) < NORMAL_DUPLICATE) return;
  }
  contacts.push({
    a,
    b,
    surface: 'die',
    point: vec3.scale(vec(), vec3.add(vec(), ca, cb), 0.5),
    normal: Float64Array.from(contactNormal),
    // Core-edge distance mapped onto the rounded surfaces: surface gap = coreGap - 2r.
    depth: RECESS - coreGap,
  });
}

function detectPair(contacts, a, b, fa, fb, dt) {
  const delta = vec3.sub(scratchDelta, a.position, b.position);
  const reach = a.radius + b.radius + BROADPHASE_MARGIN;
  if (vec3.lengthSq(delta) > reach * reach) return;
  const length = vec3.length(delta);
  const refDir = length > 0 ? vec3.scale(scratchRefDir, delta, 1 / length) : vec3.set(scratchRefDir, 0, 0, 1);
  // Widest closing the pair can reach this step; the speculative contact band grows
  // with it, so the SAT gate never eats a contact addEdgeContact would fire.
  const closing = vec3.distance(a.linearVelocity, b.linearVelocity)
    + vec3.length(a.angularVelocity) * a.radius
    + vec3.length(b.angularVelocity) * b.radius;
  const hit = separatingAxis(fa, fb, refDir, RECESS + SLOP + closing * dt);
  if (!hit) return;

  const before = contacts.length;
  if (hit.face) {
    const normal = Float64Array.from(hit.face.normal);
    if (vec3.dot(normal, refDir) < 0) vec3.negate(normal, normal);
    const refFrame = hit.face.owner === 'a' ? { owner: 'a', frame: fa } : { owner: 'b', frame: fb };
    const incident = hit.face.owner === 'a' ? fb : fa;
    addFaceContacts(contacts, a, b, normal, refFrame, incident, closing, dt);
  }
  // The closest core feature pair adds the true contact when the clipped polygon
  // only describes a different, shallower region of the rounded shells.
  if (hit.edge) addEdgeContact(contacts, a, b, hit.edge, dt, before);
}

export function detectContacts(world, dt) {
  if (!world.contacts) world.contacts = [];
  world.contacts.length = 0;
  frameGeneration += 1;
  const frameOf = (body) => {
    let frame = FRAMES.get(body);
    if (!frame || frame.shape !== body.shape) {
      frame = createFrame(body.shape);
      FRAMES.set(body, frame);
    }
    if (frame.generation !== frameGeneration) {
      frame.generation = frameGeneration;
      buildFrame(frame, body);
    }
    return frame;
  };

  for (const body of world.bodies) {
    if (body.shape?.vertices) detectBox(world, body, frameOf(body), dt);
  }
  const bodies = world.bodies.filter((body) => body.shape?.vertices);
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) {
      const a = bodies[i];
      const b = bodies[j];
      detectPair(world.contacts, a, b, frameOf(a), frameOf(b), dt);
    }
  }
  return world.contacts;
}
