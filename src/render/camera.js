import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';

// Slack above the lid and below the floor so dice never clip a frustum plane.
export const CAMERA_MARGIN = 0.05;

// Orthographic top view: eye above the lid looking down -z, box footprint = clip square.
export function createCamera(box) {
  const eye = vec3.fromValues(0, 0, box.D + CAMERA_MARGIN);
  const view = mat4.lookAt(mat4.create(), eye, [0, 0, 0], [0, 1, 0]);
  const projection = mat4.ortho(
    mat4.create(),
    -box.W / 2, box.W / 2, -box.H / 2, box.H / 2,
    CAMERA_MARGIN / 2, box.D + 2 * CAMERA_MARGIN,
  );
  return { eye, view, projection };
}

// Window depth d in [0, 1] (0 = near plane) back to world z. Linear for this ortho camera.
export function worldZFromDepth(d, box) {
  return box.D + CAMERA_MARGIN / 2 - d * (box.D + 1.5 * CAMERA_MARGIN);
}

// Window depth the floor plane (z = 0) occupies; used to clear the AO prepass depth.
export function floorClearDepth(box) {
  return worldZFromDepth(0, box) / (box.D + 1.5 * CAMERA_MARGIN);
}
