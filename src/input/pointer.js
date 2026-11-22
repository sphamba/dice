import * as mat3 from '../math/mat3.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';
import { applyImpulse } from '../physics/body.js';

export const MAX_DRAG_SPEED = 2;

export const MAX_FLING_SPEED = 3;

export const MAX_FLING_SPIN = 60;

export const FLING_WINDOW_MS = 80;

// Held-body damping rates in 1/s, so the fixed-step response is frame-rate independent.
const HOLD_DAMPING = 120;

// Light enough to keep a visible swing after a pointer move, strong enough to calm it in ~0.2 s.
const HOLD_SWING_DAMPING = 61;

const FACE_EPS = 1e-9;

function clampSpeed(out, max) {
  const sq = out[0] * out[0] + out[1] * out[1] + out[2] * out[2];
  if (sq <= max * max || sq === 0) return out;
  const scale = max / Math.sqrt(sq);
  out[0] *= scale;
  out[1] *= scale;
  out[2] *= scale;
  return out;
}

// Samples carry CSS-independent world x/y and a timeStamp in milliseconds, oldest first.
export function flingVelocity(samples, maxSpeed = MAX_FLING_SPEED) {
  const velocity = new Float64Array(3);
  if (samples.length < 2) return velocity;
  const last = samples[samples.length - 1];
  let first = last;
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    if (last.t - samples[i].t > FLING_WINDOW_MS) break;
    first = samples[i];
  }
  const dt = (last.t - first.t) / 1000;
  if (!(dt > 0)) return velocity;
  velocity[0] = (last.x - first.x) / dt;
  velocity[1] = (last.y - first.y) / dt;
  return clampSpeed(velocity, maxSpeed);
}

function randomSpin(speed) {
  const magnitude = MAX_FLING_SPIN * Math.min(speed / MAX_FLING_SPEED, 1) * Math.random();
  const axisZ = Math.random() * 2 - 1;
  const angle = Math.random() * 2 * Math.PI;
  const ring = Math.sqrt(1 - axisZ * axisZ);
  return [
    magnitude * ring * Math.cos(angle),
    magnitude * ring * Math.sin(angle),
    magnitude * axisZ,
  ];
}

const scratchNormal = new Float64Array(3);
const scratchRotatedVertex = new Float64Array(3);
const scratchVertexA = new Float64Array(3);
const scratchVertexB = new Float64Array(3);
const scratchEdge = new Float64Array(3);
const scratchRayPoint = new Float64Array(3);
const scratchRel = new Float64Array(3);
const scratchSide = new Float64Array(3);
const scratchWorldHit = new Float64Array(3);
const scratchOffset = new Float64Array(3);
const scratchConjugate = new Float64Array(4);
const scratchRotatedOffset = new Float64Array(3);
const scratchTarget = new Float64Array(3);
const scratchPoint = new Float64Array(3);
const scratchPointVelocity = new Float64Array(3);
const scratchSpinLever = new Float64Array(3);
const scratchImpulse = new Float64Array(3);
const scratchCross = new Float64Array(9);
const scratchProduct = new Float64Array(9);
const scratchStiffness = new Float64Array(9);
const scratchInverse = new Float64Array(9);

// Column-major [r]x: the operator v -> r x v.
function crossMatrix(out, r) {
  out[0] = 0;
  out[1] = r[2];
  out[2] = -r[1];
  out[3] = -r[2];
  out[4] = 0;
  out[5] = r[0];
  out[6] = r[1];
  out[7] = -r[0];
  out[8] = 0;
  return out;
}

// The impulse at the offset point that changes that point's velocity by deltaVelocity,
// with K = (1/m) I - [r]x invInertiaWorld [r]x.
function pointImpulse(out, body, offset, deltaVelocity) {
  const cross = crossMatrix(scratchCross, offset);
  mat3.multiply(scratchProduct, cross, body.invInertiaWorld);
  mat3.multiply(scratchStiffness, scratchProduct, cross);
  for (let index = 0; index < 9; index += 1) scratchStiffness[index] = -scratchStiffness[index];
  for (let axis = 0; axis < 3; axis += 1) scratchStiffness[axis * 4] += body.invMass;
  const inverse = mat3.invert(scratchInverse, scratchStiffness);
  return inverse ? vec3.transformMat3(out, deltaVelocity, inverse) : null;
}

function worldVertex(out, body, index) {
  quat.rotateVec3(scratchRotatedVertex, body.orientation, body.shape.vertices[index]);
  return vec3.add(out, scratchRotatedVertex, body.position);
}

function insideFace(normal, x, y, z, face, body) {
  const indices = face.indices;
  for (let k = 0; k < indices.length; k += 1) {
    const a = worldVertex(scratchVertexA, body, indices[k]);
    const b = worldVertex(scratchVertexB, body, indices[(k + 1) % indices.length]);
    const edge = vec3.sub(scratchEdge, b, a);
    const rel = vec3.sub(scratchRel, vec3.set(scratchRayPoint, x, y, z), a);
    if (vec3.dot(vec3.cross(scratchSide, edge, rel), normal) < -FACE_EPS) return false;
  }
  return true;
}

// Orthographic downward ray through (x, y): the closest transformed face hit across bodies,
// as a body-local offset from the center. The bounding circle only prunes work.
function pickFace(bodies, x, y) {
  let hitBody = null;
  let topZ = -Infinity;
  for (const body of bodies) {
    const dx = x - body.position[0];
    const dy = y - body.position[1];
    if (dx * dx + dy * dy > body.radius * body.radius) continue;
    const shape = body.shape;
    if (!shape?.faces) continue;
    for (const face of shape.faces) {
      const normal = vec3.transformQuat(scratchNormal, face.normal, body.orientation);
      if (normal[2] <= FACE_EPS) continue;
      const plane =
        vec3.dot(normal, body.position) +
        vec3.dot(face.normal, shape.vertices[face.indices[0]]);
      const z = (plane - normal[0] * x - normal[1] * y) / normal[2];
      if (z <= topZ) continue;
      if (!insideFace(normal, x, y, z, face, body)) continue;
      topZ = z;
      hitBody = body;
    }
  }
  if (!hitBody) return null;
  const offset = vec3.sub(scratchOffset, vec3.set(scratchWorldHit, x, y, topZ), hitBody.position);
  const local = quat.rotateVec3(
    new Float64Array(3),
    quat.conjugate(scratchConjugate, hitBody.orientation),
    offset,
  );
  return { body: hitBody, offset: local };
}

export function createPointer(canvas, { world, toWorld }) {
  const held = new Map();

  function worldXY(px, py) {
    const point = toWorld(px, py);
    return [point[0] ?? point.x, point[1] ?? point.y];
  }

  // Pulls the held material point toward the pointer, at the hold height. Gravity is left
  // to turn the rest of the die about that point, so the center hangs below it.
  function drive(dt) {
    // A held die is deliberately still: that stillness must not be read as the world resting.
    if (held.size > 0) world.wake();
    const gain = (1 - Math.exp(-HOLD_DAMPING * dt)) / dt;
    const swingDecay = 1 / (1 + HOLD_SWING_DAMPING * dt);
    for (const entry of held.values()) {
      const body = entry.body;
      const offset = vec3.transformQuat(scratchRotatedOffset, entry.offset, body.orientation);
      const point = vec3.add(scratchPoint, body.position, offset);
      const pointVelocity = vec3.add(
        scratchPointVelocity,
        body.linearVelocity,
        vec3.cross(scratchSpinLever, body.angularVelocity, offset),
      );
      const target = clampSpeed(
        vec3.set(
          scratchTarget,
          (entry.target[0] - point[0]) * gain,
          (entry.target[1] - point[1]) * gain,
          0,
        ),
        MAX_DRAG_SPEED,
      );
      target[2] = (world.box.D - 2 * body.radius - point[2]) * gain;
      const impulse = pointImpulse(
        scratchImpulse,
        body,
        offset,
        vec3.sub(target, target, pointVelocity),
      );
      if (impulse) applyImpulse(body, impulse, point);
      // The constraint re-solves the point velocity, so the free spin about the held point
      // has to be damped after it, with the center moved to keep the point in place.
      vec3.scaleAndAdd(
        body.linearVelocity,
        body.linearVelocity,
        vec3.cross(scratchSpinLever, body.angularVelocity, offset),
        1 - swingDecay,
      );
      vec3.scale(body.angularVelocity, body.angularVelocity, swingDecay);
    }
  }

  function addSample(entry, t, x, y) {
    entry.samples.push({ t, x, y });
    while (entry.samples.length > 2 && t - entry.samples[0].t > FLING_WINDOW_MS) {
      entry.samples.shift();
    }
  }

  function onDown(event) {
    const [x, y] = worldXY(event.clientX, event.clientY);
    const hit = pickFace(world.bodies, x, y);
    if (!hit) return;
    canvas.setPointerCapture(event.pointerId);
    held.set(event.pointerId, {
      body: hit.body,
      offset: hit.offset,
      target: Float64Array.from([x, y]),
      samples: [{ t: event.timeStamp, x, y }],
    });
  }

  function onMove(event) {
    const entry = held.get(event.pointerId);
    if (!entry) return;
    const [x, y] = worldXY(event.clientX, event.clientY);
    entry.target[0] = x;
    entry.target[1] = y;
    addSample(entry, event.timeStamp, x, y);
  }

  function onRelease(event) {
    const entry = held.get(event.pointerId);
    if (!entry) return;
    held.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const [x, y] = worldXY(event.clientX, event.clientY);
    addSample(entry, event.timeStamp, x, y);
    const velocity = flingVelocity(entry.samples);
    const body = entry.body;
    body.linearVelocity[0] = velocity[0];
    body.linearVelocity[1] = velocity[1];
    body.linearVelocity[2] = 0;
    const spin = randomSpin(Math.hypot(velocity[0], velocity[1]));
    for (let i = 0; i < 3; i += 1) body.angularVelocity[i] += spin[i];
    // A calm release applies no velocity, so the wake has to be explicit.
    world.wake();
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onRelease);
  canvas.addEventListener('pointercancel', onRelease);
  world.beforeStep = drive;

  return {
    heldBodies: () => Array.from(held.values(), (entry) => entry.body),
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onRelease);
      canvas.removeEventListener('pointercancel', onRelease);
      if (world.beforeStep === drive) world.beforeStep = null;
      held.clear();
    },
  };
}
