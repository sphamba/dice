import * as vec3 from '../math/vec3.js';
import { DIE_RADIUS } from './body.js';

export const ROLL_SPEED_MIN = 0.8;

export const ROLL_SPEED_MAX = 1.6;

export const ROLL_SPIN_MIN = 15;

export const ROLL_SPIN_MAX = 40;

// A tossed die rises to this fraction of its headroom, so a roll never touches the lid.
// A wall corner bounce turns spin into height and adds up to a fifth of the headroom, so a higher planned rise reaches the glass.
export const ROLL_RISE_MIN = 0.6;

export const ROLL_RISE_MAX = 0.75;

const scratchUp = new Float64Array(3);

function upDirection(out, gravity) {
  const magnitude = vec3.length(gravity);
  if (!(magnitude > 0)) return vec3.set(out, 0, 0, 1);
  return vec3.scale(out, gravity, -1 / magnitude);
}

// Free travel of the die centre along `up` before its circumsphere meets a wall.
export function headroom(box, position, up) {
  const limits = [
    [-box.W / 2, box.W / 2],
    [-box.H / 2, box.H / 2],
    [0, box.D],
  ];
  let distance = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(up[axis]) < 1e-9) continue;
    const wall = up[axis] > 0 ? limits[axis][1] : limits[axis][0];
    distance = Math.min(distance, (wall - position[axis]) / up[axis]);
  }
  return Number.isFinite(distance) ? Math.max(distance - DIE_RADIUS, 0) : 0;
}

export function liftSpeed(box, gravity, position, rise) {
  const magnitude = vec3.length(gravity);
  if (!(magnitude > 0)) return 0;
  const riseDistance = rise * headroom(box, position, upDirection(scratchUp, gravity));
  return Math.sqrt(2 * magnitude * riseDistance);
}

export function rollVelocity(out, { box, gravity, position, angle, speed, rise }) {
  const lift = liftSpeed(box, gravity, position, rise);
  const up = upDirection(scratchUp, gravity);
  return vec3.set(
    out,
    speed * Math.cos(angle) - up[0] * lift,
    speed * Math.sin(angle) - up[1] * lift,
    up[2] * lift,
  );
}
