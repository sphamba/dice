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

// Orthographic projection from the light: the view sits opposite the travel
// direction, and the frustum fits the box corners plus `pad` on every side and
// in depth. The pad must cover the penumbra sampling the receivers do around
// the projected geometry, so the renderer passes the blocker search radius.
export function createLightProjection(box, direction, pad) {
  const forward = vec3.normalize(vec3.create(), direction);
  const center = [0, 0, box.D / 2];
  const eye = vec3.scaleAndAdd(vec3.create(), center, forward, -(box.D + 2 * pad));
  const up = Math.abs(forward[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const view = mat4.lookAt(mat4.create(), eye, center, up);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let near = Infinity;
  let far = -Infinity;
  for (const x of [-box.W / 2, box.W / 2]) {
    for (const y of [-box.H / 2, box.H / 2]) {
      for (const z of [0, box.D]) {
        const v = vec3.transformMat4([0, 0, 0], [x, y, z], view);
        minX = Math.min(minX, v[0]);
        maxX = Math.max(maxX, v[0]);
        minY = Math.min(minY, v[1]);
        maxY = Math.max(maxY, v[1]);
        near = Math.min(near, -v[2]);
        far = Math.max(far, -v[2]);
      }
    }
  }
  const left = minX - pad;
  const right = maxX + pad;
  const bottom = minY - pad;
  const top = maxY + pad;
  near -= pad;
  far += pad;
  const projection = mat4.ortho(mat4.create(), left, right, bottom, top, near, far);
  return {
    viewProjection: mat4.multiply(mat4.create(), projection, view),
    eye,
    forward,
    near,
    span: far - near,
    uvScale: [1 / (right - left), 1 / (top - bottom)],
  };
}
