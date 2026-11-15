import * as vec3 from '../math/vec3.js';

// Speculative skin in meters: a vertex within this gap still generates a contact.
export const SLOP = 1e-4;

// Edge axes must beat the best face axis by this factor to win, which keeps resting
// faces on face contacts instead of flipping to an edge pair.
export const EDGE_BIAS = 1.05;

export const BROADPHASE_MARGIN = SLOP;

const EPS = 1e-12;

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
  const vertices = body.shape.vertices.map((vertex) =>
    vec3.add(vec(), vec3.transformQuat(vec(), vertex, body.orientation), body.position),
  );
  const velocities = vertices.map((vertex) =>
    vec3.add(
      vec(),
      body.linearVelocity,
      vec3.cross(vec(), body.angularVelocity, vec3.sub(vec(), vertex, body.position)),
    ),
  );
  const faces = body.shape.faces.map((face) => ({
    indices: face.indices,
    normal: vec3.transformQuat(vec(), face.normal, body.orientation),
  }));
  const edgeDirs = body.shape.edgeDirs.map((dir) =>
    vec3.transformQuat(vec(), dir, body.orientation),
  );
  const edges = body.shape.edges.map(([i, j]) => {
    const a = vertices[i];
    const b = vertices[j];
    return {
      a,
      b,
      dir: vec3.normalize(vec(), vec3.sub(vec(), b, a)),
      mid: vec3.scale(vec(), vec3.add(vec(), a, b), 0.5),
    };
  });
  return { vertices, velocities, faces, edgeDirs, edges };
}

function detectBox(world, body, frame, dt) {
  const planes = boxPlanes(world.box);
  for (let i = 0; i < frame.vertices.length; i += 1) {
    const point = frame.vertices[i];
    const velocity = frame.velocities[i];
    for (const plane of planes) {
      const distance = vec3.dot(plane.normal, point) - plane.offset;
      const approach = vec3.dot(plane.normal, velocity);
      const margin = (approach < 0 ? -approach * dt : 0) + SLOP;
      if (distance >= margin) continue;
      world.contacts.push({
        a: body,
        b: null,
        surface: plane.surface,
        point: Float64Array.from(point),
        normal: Float64Array.from(plane.normal),
        depth: -distance,
      });
    }
  }
}

function project(frame, dir) {
  let min = Infinity;
  let max = -Infinity;
  for (const vertex of frame.vertices) {
    const value = vec3.dot(vertex, dir);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function separatingAxis(fa, fb) {
  let bestScore = Infinity;
  let bestDepth = 0;
  let bestNormal = null;
  let bestOwner = null;
  let bestEdges = null;

  const consider = (dir, owner, edges) => {
    const [minA, maxA] = project(fa, dir);
    const [minB, maxB] = project(fb, dir);
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return false;
    const score = edges ? overlap * EDGE_BIAS : overlap;
    if (score < bestScore) {
      bestScore = score;
      bestDepth = overlap;
      bestNormal = dir;
      bestOwner = owner;
      bestEdges = edges;
    }
    return true;
  };

  for (const face of fa.faces) if (!consider(face.normal, fa, null)) return null;
  for (const face of fb.faces) if (!consider(face.normal, fb, null)) return null;
  for (const da of fa.edgeDirs) {
    for (const db of fb.edgeDirs) {
      const dir = vec3.normalize(vec(), vec3.cross(vec(), da, db));
      if (vec3.lengthSq(dir) < EPS) continue;
      if (!consider(dir, null, { da, db })) return null;
    }
  }
  if (!bestNormal) return null;
  return { normal: bestNormal, depth: bestDepth, owner: bestOwner, edges: bestEdges };
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

function clipPolygon(polygon, planes) {
  let poly = polygon;
  for (const plane of planes) {
    const out = [];
    for (let i = 0; i < poly.length; i += 1) {
      const current = poly[i];
      const next = poly[(i + 1) % poly.length];
      const dc = vec3.dot(plane.normal, current) - plane.offset;
      const dn = vec3.dot(plane.normal, next) - plane.offset;
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

function addFaceContacts(contacts, a, b, normal, refFrame, incFrame) {
  const target = refFrame.owner === 'a' ? vec3.negate(vec(), normal) : Float64Array.from(normal);
  const refFace = findFace(refFrame.frame, target);
  const refVertices = refFace.indices.map((index) => refFrame.frame.vertices[index]);
  const refOffset = vec3.dot(refFace.normal, refVertices[0]);
  const incidentFace = findFace(incFrame, vec3.negate(vec(), refFace.normal));
  const polygon = incidentFace.indices.map((index) => incFrame.vertices[index]);
  const clipped = clipPolygon(polygon, sidePlanes(refVertices, refFace.normal));
  const points = clipped.length > 0 ? clipped : [polygon[0]];
  for (const point of points) {
    const separation = vec3.dot(refFace.normal, point) - refOffset;
    if (separation > SLOP) continue;
    contacts.push({
      a,
      b,
      surface: 'die',
      point: Float64Array.from(point),
      normal: Float64Array.from(normal),
      depth: -separation,
    });
  }
}

function supportEdge(frame, dir, normal, preferLow) {
  let best = null;
  let bestValue = preferLow ? Infinity : -Infinity;
  for (const edge of frame.edges) {
    if (Math.abs(vec3.dot(edge.dir, dir)) < 1 - 1e-6) continue;
    const value = vec3.dot(edge.mid, normal);
    if (preferLow ? value < bestValue : value > bestValue) {
      bestValue = value;
      best = edge;
    }
  }
  return best;
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

function addEdgeContact(contacts, a, b, hit, fa, fb) {
  const normal = hit.normal;
  const edgeA = supportEdge(fa, hit.edges.da, normal, true);
  const edgeB = supportEdge(fb, hit.edges.db, normal, false);
  if (!edgeA || !edgeB) return;
  const [ca, cb] = closestPoints(edgeA.a, edgeA.b, edgeB.a, edgeB.b);
  contacts.push({
    a,
    b,
    surface: 'die',
    point: vec3.scale(vec(), vec3.add(vec(), ca, cb), 0.5),
    normal: Float64Array.from(normal),
    depth: hit.depth,
  });
}

function detectPair(contacts, a, b, fa, fb) {
  const delta = vec3.sub(vec(), a.position, b.position);
  const reach = a.radius + b.radius + BROADPHASE_MARGIN;
  if (vec3.lengthSq(delta) > reach * reach) return;
  const hit = separatingAxis(fa, fb);
  if (!hit) return;
  const normal = Float64Array.from(hit.normal);
  if (vec3.dot(delta, normal) < 0) vec3.negate(normal, normal);

  if (hit.edges) {
    addEdgeContact(contacts, a, b, { ...hit, normal }, fa, fb);
    return;
  }
  const owner = hit.owner === fa ? { owner: 'a', frame: fa } : { owner: 'b', frame: fb };
  const incident = hit.owner === fa ? fb : fa;
  addFaceContacts(contacts, a, b, normal, owner, incident);
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
      detectPair(world.contacts, a, b, frameOf(a), frameOf(b));
    }
  }
  return world.contacts;
}
