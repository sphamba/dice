import { DICE_TYPES, createShape } from '../dice/shapes.js';
import { buildLabelAtlas, faceInsetData, faceVertexUvs } from '../dice/labels.js';
import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';
import { BEVEL_RADIUS, DIE_RADIUS } from '../physics/body.js';
import { createCamera, floorClearDepth, worldZFromDepth } from './camera.js';
import * as shaders from './shaders.js';
import {
  compileProgram,
  createColorTexture,
  createDepthTexture,
  createFramebuffer,
  createLabelTexture,
  createCarveTexture,
  createVAO,
  deleteVAO,
} from './gl.js';
import { buildCarveAtlas } from '../dice/carve.js';

// One color per dice type; label ink in the atlas contrasts via luminance.
const DIE_COLORS = {
  d4: [0.93, 0.87, 0.62],
  d6: [0.78, 0.22, 0.18],
  d8: [0.2, 0.55, 0.3],
  d10: [0.2, 0.38, 0.75],
  d12: [0.55, 0.3, 0.72],
  d20: [0.9, 0.48, 0.13],
};

export const DEFAULT_LIGHT_OPTIONS = {
  // Unit vector pointing along the light travel direction, tilted ~30 deg from -z.
  direction: [-0.4, -0.3, -0.8660254037844386],
  ambient: 0.5,
  intensity: 0.65,
};

// GTAO starting parameters (tuned live).
export const AO_TEXEL = 0.0002;
export const AO_SLICES = 2;
export const AO_STEPS = 4;
export const AO_SAMPLE_POWER = 2.0;
export const AO_RADIUS_SCALE = 1.2;
export const AO_FALLOFF_RANGE = 0.615;
export const AO_Z_FALLOFF_SCALE = 0.5;
export const AO_FINAL_POWER = 2.2;
export const AO_BLUR_DZ = 0.001;
export const DIRECT_AO = 0.5;

export const AO_RADIUS = AO_RADIUS_SCALE * DIE_RADIUS;
const AO_FALLOFF_MUL = -1 / (AO_FALLOFF_RANGE * AO_RADIUS);
const AO_FALLOFF_ADD = (1 - AO_FALLOFF_RANGE) / AO_FALLOFF_RANGE + 1;
const AO_MIN_DIST = 1.3 * AO_TEXEL;

const FLOOR_COLOR = [0.16, 0.15, 0.135];
const CLEAR_COLOR = [0.078, 0.082, 0.102];

const GTAO_UNIFORMS = ['uNormalTex', 'uDepthTex', 'uHalfExtents', 'uTexelWorld', 'uAoSize', 'uDepthRange', 'uRadius', 'uFalloffMul', 'uFalloffAdd', 'uMinDist'];
const BLUR_UNIFORMS = ['uAoTex', 'uDepthTex', 'uDepthRange', 'uBlurDz'];
const LIGHT_UNIFORMS = ['uLightDir', 'uAmbient', 'uIntensity', 'uDirectAo', 'uAo', 'uAoDepth', 'uAoSize', 'uViewport', 'uDepthRange'];
const FLOOR_UNIFORMS = ['uViewProj', 'uHalfExtents', 'uColor', ...LIGHT_UNIFORMS];
const DICE_UNIFORMS = ['uViewProj', 'uModel', 'uColor', 'uAtlas', 'uCarve', 'uHull', 'uHullCount', 'uBevelRadius', ...LIGHT_UNIFORMS];

function uniformMap(gl, program, names) {
  const map = {};
  for (const name of names) map[name] = gl.getUniformLocation(program, name);
  return map;
}

// Monotone chain convex hull: CCW, collinear and duplicate points dropped.
// Monotone chain convex hull: CCW, collinear and duplicate points dropped.
// Near-collinear points are dropped too (relative sine tolerance): at some
// resting poses a shape corner lands within tens of nanometers of the edge
// through its neighbours. Keeping it adds a degenerate ~10nm hull edge whose
// orientation is decided by float64 noise; if it points against the winding,
// the shader's min-cross inside test classifies half the die's interior as
// outside and the bevel-radius discard punches a large hole into the dice and
// the AO prepass for one frame (task #67). Dropping the point moves the hull
// boundary by at most SIN_EPS x the edge length (~0.1um), far below the
// bevel-radius discard margin.
const SIN_EPS = 1e-4;
export function convexHull2D(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (source) => {
    const half = [];
    for (const p of source) {
      while (half.length >= 2) {
        const o = half[half.length - 2];
        const a = half[half.length - 1];
        const cr = cross(o, a, p);
        const oa = Math.hypot(a[0] - o[0], a[1] - o[1]);
        const op = Math.hypot(p[0] - o[0], p[1] - o[1]);
        if (cr <= 0 || (oa > 0 && op > 0 && cr / (oa * op) <= SIN_EPS)) half.pop();
        else break;
      }
      half.push(p);
    }
    return half;
  };
  const lower = chain(pts);
  const upper = chain([...pts].reverse());
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// Hull of the s-scaled shape vertices transformed by the model matrix: the
// silhouette the rounded outline wraps with a bevel-radius margin.
export function projectedInsetHull(shape, model, scale) {
  const points = shape.vertices.map((v) => {
    const x = scale * v[0];
    const y = scale * v[1];
    const z = scale * v[2];
    return [
      model[0] * x + model[4] * y + model[8] * z + model[12],
      model[1] * x + model[5] * y + model[9] * z + model[13],
    ];
  });
  return convexHull2D(points);
}

// JS mirror of the shader hull distance: 0 inside the CCW hull, the segment
// distance outside. Same degenerate-edge tolerance as the shader (see
// hullDistance in shaders.js).
export function pointHullDistance2D(hull, p) {
  if (hull.length < 3) return Infinity;
  let best = Infinity;
  let minCr = Infinity;
  for (let k = 0; k < hull.length; k += 1) {
    const a = hull[k];
    const b = hull[(k + 1) % hull.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const wx = p[0] - a[0];
    const wy = p[1] - a[1];
    const t = Math.min(Math.max((wx * ex + wy * ey) / Math.max(ex * ex + ey * ey, 1e-12), 0), 1);
    best = Math.min(best, Math.hypot(wx - t * ex, wy - t * ey));
    minCr = Math.min(minCr, ex * wy - ey * wx);
  }
  return minCr >= -1e-9 ? 0 : best;
}

const HULL_DATA = new Float32Array(40);

function setHullUniform(gl, uniforms, entry, model) {
  const hull = projectedInsetHull(entry.shape, model, entry.bevelScale);
  for (let i = 0; i < hull.length; i += 1) {
    HULL_DATA[i * 2] = hull[i][0];
    HULL_DATA[i * 2 + 1] = hull[i][1];
  }
  gl.uniform2fv(uniforms.uHull, HULL_DATA);
  gl.uniform1i(uniforms.uHullCount, hull.length);
}

// Expanded flat-shaded mesh: per-face vertices with face normal, atlas UV and
// the bevel frame data for the rounded-edge shader.
function buildDieMesh(gl, shape, bevel) {
  const layout = faceVertexUvs(shape);
  const positions = [];
  const normals = [];
  const uvs = [];
  const facePos = [];
  const tangents = [];
  const inset01 = [];
  const inset23 = [];
  const inset44 = [];
  const indices = [];
  shape.faces.forEach((face, f) => {
    const base = positions.length / 3;
    const { right, face2D, inset } = bevel[f];
    face.indices.forEach((vi, k) => {
      const v = shape.vertices[vi];
      positions.push(v[0], v[1], v[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      uvs.push(layout[f].uvs[k][0], layout[f].uvs[k][1]);
      facePos.push(face2D[k][0], face2D[k][1]);
      tangents.push(right[0], right[1], right[2]);
      inset01.push(inset[0][0], inset[0][1], inset[1][0], inset[1][1]);
      inset23.push(inset[2][0], inset[2][1], inset[3][0], inset[3][1]);
      inset44.push(inset[4][0], inset[4][1], inset[4][0], inset[4][1]);
    });
    for (let k = 1; k + 1 < face.indices.length; k += 1) {
      indices.push(base, base + k, base + k + 1);
    }
  });
  return createVAO(gl, [
    { location: 0, data: new Float32Array(positions), size: 3 },
    { location: 1, data: new Float32Array(normals), size: 3 },
    { location: 2, data: new Float32Array(uvs), size: 2 },
    { location: 3, data: new Float32Array(facePos), size: 2 },
    { location: 4, data: new Float32Array(tangents), size: 3 },
    { location: 5, data: new Float32Array(inset01), size: 4 },
    { location: 6, data: new Float32Array(inset23), size: 4 },
    { location: 7, data: new Float32Array(inset44), size: 4 },
  ], new Uint16Array(indices));
}

// Strip order keeps both emitted triangles CCW: (v0,v1,v2) and (v2,v1,v3).
export const FLOOR_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

function buildFloorMesh(gl) {
  return createVAO(gl, [{ location: 0, data: FLOOR_VERTICES, size: 2 }]);
}

// AO render resolution: fixed world-space texel size, clamped to the backing buffer.
export function aoTargetSize(box, backingW, backingH) {
  const size = (extent, backing) => Math.max(1, Math.min(Math.ceil(extent / AO_TEXEL), backing));
  return [size(box.W, backingW), size(box.H, backingH)];
}

export function createRenderer(gl, { onError = (error) => console.error(error) } = {}) {
  let resources = null;
  let aoSetup = null;
  let box = null;
  let viewport = [0, 0];
  let viewProjection = null;
  const model = mat4.create();

  function buildResources() {
    const dice = new Map();
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const bevel = faceInsetData(shape, BEVEL_RADIUS);
      const mesh = buildDieMesh(gl, shape, bevel);
      const atlas = buildLabelAtlas(shape, DIE_COLORS[type]);
      const carve = buildCarveAtlas(shape, atlas);
      dice.set(type, {
        mesh,
        texture: createLabelTexture(gl, atlas.canvas),
        carveTexture: createCarveTexture(gl, carve.size, carve.data),
        color: DIE_COLORS[type],
        shape,
        bevelScale: bevel[0].scale,
      });
    }
    const diceProgram = compileProgram(gl, shaders.diceVertexSource, shaders.diceFragmentSource);
    const floorProgram = compileProgram(gl, shaders.floorVertexSource, shaders.floorFragmentSource);
    // 1x1 white R8 fallback: bound as AO input when the AO setup failed.
    const whiteTex = createColorTexture(gl, 1, 1, gl.R8);
    gl.bindTexture(gl.TEXTURE_2D, whiteTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([255]));
    gl.useProgram(diceProgram);
    gl.uniform1f(gl.getUniformLocation(diceProgram, 'uBevelRadius'), BEVEL_RADIUS);
    return {
      dice,
      floorMesh: buildFloorMesh(gl),
      diceProgram,
      floorProgram,
      diceUniforms: uniformMap(gl, diceProgram, DICE_UNIFORMS),
      floorUniforms: uniformMap(gl, floorProgram, FLOOR_UNIFORMS),
      whiteTex,
    };
  }

  function destroyResources(r) {
    for (const { mesh, texture, carveTexture } of r.dice.values()) {
      deleteVAO(gl, mesh);
      gl.deleteTexture(texture);
      gl.deleteTexture(carveTexture);
    }
    deleteVAO(gl, r.floorMesh);
    gl.deleteProgram(r.diceProgram);
    gl.deleteProgram(r.floorProgram);
    gl.deleteTexture(r.whiteTex);
  }

  // AO programs and render targets. Throws on compile/link/FBO failure; the
  // caller catches and falls back to the 1x1 white texture.
  function buildAoSetup() {
    const prepassProgram = compileProgram(gl, shaders.diceVertexSource, shaders.aoPrepassFragmentSource);
    const gtaoProgram = compileProgram(gl, shaders.fullscreenVertexSource, shaders.gtaoFragmentSource({
      slices: AO_SLICES,
      steps: AO_STEPS,
      samplePower: AO_SAMPLE_POWER.toFixed(1),
      finalPower: AO_FINAL_POWER.toFixed(1),
      zFalloffScale: AO_Z_FALLOFF_SCALE.toFixed(1),
    }));
    const blurProgram = compileProgram(gl, shaders.fullscreenVertexSource, shaders.blurFragmentSource());
    gl.useProgram(prepassProgram);
    gl.uniform1f(gl.getUniformLocation(prepassProgram, 'uBevelRadius'), BEVEL_RADIUS);
    return {
      prepassProgram,
      gtaoProgram,
      blurProgram,
      prepassUniforms: uniformMap(gl, prepassProgram, ['uViewProj', 'uModel', 'uHull', 'uHullCount', 'uDepthRange']),
      gtaoUniforms: uniformMap(gl, gtaoProgram, GTAO_UNIFORMS),
      blurUniforms: uniformMap(gl, blurProgram, BLUR_UNIFORMS),
      targets: null,
      size: null,
    };
  }

  function destroyAoSetup() {
    if (aoSetup.targets) {
      const t = aoSetup.targets;
      gl.deleteFramebuffer(t.prepassFramebuffer);
      gl.deleteFramebuffer(t.aoAFramebuffer);
      gl.deleteFramebuffer(t.aoBFramebuffer);
      gl.deleteTexture(t.normalTex);
      gl.deleteTexture(t.aoDepthTex);
      gl.deleteTexture(t.aoATex);
      gl.deleteTexture(t.aoBTex);
    }
    gl.deleteProgram(aoSetup.prepassProgram);
    gl.deleteProgram(aoSetup.gtaoProgram);
    gl.deleteProgram(aoSetup.blurProgram);
    aoSetup = null;
  }

  function ensureAoTargets(size) {
    if (aoSetup.size && aoSetup.size[0] === size[0] && aoSetup.size[1] === size[1]) return;
    if (aoSetup.targets) {
      const t = aoSetup.targets;
      gl.deleteFramebuffer(t.prepassFramebuffer);
      gl.deleteFramebuffer(t.aoAFramebuffer);
      gl.deleteFramebuffer(t.aoBFramebuffer);
      gl.deleteTexture(t.normalTex);
      gl.deleteTexture(t.aoDepthTex);
      gl.deleteTexture(t.aoATex);
      gl.deleteTexture(t.aoBTex);
    }
    const normalTex = createColorTexture(gl, size[0], size[1], gl.RGBA8);
    const aoDepthTex = createDepthTexture(gl, size[0], size[1], gl.DEPTH_COMPONENT16);
    const aoATex = createColorTexture(gl, size[0], size[1], gl.R8);
    const aoBTex = createColorTexture(gl, size[0], size[1], gl.R8);
    const prepassFramebuffer = createFramebuffer(gl, [normalTex], aoDepthTex);
    const aoAFramebuffer = createFramebuffer(gl, [aoATex]);
    const aoBFramebuffer = createFramebuffer(gl, [aoBTex]);
    aoSetup.targets = { normalTex, aoDepthTex, aoATex, aoBTex, prepassFramebuffer, aoAFramebuffer, aoBFramebuffer };
    aoSetup.size = size;
  }

  resources = buildResources();
  try {
    aoSetup = buildAoSetup();
  } catch (error) {
    console.error('ambient occlusion unavailable, rendering without it', error);
    aoSetup = null;
  }

  const canvas = gl.canvas;
  const handleContextLost = (event) => event.preventDefault();
  const handleContextRestored = () => {
    try {
      resources = buildResources();
    } catch (error) {
      // Objects from before the loss are dead: leave nothing for draw() to use.
      resources = null;
      onError(error);
      return;
    }
    try {
      aoSetup = buildAoSetup();
      if (box) ensureAoTargets(aoTargetSize(box, viewport[0], viewport[1]));
    } catch (error) {
      console.error('ambient occlusion unavailable after a context restore', error);
      aoSetup = null;
    }
  };
  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  function setLightUniforms(uniforms, options, direction, depthRange) {
    const [aoW, aoH] = aoSetup?.size ?? [1, 1];
    gl.uniform3fv(uniforms.uLightDir, direction);
    gl.uniform1f(uniforms.uAmbient, options.ambient);
    gl.uniform1f(uniforms.uIntensity, options.intensity);
    gl.uniform1f(uniforms.uDirectAo, DIRECT_AO);
    gl.uniform2f(uniforms.uAoSize, aoW, aoH);
    gl.uniform2f(uniforms.uViewport, viewport[0], viewport[1]);
    gl.uniform2f(uniforms.uDepthRange, depthRange[0], depthRange[1]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, aoSetup?.targets ? aoSetup.targets.aoBTex : resources.whiteTex);
    gl.uniform1i(uniforms.uAo, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, aoSetup?.targets ? aoSetup.targets.aoDepthTex : resources.whiteTex);
    gl.uniform1i(uniforms.uAoDepth, 3);
  }

  function drawAoPasses(bodies, depthRange) {
    const t = aoSetup.targets;
    const [aoW, aoH] = aoSetup.size;
    const u = aoSetup.prepassUniforms;

    // 1. AO prepass: dice only; cleared to the floor plane state.
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.prepassFramebuffer);
    gl.viewport(0, 0, aoW, aoH);
    gl.clearColor(0.5, 0.5, 1, 1);
    gl.clearDepth(floorClearDepth(box));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(aoSetup.prepassProgram);
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection);
    gl.uniform2f(u.uDepthRange, depthRange[0], depthRange[1]);
    for (const body of bodies) {
      const entry = resources.dice.get(body.shape.type);
      if (!entry) continue;
      mat4.fromRotationTranslation(model, body.orientation, body.position);
      gl.bindVertexArray(entry.mesh.vao);
      gl.uniformMatrix4fv(u.uModel, false, model);
      setHullUniform(gl, u, entry, model);
      gl.drawElements(gl.TRIANGLES, entry.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // 2. GTAO slice integral into A.
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.aoAFramebuffer);
    gl.useProgram(aoSetup.gtaoProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.normalTex);
    gl.uniform1i(aoSetup.gtaoUniforms.uNormalTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, t.aoDepthTex);
    gl.uniform1i(aoSetup.gtaoUniforms.uDepthTex, 1);
    gl.uniform2f(aoSetup.gtaoUniforms.uHalfExtents, box.W / 2, box.H / 2);
    gl.uniform2f(aoSetup.gtaoUniforms.uTexelWorld, box.W / aoW, box.H / aoH);
    gl.uniform2f(aoSetup.gtaoUniforms.uAoSize, aoW, aoH);
    gl.uniform2f(aoSetup.gtaoUniforms.uDepthRange, depthRange[0], depthRange[1]);
    gl.uniform1f(aoSetup.gtaoUniforms.uRadius, AO_RADIUS);
    gl.uniform1f(aoSetup.gtaoUniforms.uFalloffMul, AO_FALLOFF_MUL);
    gl.uniform1f(aoSetup.gtaoUniforms.uFalloffAdd, AO_FALLOFF_ADD);
    gl.uniform1f(aoSetup.gtaoUniforms.uMinDist, AO_MIN_DIST);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. Edge-aware blur from A into B.
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.aoBFramebuffer);
    gl.useProgram(aoSetup.blurProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.aoATex);
    gl.uniform1i(aoSetup.blurUniforms.uAoTex, 0);
    gl.uniform1i(aoSetup.blurUniforms.uDepthTex, 1);
    gl.uniform2f(aoSetup.blurUniforms.uDepthRange, depthRange[0], depthRange[1]);
    gl.uniform1f(aoSetup.blurUniforms.uBlurDz, AO_BLUR_DZ);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
  }

  function drawFloorPass(options, direction, depthRange) {
    gl.useProgram(resources.floorProgram);
    gl.bindVertexArray(resources.floorMesh.vao);
    const u = resources.floorUniforms;
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection);
    gl.uniform2f(u.uHalfExtents, box.W / 2, box.H / 2);
    gl.uniform3fv(u.uColor, FLOOR_COLOR);
    setLightUniforms(u, options, direction, depthRange);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawDicePass(bodies, options, direction, depthRange) {
    gl.useProgram(resources.diceProgram);
    const u = resources.diceUniforms;
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection);
    gl.uniform1i(u.uAtlas, 1);
    gl.uniform1i(u.uCarve, 4);
    setLightUniforms(u, options, direction, depthRange);
    gl.activeTexture(gl.TEXTURE1);
    // Coverage-masked edges: fragment alpha near the rounded outline turns
    // samples off, so the sharp silhouette reads rounded.
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    for (const body of bodies) {
      const entry = resources.dice.get(body.shape.type);
      if (!entry) continue;
      mat4.fromRotationTranslation(model, body.orientation, body.position);
      gl.bindVertexArray(entry.mesh.vao);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, entry.carveTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniform3fv(u.uColor, entry.color);
      setHullUniform(gl, u, entry, model);
      gl.drawElements(gl.TRIANGLES, entry.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
  }

  return {
    resize(pixelW, pixelH, nextBox) {
      viewport = [pixelW, pixelH];
      box = nextBox;
      const camera = createCamera(box);
      viewProjection = mat4.multiply(mat4.create(), camera.projection, camera.view);
      if (!aoSetup) return;
      try {
        ensureAoTargets(aoTargetSize(box, pixelW, pixelH));
      } catch (error) {
        console.error('ambient occlusion targets failed, disabling the pass', error);
        destroyAoSetup();
      }
    },

    draw(bodies, lightOptions = {}) {
      if (!box || !resources || gl.isContextLost()) return;
      const options = { ...DEFAULT_LIGHT_OPTIONS, ...lightOptions };
      const direction = vec3.normalize(vec3.create(), options.direction);
      const near = worldZFromDepth(0, box);
      const depthRange = [near, near - worldZFromDepth(1, box)];

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      if (aoSetup?.targets) drawAoPasses(bodies, depthRange);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, viewport[0], viewport[1]);
      gl.clearColor(CLEAR_COLOR[0], CLEAR_COLOR[1], CLEAR_COLOR[2], 1);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawFloorPass(options, direction, depthRange);
      drawDicePass(bodies, options, direction, depthRange);
      gl.bindVertexArray(null);
    },

    dispose() {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (aoSetup) destroyAoSetup();
      if (resources) {
        destroyResources(resources);
        resources = null;
      }
      box = null;
    },
  };
}
