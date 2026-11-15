export const MAX_DRAG_SPEED = 2;

export const MAX_FLING_SPEED = 3;

export const MAX_FLING_SPIN = 60;

export const FLING_WINDOW_MS = 80;

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

export function createPointer(canvas, { world, toWorld }) {
  const held = new Map();

  function worldXY(px, py) {
    const point = toWorld(px, py);
    return [point[0] ?? point.x, point[1] ?? point.y];
  }

  function pickBody(x, y) {
    let best = null;
    for (const body of world.bodies) {
      const dx = x - body.position[0];
      const dy = y - body.position[1];
      if (dx * dx + dy * dy > body.radius * body.radius) continue;
      if (!best || body.position[2] > best.position[2]) best = body;
    }
    return best;
  }

  function drive(dt) {
    for (const entry of held.values()) {
      const velocity = entry.body.linearVelocity;
      for (let i = 0; i < 3; i += 1) {
        velocity[i] = (entry.target[i] - entry.body.position[i]) / dt;
      }
      clampSpeed(velocity, MAX_DRAG_SPEED);
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
    const body = pickBody(x, y);
    if (!body) return;
    canvas.setPointerCapture(event.pointerId);
    const target = Float64Array.from([x, y, world.box.D - 2 * body.radius]);
    held.set(event.pointerId, { body, target, samples: [{ t: event.timeStamp, x, y }] });
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
