import * as mat3 from '../math/mat3.js';
import * as quat from '../math/quat.js';
import * as vec3 from '../math/vec3.js';

export const DIE_DENSITY = 1200;

export const DIE_RADIUS = 0.0128 * Math.sqrt(3) / 2;

// The d4 is 20% larger than the other die types; everything else derives from this radius.
export const D4_RADIUS = DIE_RADIUS * 1.2;

export const dieRadius = (type) => (type === 'd4' ? D4_RADIUS : DIE_RADIUS);

// Fillet radius of the shaded rounded edges, in metres. One constant for all
// dice; the d4 corner numbers stay on the flat part of the face at this size.
export const BEVEL_RADIUS = DIE_RADIUS / (4 * Math.sqrt(3));

const vec = () => new Float64Array(3);
const mat = () => new Float64Array(9);

const scratchRotation = mat();
const scratchTranspose = mat();
const scratchProduct = mat();
const scratchLever = vec();
const scratchTorque = vec();
const scratchSpin = vec();

function scaleTensor(out, tensor, factor) {
  for (let i = 0; i < 9; i += 1) out[i] = tensor[i] * factor;
  return out;
}

export function createBody(
  shape,
  { density = DIE_DENSITY, position = [0, 0, 0], orientation = [0, 0, 0, 1] } = {},
) {
  const mass = density * shape.volume;
  const body = {
    shape,
    position: Float64Array.from(position),
    orientation: quat.normalize(new Float64Array(4), orientation),
    linearVelocity: vec(),
    angularVelocity: vec(),
    invMass: 1 / mass,
    invInertiaBody: mat3.invert(mat(), scaleTensor(mat(), shape.inertia, density)),
    invInertiaWorld: mat(),
    radius: shape.radius,
  };
  return updateDerived(body);
}

export function updateDerived(body) {
  const rotation = mat3.fromQuat(scratchRotation, body.orientation);
  mat3.multiply(scratchProduct, rotation, body.invInertiaBody);
  mat3.multiply(body.invInertiaWorld, scratchProduct, mat3.transpose(scratchTranspose, rotation));
  return body;
}

export function applyImpulse(body, impulse, worldPoint) {
  vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, impulse, body.invMass);
  const lever = vec3.sub(scratchLever, worldPoint, body.position);
  const torque = vec3.cross(scratchTorque, lever, impulse);
  const spin = vec3.transformMat3(scratchSpin, torque, body.invInertiaWorld);
  vec3.add(body.angularVelocity, body.angularVelocity, spin);
  return body;
}
