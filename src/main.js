import * as quat from './math/quat.js';
import * as vec3 from './math/vec3.js';
import { dieRadius, createBody } from './physics/body.js';
import { boxFromViewport } from './physics/box.js';
import { MAX_FRAME_DT, createWorld } from './physics/world.js';
import {
  ROLL_RISE_MAX,
  ROLL_RISE_MIN,
  ROLL_SPEED_MAX,
  ROLL_SPEED_MIN,
  ROLL_SPIN_MAX,
  ROLL_SPIN_MIN,
  rollVelocity,
} from './physics/roll.js';
import { createShape } from './dice/shapes.js';
import { inkForDie } from './dice/colors.js';
import { createRenderer } from './render/renderer.js';
import { backingSize } from './render/canvas-size.js';
import { createMotion, onFirstGesture, unlockOnFirstGesture } from './input/motion.js';
import { createPointer } from './input/pointer.js';
import { createHaptics } from './audio/haptics.js';
import { createSound } from './audio/sound.js';
import { createPanel, showMessage } from './ui/panel.js';

const SPAWN_SPEED = 0.2;
const SPAWN_TRIES = 50;

const randomRange = (min, max) => min + Math.random() * (max - min);

function randomAxis(out) {
  return vec3.normalize(
    out,
    vec3.set(out, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1),
  );
}

const canvas = document.querySelector('#view');
const ui = document.querySelector('#ui');

function showError(error) {
  console.error(error);
  showMessage(ui, error instanceof Error ? error.message : String(error));
}

addEventListener('error', (event) => showError(event.error ?? event.message));
addEventListener('unhandledrejection', (event) => showError(event.reason));

function tryCreateRenderer(gl) {
  try {
    return createRenderer(gl, { onError: showError });
  } catch (error) {
    showError(error);
    return null;
  }
}

const gl = canvas.getContext('webgl2', { alpha: false });
const renderer = gl ? tryCreateRenderer(gl) : null;

if (!gl) {
  showMessage(ui, 'WebGL2 is not supported by this browser');
} else if (renderer) {
  const world = createWorld(boxFromViewport(innerWidth, innerHeight, devicePixelRatio));
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

  function freePosition(type) {
    const { W, H, D } = world.box;
    const radius = dieRadius(type);
    const xMin = -W / 2 + radius;
    const yMin = -H / 2 + radius;
    const xMax = W / 2 - radius;
    const yMax = H / 2 - radius;
    const zMin = D / 2;
    const zMax = D - radius;
    const limit = 2 * radius;
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

  function spawnDie(type, color) {
    const body = createBody(createShape(type, dieRadius(type)), {
      position: freePosition(type),
      orientation: quat.random(new Float64Array(4)),
    });
    body.color = color;
    body.ink = inkForDie(color);
    vec3.set(
      body.linearVelocity,
      randomRange(-SPAWN_SPEED, SPAWN_SPEED),
      randomRange(-SPAWN_SPEED, SPAWN_SPEED),
      0,
    );
    world.addBody(body);
    sound.addBody(body);
    const list = spawned.get(type);
    if (list) list.push(body);
    else spawned.set(type, [body]);
    return body;
  }

  function removeDie(type) {
    const list = spawned.get(type);
    if (!list?.length) return;
    const body = list.pop();
    sound.removeBody(body);
    world.removeBody(body);
  }

  const direction = new Float64Array(3);

  function rollDice() {
    const held = new Set(pointer.heldBodies());
    for (const body of world.bodies) {
      if (held.has(body)) continue;
      rollVelocity(body.linearVelocity, {
        box: world.box,
        gravity: world.gravity,
        position: body.position,
        angle: Math.random() * 2 * Math.PI,
        speed: randomRange(ROLL_SPEED_MIN, ROLL_SPEED_MAX),
        rise: randomRange(ROLL_RISE_MIN, ROLL_RISE_MAX),
      });
      const spin = randomRange(ROLL_SPIN_MIN, ROLL_SPIN_MAX);
      vec3.scale(body.angularVelocity, randomAxis(direction), spin);
    }
  }

  const panel = createPanel(ui, { onAdd: spawnDie, onRemove: removeDie, onRoll: rollDice });

  for (const [type, list] of Object.entries(panel.getColors())) {
    for (const color of list) spawnDie(type, color);
  }

  let dprQuery = null;

  function applySize() {
    const box = boxFromViewport(innerWidth, innerHeight, devicePixelRatio);
    world.setBox(box);
    sound.setBox(box);
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
    sound.playSteps(world.soundSteps, world.simTime);
    world.soundSteps.length = 0;
    haptics.play(world.events);
    renderer.draw(world.bodies);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
