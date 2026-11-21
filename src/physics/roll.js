import * as vec3 from '../math/vec3.js';

export const ROLL_SPEED_MIN = 0.8;

export const ROLL_SPEED_MAX = 1.6;

export const ROLL_SPIN_MIN = 15;

export const ROLL_SPIN_MAX = 40;

// Height of a toss as a fraction of the box depth, so no roll can reach the lid.
export const ROLL_RISE_MIN = 0.1;

export const ROLL_RISE_MAX = 0.2;

const scratchUp = new Float64Array(3);

export function liftSpeed(box, gravity, rise) {
  const g = vec3.length(gravity);
  return g > 0 ? Math.sqrt(2 * g * rise * box.D) : 0;
}

export function rollVelocity(out, { box, gravity, angle, speed, rise }) {
  vec3.normalize(scratchUp, gravity);
  const lift = liftSpeed(box, gravity, rise);
  return vec3.set(
    out,
    speed * Math.cos(angle) - scratchUp[0] * lift,
    speed * Math.sin(angle) - scratchUp[1] * lift,
    -scratchUp[2] * lift,
  );
}
