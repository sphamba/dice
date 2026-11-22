import * as vec3 from '../math/vec3.js';
import { applyImpulse } from './body.js';

export const SOLVER_ITERATIONS = 10;

export const RESTITUTION_THRESHOLD = 0.1;

export const RESTITUTION_BOX = 0.5;

export const RESTITUTION_DIE = 0.5;

export const FRICTION_FLOOR = 0.4;

export const FRICTION_WALL = 0.4;

export const FRICTION_LID = 0.1;

export const FRICTION_DIE = 0.1;

const FRICTION_BY_SURFACE = {
  floor: FRICTION_FLOOR,
  wall: FRICTION_WALL,
  lid: FRICTION_LID,
};

export const BAUMGARTE = 0.2;

export const SLOP = 0.0002;

export const MAX_BIAS_SPEED = 1;

export const EVENT_MIN_SPEED = 0.05;

export const WARM_START_DISTANCE = 0.001;

export const WARM_START_NORMAL_DOT = 0.99;

const AXIS_X = Float64Array.from([1, 0, 0]);

const AXIS_Z = Float64Array.from([0, 0, 1]);

const vec = () => new Float64Array(3);

const scratchSpin = vec();
const scratchVelocityA = vec();
const scratchVelocityB = vec();
const scratchRelative = vec();
const scratchImpulse = vec();

function pointVelocity(out, body, lever) {
  if (!body) return vec3.set(out, 0, 0, 0);
  return vec3.add(out, body.linearVelocity, vec3.cross(scratchSpin, body.angularVelocity, lever));
}

function relativeVelocity(out, contact) {
  pointVelocity(scratchVelocityA, contact.a, contact.ra);
  pointVelocity(scratchVelocityB, contact.b, contact.rb);
  return vec3.sub(out, scratchVelocityA, scratchVelocityB);
}

function angularTerm(body, lever, direction) {
  if (!body) return 0;
  vec3.cross(scratchSpin, lever, direction);
  vec3.transformMat3(scratchSpin, scratchSpin, body.invInertiaWorld);
  vec3.cross(scratchSpin, scratchSpin, lever);
  return vec3.dot(scratchSpin, direction);
}

function effectiveMass(contact, direction) {
  let inverse = 0;
  if (contact.a) inverse += contact.a.invMass + angularTerm(contact.a, contact.ra, direction);
  if (contact.b) inverse += contact.b.invMass + angularTerm(contact.b, contact.rb, direction);
  return inverse > 0 ? 1 / inverse : 0;
}

function tangentBasis(first, second, normal) {
  vec3.cross(first, normal, Math.abs(normal[2]) < 0.9 ? AXIS_Z : AXIS_X);
  vec3.normalize(first, first);
  return vec3.cross(second, normal, first);
}

function prepare(contact, dt, cache) {
  const a = contact.a;
  const b = contact.b ?? null;
  const point = Float64Array.from(contact.point);
  const normal = Float64Array.from(contact.normal);
  const tangents = [vec(), vec()];
  tangentBasis(tangents[0], tangents[1], normal);

  const prepared = {
    a,
    b,
    surface: contact.surface,
    point,
    ra: vec3.sub(vec(), point, a.position),
    rb: b ? vec3.sub(vec(), point, b.position) : vec(),
    friction: b ? FRICTION_DIE : FRICTION_BY_SURFACE[contact.surface] ?? FRICTION_FLOOR,
    approach: 0,
    target: 0,
    normal: { direction: normal, impulse: 0 },
    tangents: tangents.map((direction) => ({ direction, impulse: 0 })),
  };
  prepared.normal.mass = effectiveMass(prepared, normal);
  for (const tangent of prepared.tangents) {
    tangent.mass = effectiveMass(prepared, tangent.direction);
  }

  relativeVelocity(scratchRelative, prepared);
  const normalSpeed = vec3.dot(scratchRelative, normal);
  prepared.approach = -normalSpeed;
  // A contact that persisted from the previous step is resting or rocking. Restitution there
  // only feeds the rocking mode, so it applies to a fresh contact alone.
  const fresh = findCached(cache, contact) === null;
  const bounce =
    fresh && prepared.approach > RESTITUTION_THRESHOLD
      ? (b ? RESTITUTION_DIE : RESTITUTION_BOX) * prepared.approach
      : 0;
  const depth = contact.depth ?? 0;
  prepared.target = depth < 0
    ? (bounce > 0 ? bounce : depth / dt)
    : bounce + Math.min((BAUMGARTE * Math.max(depth - SLOP, 0)) / dt, MAX_BIAS_SPEED);
  return prepared;
}

function findCached(cache, contact) {
  if (!cache) return null;
  for (const cached of cache) {
    if (cached.a !== contact.a || cached.b !== contact.b) continue;
    if (cached.surface !== contact.surface) continue;
    if (vec3.dot(cached.normal.direction, contact.normal) <= WARM_START_NORMAL_DOT) continue;
    if (vec3.distance(cached.point, contact.point) > WARM_START_DISTANCE) continue;
    return cached;
  }
  return null;
}

// Impulses a new contact carries over from the previous step of the same contact.
export function warmStartImpulses(cache, contact, friction) {
  const cached = findCached(cache, contact);
  if (!cached) return { normal: 0, tangents: [0, 0] };
  const normalImpulse = Math.max(cached.normal.impulse, 0);
  const first = vec();
  const second = vec();
  tangentBasis(first, second, contact.normal);
  const previous = vec();
  for (const tangent of cached.tangents) {
    vec3.scaleAndAdd(previous, previous, tangent.direction, tangent.impulse);
  }
  const tangents = [vec3.dot(previous, first), vec3.dot(previous, second)];
  const limit = friction * normalImpulse;
  const magnitude = Math.hypot(tangents[0], tangents[1]);
  if (magnitude > limit) {
    tangents[0] *= limit / magnitude;
    tangents[1] *= limit / magnitude;
  }
  return { normal: normalImpulse, tangents };
}

function warmStart(prepared, cache, contact) {
  if (!cache) return;
  const warm = warmStartImpulses(cache, contact, prepared.friction);
  if (warm.normal > 0) {
    prepared.normal.impulse = warm.normal;
    applyPair(prepared, prepared.normal.direction, warm.normal);
  }
  prepared.tangents.forEach((tangent, index) => {
    const impulse = warm.tangents[index];
    if (Math.abs(impulse) <= MIN_IMPULSE) return;
    tangent.impulse = impulse;
    applyPair(prepared, tangent.direction, impulse);
  });
}

function applyPair(contact, direction, magnitude) {
  vec3.scale(scratchImpulse, direction, magnitude);
  applyImpulse(contact.a, scratchImpulse, contact.point);
  if (!contact.b) return;
  vec3.negate(scratchImpulse, scratchImpulse);
  applyImpulse(contact.b, scratchImpulse, contact.point);
}

// Impulses below this are physically meaningless; skipping them avoids subnormal arithmetic.
const MIN_IMPULSE = 1e-12;

function solveNormal(contact) {
  relativeVelocity(scratchRelative, contact);
  const speed = vec3.dot(scratchRelative, contact.normal.direction);
  const previous = contact.normal.impulse;
  const next = Math.max(previous + contact.normal.mass * (contact.target - speed), 0);
  contact.normal.impulse = next;
  if (next !== previous) applyPair(contact, contact.normal.direction, next - previous);
}

// Both tangents share one Coulomb disk, so diagonal sliding cannot reach sqrt(2) times the limit.
function solveFriction(contact) {
  const [first, second] = contact.tangents;
  relativeVelocity(scratchRelative, contact);
  let firstImpulse = first.impulse - first.mass * vec3.dot(scratchRelative, first.direction);
  let secondImpulse = second.impulse - second.mass * vec3.dot(scratchRelative, second.direction);
  const limit = contact.friction * contact.normal.impulse;
  const magnitude = Math.sqrt(firstImpulse * firstImpulse + secondImpulse * secondImpulse);
  if (magnitude > limit) {
    const scale = limit / magnitude;
    firstImpulse *= scale;
    secondImpulse *= scale;
  }
  const deltaFirst = firstImpulse - first.impulse;
  const deltaSecond = secondImpulse - second.impulse;
  first.impulse = firstImpulse;
  second.impulse = secondImpulse;
  if (Math.abs(deltaFirst) > MIN_IMPULSE) applyPair(contact, first.direction, deltaFirst);
  if (Math.abs(deltaSecond) > MIN_IMPULSE) applyPair(contact, second.direction, deltaSecond);
}

function groupKey(ids, contact) {
  const idOf = (body) => {
    if (!ids.has(body)) ids.set(body, ids.size);
    return ids.get(body);
  };
  return contact.b ? `${idOf(contact.a)}|${idOf(contact.b)}` : `${idOf(contact.a)}|${contact.surface}`;
}

export function solveContacts(world, dt) {
  const contacts = world.contacts ?? [];
  if (contacts.length === 0 || !(dt > 0)) {
    world.contactCache = null;
    return;
  }

  const cache = world.contactCache;
  const prepared = contacts.map((contact) => prepare(contact, dt, cache));
  world.contactCache = prepared;
  // Every approach is measured before any replay: a warm start applied mid-prepare would
  // inflate the approach of the contacts behind it.
  prepared.forEach((preparedContact, index) => warmStart(preparedContact, cache, contacts[index]));
  const events = (world.events ??= []);
  const groups = new Map();
  const ids = new Map();
  for (const contact of prepared) {
    const key = groupKey(ids, contact);
    let group = groups.get(key);
    if (!group) {
      group = {
        a: contact.a,
        b: contact.b,
        surface: contact.surface,
        point: contact.point,
        speed: 0,
        impulse: 0,
        contacts: [],
      };
      groups.set(key, group);
    }
    group.contacts.push(contact);
    if (contact.approach > group.speed) {
      group.speed = contact.approach;
      group.point = contact.point;
    }
  }

  for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
    for (const contact of prepared) {
      solveNormal(contact);
      solveFriction(contact);
    }
  }

  for (const group of groups.values()) {
    for (const contact of group.contacts) group.impulse += contact.normal.impulse;
    if (group.speed <= EVENT_MIN_SPEED) continue;
    events.push({
      a: group.a,
      b: group.b,
      surface: group.surface,
      point: group.point,
      speed: group.speed,
      impulse: group.impulse,
    });
  }
}
