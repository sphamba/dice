import { DICE_TYPES, createShape } from '../dice/shapes.js';
import { buildLabelAtlas, faceVertexUvs } from '../dice/labels.js';
import * as mat4 from '../math/mat4.js';
import * as vec3 from '../math/vec3.js';
import { DIE_RADIUS } from '../physics/body.js';
import { createCamera, createLightViewProjection } from './camera.js';
import * as shaders from './shaders.js';
import {
  compileProgram,
  createDepthFramebuffer,
  createDepthTexture,
  createLabelTexture,
  createVAO,
  deleteVAO,
} from './gl.js';

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
  ambient: 0.35,
  intensity: 0.9,
};

const FLOOR_COLOR = [0.16, 0.15, 0.135];
const CLEAR_COLOR = [0.078, 0.082, 0.102];

const DEPTH_UNIFORMS = ['uLightViewProj', 'uModel'];
const FLOOR_UNIFORMS = ['uViewProj', 'uLightViewProj', 'uHalfExtents', 'uColor', 'uLightDir', 'uEye', 'uAmbient', 'uIntensity', 'uShadowMap', 'uShadowTexel'];
const DICE_UNIFORMS = ['uViewProj', 'uLightViewProj', 'uModel', 'uColor', 'uLightDir', 'uEye', 'uAmbient', 'uIntensity', 'uShadowMap', 'uShadowTexel', 'uAtlas'];

function uniformMap(gl, program, names) {
  const map = {};
  for (const name of names) map[name] = gl.getUniformLocation(program, name);
  return map;
}

// Expanded flat-shaded mesh: per-face vertices with face normal and atlas UV.
function buildDieMesh(gl, shape) {
  const layout = faceVertexUvs(shape);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  shape.faces.forEach((face, f) => {
    const base = positions.length / 3;
    face.indices.forEach((vi, k) => {
      const v = shape.vertices[vi];
      positions.push(v[0], v[1], v[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      uvs.push(layout[f].uvs[k][0], layout[f].uvs[k][1]);
    });
    for (let k = 1; k + 1 < face.indices.length; k += 1) {
      indices.push(base, base + k, base + k + 1);
    }
  });
  return createVAO(gl, [
    { location: 0, data: new Float32Array(positions), size: 3 },
    { location: 1, data: new Float32Array(normals), size: 3 },
    { location: 2, data: new Float32Array(uvs), size: 2 },
  ], new Uint16Array(indices));
}

function buildFloorMesh(gl) {
  return createVAO(gl, [
    { location: 0, data: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), size: 2 },
  ]);
}

export function createRenderer(gl) {
  const shadowSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2048 ? 2048 : 1024;
  let resources = null;
  let box = null;
  let viewport = [0, 0];
  let viewProjection = null;
  let eye = null;
  let lightViewProjection = null;
  let lightDirection = null;
  const model = mat4.create();

  function buildResources() {
    const dice = new Map();
    for (const type of DICE_TYPES) {
      const shape = createShape(type, DIE_RADIUS);
      const mesh = buildDieMesh(gl, shape);
      const atlas = buildLabelAtlas(shape, DIE_COLORS[type]);
      dice.set(type, {
        mesh,
        texture: createLabelTexture(gl, atlas.canvas),
        color: DIE_COLORS[type],
      });
    }
    const depthProgram = compileProgram(gl, shaders.depthVertexSource, shaders.depthFragmentSource);
    const diceProgram = compileProgram(gl, shaders.diceVertexSource, shaders.diceFragmentSource);
    const floorProgram = compileProgram(gl, shaders.floorVertexSource, shaders.floorFragmentSource);
    const shadowTexture = createDepthTexture(gl, shadowSize);
    const shadowFramebuffer = createDepthFramebuffer(gl, shadowTexture);
    return {
      dice,
      floorMesh: buildFloorMesh(gl),
      depthProgram,
      diceProgram,
      floorProgram,
      depthUniforms: uniformMap(gl, depthProgram, DEPTH_UNIFORMS),
      diceUniforms: uniformMap(gl, diceProgram, DICE_UNIFORMS),
      floorUniforms: uniformMap(gl, floorProgram, FLOOR_UNIFORMS),
      shadowTexture,
      shadowFramebuffer,
    };
  }

  function destroyResources(r) {
    for (const { mesh, texture } of r.dice.values()) {
      deleteVAO(gl, mesh);
      gl.deleteTexture(texture);
    }
    deleteVAO(gl, r.floorMesh);
    gl.deleteProgram(r.depthProgram);
    gl.deleteProgram(r.diceProgram);
    gl.deleteProgram(r.floorProgram);
    gl.deleteFramebuffer(r.shadowFramebuffer);
    gl.deleteTexture(r.shadowTexture);
  }

  resources = buildResources();

  const canvas = gl.canvas;
  const handleContextLost = (event) => event.preventDefault();
  const handleContextRestored = () => {
    resources = buildResources();
  };
  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  function setLightUniforms(uniforms, options) {
    gl.uniform3fv(uniforms.uLightDir, lightDirection);
    gl.uniform3fv(uniforms.uEye, eye);
    gl.uniform1f(uniforms.uAmbient, options.ambient);
    gl.uniform1f(uniforms.uIntensity, options.intensity);
    gl.uniform2f(uniforms.uShadowTexel, 1 / shadowSize, 1 / shadowSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.shadowTexture);
    gl.uniform1i(uniforms.uShadowMap, 0);
  }

  function drawShadowPass(bodies) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, resources.shadowFramebuffer);
    gl.viewport(0, 0, shadowSize, shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(resources.depthProgram);
    gl.uniformMatrix4fv(resources.depthUniforms.uLightViewProj, false, lightViewProjection);
    for (const body of bodies) {
      const entry = resources.dice.get(body.shape.type);
      if (!entry) continue;
      mat4.fromRotationTranslation(model, body.orientation, body.position);
      gl.bindVertexArray(entry.mesh.vao);
      gl.uniformMatrix4fv(resources.depthUniforms.uModel, false, model);
      gl.drawElements(gl.TRIANGLES, entry.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  function drawFloorPass(options) {
    gl.useProgram(resources.floorProgram);
    gl.bindVertexArray(resources.floorMesh.vao);
    const u = resources.floorUniforms;
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection);
    gl.uniformMatrix4fv(u.uLightViewProj, false, lightViewProjection);
    gl.uniform2f(u.uHalfExtents, box.W / 2, box.H / 2);
    gl.uniform3fv(u.uColor, FLOOR_COLOR);
    setLightUniforms(u, options);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawDicePass(bodies, options) {
    gl.useProgram(resources.diceProgram);
    const u = resources.diceUniforms;
    gl.uniformMatrix4fv(u.uViewProj, false, viewProjection);
    gl.uniformMatrix4fv(u.uLightViewProj, false, lightViewProjection);
    gl.uniform1i(u.uAtlas, 1);
    setLightUniforms(u, options);
    gl.activeTexture(gl.TEXTURE1);
    for (const body of bodies) {
      const entry = resources.dice.get(body.shape.type);
      if (!entry) continue;
      mat4.fromRotationTranslation(model, body.orientation, body.position);
      gl.bindVertexArray(entry.mesh.vao);
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.uniformMatrix4fv(u.uModel, false, model);
      gl.uniform3fv(u.uColor, entry.color);
      gl.drawElements(gl.TRIANGLES, entry.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  return {
    resize(pixelW, pixelH, nextBox) {
      viewport = [pixelW, pixelH];
      box = nextBox;
      const camera = createCamera(box);
      eye = camera.eye;
      viewProjection = mat4.multiply(mat4.create(), camera.projection, camera.view);
      lightDirection = null;
    },

    draw(bodies, lightOptions = {}) {
      if (!box || !resources || gl.isContextLost()) return;
      const options = { ...DEFAULT_LIGHT_OPTIONS, ...lightOptions };
      const direction = vec3.normalize(vec3.create(), options.direction);
      const changed = !lightDirection || direction.some((c, i) => c !== lightDirection[i]);
      if (changed) {
        const light = createLightViewProjection(box, direction);
        lightViewProjection = mat4.multiply(mat4.create(), light.projection, light.view);
        lightDirection = direction;
      }

      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);

      drawShadowPass(bodies);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, viewport[0], viewport[1]);
      gl.clearColor(CLEAR_COLOR[0], CLEAR_COLOR[1], CLEAR_COLOR[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawFloorPass(options);
      drawDicePass(bodies, options);
      gl.bindVertexArray(null);
    },

    dispose() {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (resources) {
        destroyResources(resources);
        resources = null;
      }
      box = null;
    },
  };
}
