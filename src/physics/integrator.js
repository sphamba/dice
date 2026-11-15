import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';
import { updateDerived } from './body.js';

export const LINEAR_DAMPING = 0.1;

export const ANGULAR_DAMPING = 0.2;

// No gyroscopic term: the die inertia tensor is close to isotropic.
export function integrateVelocities(
  bodies,
  gravity,
  dt,
  { linear = LINEAR_DAMPING, angular = ANGULAR_DAMPING } = {},
) {
  const linearFactor = 1 / (1 + linear * dt);
  const angularFactor = 1 / (1 + angular * dt);
  for (const body of bodies) {
    vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, gravity, dt);
    vec3.scale(body.linearVelocity, body.linearVelocity, linearFactor);
    vec3.scale(body.angularVelocity, body.angularVelocity, angularFactor);
  }
}

export function integratePositions(bodies, dt) {
  for (const body of bodies) {
    vec3.scaleAndAdd(body.position, body.position, body.linearVelocity, dt);
    quat.integrate(body.orientation, body.orientation, body.angularVelocity, dt);
    updateDerived(body);
  }
}
