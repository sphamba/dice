import { DIE_RADIUS } from '../physics/body.js';
import { faceFrame } from './labels.js';

// Carved labels sit 0.0289·dieRadius deep, matching the real dice set's
// engraved glyphs (~0.02-0.03 of die size at radius 0.0128·√3/2).
export const CARVE_DEPTH = 0.0289 * DIE_RADIUS;
// Ambient light drop on carve walls relative to the flat face.
export const CAVITY = 0.25;

const INF = 1e20;

const MASK_ALPHA = 128;

// Felzenszwalb-Huttenlocher squared EDT. spacingX/Y: metres between adjacent
// samples, so the result is a distance in metres.
function edt1d(f, out, n, c) {
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q += 1) {
    let s = (f[q] + c * q * q - (f[v[k]] + c * v[k] * v[k])) / (2 * c * (q - v[k]));
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + c * q * q - (f[v[k]] + c * v[k] * v[k])) / (2 * c * (q - v[k]));
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const d = q - v[k];
    out[q] = f[v[k]] + c * d * d;
  }
}

export function distanceTransform(mask, w, h, spacingX = 1, spacingY = 1) {
  const squared = new Float64Array(w * h);
  for (let i = 0; i < squared.length; i += 1) squared[i] = mask[i] ? 0 : INF;
  const row = new Float64Array(w);
  const column = new Float64Array(h);
  for (let j = 0; j < h; j += 1) {
    const offset = j * w;
    edt1d(squared.subarray(offset, offset + w), row, w, spacingX * spacingX);
    for (let i = 0; i < w; i += 1) squared[offset + i] = row[i];
  }
  for (let i = 0; i < w; i += 1) {
    for (let j = 0; j < h; j += 1) column[j] = squared[j * w + i];
    edt1d(column, row, h, spacingY * spacingY);
    for (let j = 0; j < h; j += 1) squared[j * w + i] = row[j];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i += 1) out[i] = Math.sqrt(squared[i]);
  return out;
}

// Negative inside the mask, positive outside, in metres.
export function signedDistance(mask, w, h, spacingX = 1, spacingY = 1) {
  const inverted = new Uint8Array(w * h);
  for (let i = 0; i < inverted.length; i += 1) inverted[i] = mask[i] ? 0 : 1;
  const toOutside = distanceTransform(inverted, w, h, spacingX, spacingY);
  const toInside = distanceTransform(mask, w, h, spacingX, spacingY);
  const sdf = new Float32Array(w * h);
  for (let i = 0; i < sdf.length; i += 1) sdf[i] = toInside[i] - toOutside[i];
  return sdf;
}

// Round profile: quarter-ellipse arc of depth CARVE_DEPTH and inradius w,
// revolved around the glyph's deepest ridge. For a disk component w is the
// pip radius, which turns the surface into the spherical dimple of real dice.
function profileHeight(depth, w) {
  const t = Math.min(depth / w, 1);
  return -CARVE_DEPTH * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
}

// Bakes one atlas cell: mask (1 = ink) over w×h samples with metres-per-sample
// spacing into RGBA bytes. RGB holds a tangent-space normal ((0,0,1) = flat,
// x right, y up in face space), A holds the cavity shading factor.
export function carveCell(mask, w, h, spacingX, spacingY) {
  const count = w * h;
  const sdf = signedDistance(mask, w, h, spacingX, spacingY);

  // Per-glyph inradius: deepest inside distance of each connected region.
  const component = new Int32Array(count).fill(-1);
  const inradius = [];
  const stack = new Int32Array(count);
  for (let start = 0; start < count; start += 1) {
    if (sdf[start] >= 0 || component[start] >= 0) continue;
    const id = inradius.length;
    let deepest = 0;
    let top = 0;
    stack[top++] = start;
    component[start] = id;
    while (top > 0) {
      const p = stack[--top];
      deepest = Math.max(deepest, -sdf[p]);
      const x = p % w;
      if (x > 0 && sdf[p - 1] < 0 && component[p - 1] < 0) {
        component[p - 1] = id;
        stack[top++] = p - 1;
      }
      if (x < w - 1 && sdf[p + 1] < 0 && component[p + 1] < 0) {
        component[p + 1] = id;
        stack[top++] = p + 1;
      }
      if (p >= w && sdf[p - w] < 0 && component[p - w] < 0) {
        component[p - w] = id;
        stack[top++] = p - w;
      }
      if (p < count - w && sdf[p + w] < 0 && component[p + w] < 0) {
        component[p + w] = id;
        stack[top++] = p + w;
      }
    }
    inradius.push(deepest);
  }

  const height = new Float32Array(count);
  for (let p = 0; p < count; p += 1) {
    if (sdf[p] < 0) height[p] = profileHeight(-sdf[p], inradius[component[p]]);
  }

  const out = new Uint8Array(count * 4);
  let maxSlope = 0;
  const slopes = new Float32Array(count);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const p = j * w + i;
      if (sdf[p] >= 0) continue;
      const left = i > 0 ? p - 1 : p;
      const right = i < w - 1 ? p + 1 : p;
      const down = j > 0 ? p - w : p;
      const up = j < h - 1 ? p + w : p;
      // dh/dx: cell x grows with the column. dh/dy: face y grows upward while
      // the row index grows downward, hence the sign flip.
      const dhdx = (height[right] - height[left]) / (2 * spacingX);
      const dhdy = (height[down] - height[up]) / (2 * spacingY);
      const len = Math.hypot(dhdx, dhdy, 1);
      const p4 = p * 4;
      out[p4] = Math.round((-dhdx / len * 0.5 + 0.5) * 255);
      out[p4 + 1] = Math.round((-dhdy / len * 0.5 + 0.5) * 255);
      out[p4 + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      slopes[p] = Math.hypot(dhdx, dhdy);
      if (slopes[p] > maxSlope) maxSlope = slopes[p];
    }
  }
  for (let p = 0; p < count; p += 1) {
    const p4 = p * 4;
    out[p4] = sdf[p] < 0 ? out[p4] : 128;
    out[p4 + 1] = sdf[p] < 0 ? out[p4 + 1] : 128;
    out[p4 + 2] = sdf[p] < 0 ? out[p4 + 2] : 255;
    out[p4 + 3] = 255 - Math.round(CAVITY * (maxSlope > 0 ? Math.min(slopes[p] / maxSlope, 1) : 0) * 255);
  }
  return out;
}

// Extracts per-cell ink masks from the label atlas canvas and bakes carved
// normal cells. Cell layout must match buildLabelAtlas: rects[f] holds the
// cell of shape.faces[f], u right / v up in GL space. Rows are written
// bottom-up to match the FLIP_Y upload of the label texture.
export function buildCarveAtlas(shape, atlas) {
  const { canvas, size, rects } = atlas;
  const source = canvas.getContext('2d').getImageData(0, 0, size, size).data;
  const data = new Uint8Array(size * size * 4);
  for (let p = 0; p < size * size; p += 1) {
    data[p * 4] = 128;
    data[p * 4 + 1] = 128;
    data[p * 4 + 2] = 255;
    data[p * 4 + 3] = 255;
  }
  shape.faces.forEach((face, f) => {
    const rect = rects[f];
    const frame = faceFrame(shape, face);
    const x0 = Math.round(rect.u0 * size);
    const x1 = Math.round(rect.u1 * size);
    const y0 = Math.round((1 - rect.v1) * size);
    const y1 = Math.round((1 - rect.v0) * size);
    const cellW = x1 - x0;
    const cellH = y1 - y0;
    const spacingX = (2 * frame.radius) / (size * (rect.u1 - rect.u0));
    const spacingY = (2 * frame.radius) / (size * (rect.v1 - rect.v0));
    const mask = new Uint8Array(cellW * cellH);
    for (let j = 0; j < cellH; j += 1) {
      for (let i = 0; i < cellW; i += 1) {
        mask[j * cellW + i] =
          source[((y0 + j) * size + x0 + i) * 4 + 3] >= MASK_ALPHA ? 1 : 0;
      }
    }
    const cell = carveCell(mask, cellW, cellH, spacingX, spacingY);
    for (let j = 0; j < cellH; j += 1) {
      data.set(
        cell.subarray(j * cellW * 4, (j + 1) * cellW * 4),
        ((size - 1 - (y0 + j)) * size + x0) * 4,
      );
    }
  });
  return { size, data };
}
