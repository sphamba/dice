import * as quat from './math/quat.js';
import * as vec3 from './math/vec3.js';
import { DIE_RADIUS, createBody } from './physics/body.js';
import { boxFromViewport } from './physics/box.js';
import { MAX_FRAME_DT, createWorld } from './physics/world.js';
import { createShape } from './dice/shapes.js';
import { createRenderer } from './render/renderer.js';
import { backingSize } from './render/canvas-size.js';
import { createMotion, onFirstGesture, unlockOnFirstGesture } from './input/motion.js';
import { createPointer } from './input/pointer.js';
import { createHaptics } from './audio/haptics.js';
import { createSound } from './audio/sound.js';
import { createPanel } from './ui/panel.js';

export const ROLL_SPEED_MIN = 0.8;
export const ROLL_SPEED_MAX = 1.6;
export const ROLL_LIFT_MIN = 0.6;
export const ROLL_LIFT_MAX = 1.2;
export const ROLL_SPIN_MIN = 15;
export const ROLL_SPIN_MAX = 40;

const SPAWN_SPEED = 0.2;
const SPAWN_TRIES = 50;

const randomRange = (min, max) => min + Math.random() * (max - min);

function randomAxis(out) {
  return vec3.normalize(
    out,
    vec3.set(out, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1),
  );
}

function showUnsupported(ui) {
  const message = document.createElement('p');
  message.id = 'unsupported';
  message.textContent = 'WebGL2 is not supported by this browser';
  ui.append(message);
}

const canvas = document.querySelector('#view');
const ui = document.querySelector('#ui');
const gl = canvas.getContext('webgl2');

if (!gl) {
  showUnsupported(ui);
} else {
  const world = createWorld(boxFromViewport(innerWidth, innerHeight, devicePixelRatio));
  const renderer = createRenderer(gl);
  const sound = createSound();
  const haptics = createHaptics();

  onFirstGesture(() => sound.resume());

  createMotion({ onGravity: (gravity) => world.setGravity(gravity) });

  const pointer = createPointer(canvas, {
    world,
    toWorld: (px, py) => [
      (px - innerWidth / 2) * (world.box.W / innerWidth),
      (innerHeight / 2 - py) * (world.box.H / innerHeight),
    ],
  });

  const spawned = new Map();

  function freePosition() {
    const { W, H, D } = world.box;
    const xMin = -W / 2 + DIE_RADIUS;
    const yMin = -H / 2 + DIE_RADIUS;
    const xMax = W / 2 - DIE_RADIUS;
    const yMax = H / 2 - DIE_RADIUS;
    const zMin = D / 2;
    const zMax = D - DIE_RADIUS;
    const limit = 2 * DIE_RADIUS;
    for (let attempt = 0; attempt < SPAWN_TRIES; attempt += 1) {
      const position = vec3.set(
        new Float64Array(3),
        randomRange(xMin, xMax),
        randomRange(yMin, yMax),
        randomRange(zMin, zMax),
      );
      const free = world.bodies.every((body) => vec3.distance(body.position, position) > limit);
      if (free) return position;
    }
    return vec3.set(
      new Float64Array(3),
      randomRange(xMin, xMax),
      randomRange(yMin, yMax),
      randomRange(zMin, zMax),
    );
  }

  function spawnDie(type) {
    const body = createBody(createShape(type, DIE_RADIUS), {
      position: freePosition(),
      orientation: quat.random(new Float64Array(4)),
    });
    vec3.set(
      body.linearVelocity,
      randomRange(-SPAWN_SPEED, SPAWN_SPEED),
      randomRange(-SPAWN_SPEED, SPAWN_SPEED),
      0,
    );
    world.addBody(body);
    const list = spawned.get(type);
    if (list) list.push(body);
    else spawned.set(type, [body]);
    return body;
  }

  function removeDie(type) {
    const list = spawned.get(type);
    if (!list?.length) return;
    world.removeBody(list.pop());
  }

  const gravityDirection = new Float64Array(3);
  const direction = new Float64Array(3);

  function rollDice() {
    const held = new Set(pointer.heldBodies());
    vec3.normalize(gravityDirection, world.gravity);
    for (const body of world.bodies) {
      if (held.has(body)) continue;
      const angle = Math.random() * 2 * Math.PI;
      const speed = randomRange(ROLL_SPEED_MIN, ROLL_SPEED_MAX);
      const lift = randomRange(ROLL_LIFT_MIN, ROLL_LIFT_MAX);
      vec3.set(
        body.linearVelocity,
        speed * Math.cos(angle) - gravityDirection[0] * lift,
        speed * Math.sin(angle) - gravityDirection[1] * lift,
        -gravityDirection[2] * lift,
      );
      const spin = randomRange(ROLL_SPIN_MIN, ROLL_SPIN_MAX);
      vec3.scale(body.angularVelocity, randomAxis(direction), spin);
    }
  }

  const panel = createPanel(ui, { onAdd: spawnDie, onRemove: removeDie, onRoll: rollDice });

  for (const [type, count] of Object.entries(panel.getSet())) {
    for (let index = 0; index < count; index += 1) spawnDie(type);
  }

  let dprQuery = null;

  function applySize() {
    const box = boxFromViewport(innerWidth, innerHeight, devicePixelRatio);
    world.setBox(box);
    const { width, height } = backingSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    renderer.resize(width, height, box);
    dprQuery?.removeEventListener('change', applySize);
    dprQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', applySize);
  }

  addEventListener('resize', applySize);
  screen.orientation?.addEventListener('change', applySize);
  applySize();
  unlockOnFirstGesture();

  let previous = performance.now();

  function frame(now) {
    const dt = Math.min((now - previous) / 1000, MAX_FRAME_DT);
    previous = now;
    world.update(dt);
    sound.play(world.events, world.box);
    haptics.play(world.events);
    renderer.draw(world.bodies);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
