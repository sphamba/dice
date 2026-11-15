import { cross, dot, length, normalize, sub } from '../math/vec3.js';

export const ATLAS_SIZE = 1024;

const INK_DARK = [0.08, 0.07, 0.07];
const INK_LIGHT = [0.96, 0.95, 0.93];

// Arial bold metrics at a 100px reference size.
const CAP_HEIGHT = 71;

const PIP_OFFSET = 0.42;
const PIP_RADIUS = 0.13;
const PIP_LAYOUTS = {
  1: [[0, 0]],
  2: [[-1, 1], [1, -1]],
  3: [[-1, 1], [0, 0], [1, -1]],
  4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
  6: [[-1, 1], [-1, 0], [-1, -1], [1, 1], [1, 0], [1, -1]],
};

// One grid cell per face, packed row-major; v = 0 is the bottom of the atlas.
export function faceRects(faceCount) {
  const cols = Math.ceil(Math.sqrt(faceCount));
  const rows = Math.ceil(faceCount / cols);
  const rects = [];
  for (let i = 0; i < faceCount; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      u0: col / cols,
      u1: (col + 1) / cols,
      v0: row / rows,
      v1: (row + 1) / rows,
    });
  }
  return rects;
}

// Per-face 2D frame: origin at the vertex centroid, right along the first face
// edge, up perpendicular to it pointing into the face, radius = corner distance.
function faceFrame(shape, face) {
  const [i0, i1] = face.indices;
  const right = normalize([], sub([], shape.vertices[i1], shape.vertices[i0]));
  const up = normalize([], cross([], face.normal, right));
  const centroid = [0, 0, 0];
  for (const vi of face.indices) {
    for (let c = 0; c < 3; c += 1) centroid[c] += shape.vertices[vi][c] / face.indices.length;
  }
  let radius = 0;
  for (const vi of face.indices) {
    radius = Math.max(radius, length(sub([], shape.vertices[vi], centroid)));
  }
  return { centroid, right, up, radius };
}

function toFace2D(frame, vertex) {
  const d = sub([], vertex, frame.centroid);
  return [dot(d, frame.right), dot(d, frame.up)];
}

function faceInradius2D(shape, face, frame) {
  let min = Infinity;
  const idx = face.indices;
  for (let k = 0; k < idx.length; k += 1) {
    const a = toFace2D(frame, shape.vertices[idx[k]]);
    const b = toFace2D(frame, shape.vertices[idx[(k + 1) % idx.length]]);
    const e = [b[0] - a[0], b[1] - a[1]];
    min = Math.min(min, Math.abs(a[0] * e[1] - a[1] * e[0]) / Math.hypot(e[0], e[1]));
  }
  return min;
}

// Per face: its atlas rectangle and the UV of every corner vertex. The corner
// UVs use the same face frame as the atlas drawing, so labels land upright
// along the first face edge.
export function faceVertexUvs(shape) {
  const rects = faceRects(shape.faces.length);
  return shape.faces.map((face, f) => {
    const frame = faceFrame(shape, face);
    const rect = rects[f];
    const uvs = face.indices.map((vi) => {
      const [x, y] = toFace2D(frame, shape.vertices[vi]);
      return [
        rect.u0 + ((x / frame.radius + 1) / 2) * (rect.u1 - rect.u0),
        rect.v0 + ((y / frame.radius + 1) / 2) * (rect.v1 - rect.v0),
      ];
    });
    return { rect, uvs };
  });
}

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function inkFor(dieColor) {
  const [r, g, b] = luminance(dieColor) > 0.5 ? INK_DARK : INK_LIGHT;
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}

function makeCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  return document.createElement('canvas');
}

// Draws every face label into an atlas. The atlas is uploaded with
// UNPACK_FLIP_Y_WEBGL, so inside a cell face-up is canvas-up: a label drawn
// upright on the canvas reads upright on the face when the face basis points up.
export function buildLabelAtlas(shape, dieColor, size = ATLAS_SIZE) {
  const canvas = makeCanvas(size);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const ink = inkFor(dieColor);
  const rects = faceRects(shape.faces.length);
  shape.faces.forEach((face, f) => {
    drawFaceLabel(ctx, shape, face, rects[f], ink, size);
  });
  return { canvas, size, rects };
}

function drawFaceLabel(ctx, shape, face, rect, ink, size) {
  const frame = faceFrame(shape, face);
  const cellW = size * (rect.u1 - rect.u0);
  const cellH = size * (rect.v1 - rect.v0);
  const sx = cellW / (2 * frame.radius);
  const sy = cellH / (2 * frame.radius);
  const px = (x) => size * (rect.u0 + rect.u1) / 2 + sx * x;
  const py = (y) => size * (1 - (rect.v0 + rect.v1) / 2) - sy * y;
  const inradius = faceInradius2D(shape, face, frame);

  if (shape.type === 'd6') {
    drawPips(ctx, face.value, { px, py, sx, sy }, ink);
    return;
  }
  if (shape.type === 'd4') {
    for (const vi of face.indices) {
      const [x, y] = toFace2D(frame, shape.vertices[vi]);
      drawText(ctx, String(shape.vertexValues[vi]), {
        x: x * 0.62,
        y: y * 0.62,
        angle: Math.atan2(-x, y),
        maxWidth: 0.36 * frame.radius,
        maxHeight: 0.5 * frame.radius,
        sx, sy, ink,
      });
    }
    return;
  }
  drawText(ctx, String(face.value), {
    x: 0,
    y: 0,
    angle: 0,
    maxWidth: 1.7 * inradius,
    maxHeight: 1.15 * inradius,
    sx, sy, ink,
  });
}

function drawPips(ctx, value, { px, py, sx, sy }, ink) {
  ctx.fillStyle = ink;
  for (const [gx, gy] of PIP_LAYOUTS[value]) {
    ctx.beginPath();
    ctx.ellipse(px(gx * PIP_OFFSET), py(gy * PIP_OFFSET), PIP_RADIUS * sx, PIP_RADIUS * sy, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawText(ctx, text, { x, y, angle, maxWidth, maxHeight, sx, sy, ink }) {
  ctx.font = 'bold 100px Arial, "Helvetica Neue", Helvetica, sans-serif';
  const advance = ctx.measureText(text).width;
  // Font size in face units that fits both budgets, then converted to pixels.
  const fontFace = (100 * Math.min(maxHeight / CAP_HEIGHT, maxWidth / advance));
  const fontPx = fontFace * sy;

  ctx.save();
  ctx.translate(sx * x, -sy * y);
  ctx.rotate(-angle);
  ctx.scale(sx / sy, 1);
  ctx.font = `bold ${fontPx}px Arial, "Helvetica Neue", Helvetica, sans-serif`;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (text === '6' || text === '9') {
    const w = ctx.measureText(text).width;
    ctx.fillText(text, 0, 0);
    ctx.fillRect(-w * 0.35, fontPx * 0.45, w * 0.7, Math.max(2, fontPx * 0.12));
  } else {
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}
