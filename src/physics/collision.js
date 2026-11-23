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

function buildFrame(body) {
  const vertices = body.shape.coreVertices.map((vertex) =>
    vec3.add(vec(), vec3.transformQuat(vec(), vertex, body.orientation), body.position),
  );
  const velocities = vertices.map((vertex) =>
    vec3.add(
      vec(),
      body.linearVelocity,
      vec3.cross(vec(), body.angularVelocity, vec3.sub(vec(), vertex, body.position)),
    ),
  );
  const faces = body.shape.faces.map((face) => {
    const normal = vec3.transformQuat(vec(), face.normal, body.orientation);
    project(spanA, vertices, normal);
    // Own-frame span on this normal never changes with the partner, so pass 1 of the
    // SAT reads it instead of projecting the same core once per candidate pair.
    return { indices: face.indices, normal, min: spanA[0], max: spanA[1] };
  });
  const edges = body.shape.edges.map(([i, j]) => {
    const a = vertices[i];
    const b = vertices[j];
    return {
      a,
      b,
      dir: vec3.normalize(vec(), vec3.sub(vec(), b, a)),
      mid: vec3.scale(vec(), vec3.add(vec(), a, b), 0.5),
      halfLen: 0.5 * vec3.distance(a, b),
    };
  });
  const dirGroups = [];
  for (const edge of edges) {
    const group = dirGroups.find((candidate) => Math.abs(vec3.dot(candidate.dir, edge.dir)) > 1 - 1e-6);
    if (group) group.edges.push(edge);
    else dirGroups.push({ dir: Float64Array.from(edge.dir), edges: [edge] });
  }
  return { vertices, velocities, faces, dirGroups, edges };
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

  const axes = [];
  for (const ga of fa.dirGroups) {
    for (const gb of fb.dirGroups) {
      const dir = vec3.cross(vec(), ga.dir, gb.dir);
      if (vec3.lengthSq(dir) < EPS) continue;
      vec3.normalize(dir, dir);
      if (vec3.dot(dir, refDir) < 0) vec3.negate(dir, dir);
      project(spanA, fa.vertices, dir);
      project(spanB, fb.vertices, dir);
      const overlap = Math.min(spanA[1], spanB[1]) - Math.max(spanA[0], spanB[0]);
      if (-overlap > maxSep) maxSep = -overlap;
      if (maxSep > band) break;
      axes.push({ dir: Float64Array.from(dir), overlap, ga, gb });
    }
  }
  if (maxSep > band) return { face: bestFace, edge: null };

  let bestEdge = null;
  let bestEdgeDist = Infinity;
  const limit = Math.max(-bestOverlap, RECESS + SLOP);
  for (const axis of axes) {
    const dir = axis.dir;
    // The 3D edge distance is at least its projection: skip pairs that can neither
    // beat the face axis nor improve the best edge so far.
    if (-axis.overlap >= Math.min(limit, bestEdgeDist)) continue;
    for (const edgeA of axis.ga.edges) {
      for (const edgeB of axis.gb.edges) {
        const reach = Math.min(bestEdgeDist, limit);
        if (vec3.distance(edgeA.mid, edgeB.mid) - edgeA.halfLen - edgeB.halfLen >= reach) continue;
        if (Math.abs(vec3.dot(vec3.sub(vec(), edgeA.mid, edgeB.mid), dir)) >= reach) continue;
        const [ca, cb] = closestPoints(edgeA.a, edgeA.b, edgeB.a, edgeB.b);
        const dist = vec3.distance(ca, cb);
        if (dist < bestEdgeDist) {
          bestEdgeDist = dist;
          bestEdge = { normal: Float64Array.from(dir), ca: Float64Array.from(ca), cb: Float64Array.from(cb), dist };
        }
      }
    }
  }
  // Corner-involving pairs: at generic poses the closest core features are often a
  // vertex pair or a vertex against an edge, which the edge x edge axes miss.
  for (const va of fa.vertices) {
    for (const vb of fb.vertices) {
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
        if (vec3.distance(vertex, edge.mid) - edge.halfLen >= bestEdgeDist) continue;
        const point = closestVertexEdge(vertex, edge);
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
      vec3.cross(vec(), vec3.sub(vec(), next, current), vec3.sub(vec(), point, current)),
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

function closestVertexEdge(vertex, edge) {
  const ab = vec3.sub(vec(), edge.b, edge.a);
  const t = clamp(vec3.dot(vec3.sub(vec(), vertex, edge.a), ab) / Math.max(vec3.dot(ab, ab), EPS), 0, 1);
  return vec3.scaleAndAdd(vec(), edge.a, ab, t);
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

function closestPoints(p1, q1, p2, q2) {
  const d1 = vec3.sub(vec(), q1, p1);
  const d2 = vec3.sub(vec(), q2, p2);
  const r = vec3.sub(vec(), p1, p2);
  const a = vec3.dot(d1, d1);
  const e = vec3.dot(d2, d2);
  const f = vec3.dot(d2, r);
  let s = 0;
  let t = 0;
  if (a <= EPS && e <= EPS) {
    return [Float64Array.from(p1), Float64Array.from(p2)];
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
  return [
    vec3.scaleAndAdd(vec(), p1, d1, s),
    vec3.scaleAndAdd(vec(), p2, d2, t),
  ];
}

function addEdgeContact(contacts, a, b, hit, dt, recent) {
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
  if (recent.some((contact) => vec3.distance(contact.normal, contactNormal) < 1e-6)) return;
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
  const delta = vec3.sub(vec(), a.position, b.position);
  const reach = a.radius + b.radius + BROADPHASE_MARGIN;
  if (vec3.lengthSq(delta) > reach * reach) return;
  const length = vec3.length(delta);
  const refDir = length > 0 ? vec3.scale(vec(), delta, 1 / length) : Float64Array.from([0, 0, 1]);
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
  if (hit.edge) addEdgeContact(contacts, a, b, hit.edge, dt, contacts.slice(before));
}

export function detectContacts(world, dt) {
  if (!world.contacts) world.contacts = [];
  world.contacts.length = 0;
  const frames = new Map();
  const frameOf = (body) => {
    let frame = frames.get(body);
    if (!frame) {
      frame = buildFrame(body);
      frames.set(body, frame);
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
