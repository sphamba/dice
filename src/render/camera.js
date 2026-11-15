import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';

// Slack above the lid and below the floor so dice never clip a frustum plane.
export const CAMERA_MARGIN = 0.05;

const CORNER_SIGNS = [
  [-1, -1], [1, -1], [1, 1], [-1, 1],
];

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

// Ortho light frustum fitted to the box corners as seen from the light.
export function createLightViewProjection(box, direction) {
  const dir = vec3.normalize(vec3.create(), direction);
  const up = Math.abs(dir[1]) > 0.99 ? vec3.fromValues(0, 0, 1) : vec3.fromValues(0, 1, 0);
  const center = vec3.fromValues(0, 0, box.D / 2);
  const eye = vec3.scaleAndAdd(vec3.create(), center, dir, -vec3.length([box.W, box.H, box.D]));
  const view = mat4.lookAt(mat4.create(), eye, center, up);

  const corners = [];
  for (const [sx, sy] of CORNER_SIGNS) {
    for (const sz of [0, box.D]) {
      corners.push(vec3.fromValues((sx * box.W) / 2, (sy * box.H) / 2, sz));
    }
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const corner of corners) {
    const p = vec3.transformMat4(vec3.create(), corner, view);
    minX = Math.min(minX, p[0]);
    maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
    minZ = Math.min(minZ, p[2]);
    maxZ = Math.max(maxZ, p[2]);
  }
  const pad = 0.01;
  const projection = mat4.ortho(
    mat4.create(),
    minX - pad, maxX + pad, minY - pad, maxY + pad,
    -maxZ - pad, -minZ + pad,
  );
  return { view, projection };
}
