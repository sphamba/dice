export const MAX_GRAVITY = 4 * 9.81;

export const DEFAULT_GRAVITY = [0, 0, -9.81];

const IOS = /iPad|iPhone|iPod/.test(globalThis.navigator?.userAgent ?? '')
  || (/Macintosh/.test(globalThis.navigator?.userAgent ?? '') && (globalThis.navigator?.maxTouchPoints ?? 0) > 1);

const clampMagnitude = (g) => {
  const length = Math.hypot(g[0], g[1], g[2]);
  if (length <= MAX_GRAVITY || length === 0) return g;
  const factor = MAX_GRAVITY / length;
  return [g[0] * factor, g[1] * factor, g[2] * factor];
};

export function deviceToWorldGravity(accelIncludingGravity, angle, sign = 1) {
  const { x = 0, y = 0, z = 0 } = accelIncludingGravity;
  const turn = ((Math.round((Number(angle) || 0) / 90) % 4) + 4) % 4;
  const ax = sign * x;
  const ay = sign * y;
  let sx = ax;
  let sy = ay;
  if (turn === 1) {
    sx = -ay;
    sy = ax;
  } else if (turn === 2) {
    sx = -ax;
    sy = -ay;
  } else if (turn === 3) {
    sx = ay;
    sy = -ax;
  }
  return clampMagnitude([-sx, -sy, -sign * z]);
}

function screenAngle() {
  const angle = globalThis.screen?.orientation?.angle ?? globalThis.window?.orientation;
  return Number(angle) || 0;
}

export function createMotion({ onGravity }) {
  onGravity(DEFAULT_GRAVITY);
  if (typeof globalThis.DeviceMotionEvent !== 'function') return;
  globalThis.addEventListener('devicemotion', (event) => {
    const accel = event.accelerationIncludingGravity;
    if (!accel || accel.x == null || accel.y == null || accel.z == null) return;
    onGravity(deviceToWorldGravity(accel, screenAngle(), IOS ? -1 : 1));
  });
}

const ACTIVATION_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];

const firstGestureCallbacks = new Set();
let unlocked = false;
let listening = false;

export function onFirstGesture(callback) {
  firstGestureCallbacks.add(callback);
  if (unlocked) callback();
}

async function requestMotionPermission() {
  const request = globalThis.DeviceMotionEvent?.requestPermission;
  if (typeof request !== 'function') return;
  try {
    await request.call(globalThis.DeviceMotionEvent);
  } catch {
    // Permission denied: the default gravity stays.
  }
}

async function lockPortrait() {
  const orientation = globalThis.screen?.orientation;
  if (typeof orientation?.lock !== 'function') return;
  try {
    await orientation.lock('portrait');
  } catch {
    // iOS Safari and desktop refuse the lock, so the app follows rotation.
  }
}

export function unlockOnFirstGesture() {
  if (listening) return;
  listening = true;
  const handler = () => {
    const first = !unlocked;
    unlocked = true;
    for (const callback of firstGestureCallbacks) callback();
    if (!first) return;
    requestMotionPermission();
    lockPortrait();
  };
  for (const type of ACTIVATION_EVENTS) {
    globalThis.addEventListener(type, handler, { capture: true, passive: true });
  }
}
