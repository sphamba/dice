import { beforeAll, describe, expect, it, afterAll, vi } from 'vitest';
import { FLOOR_VERTICES, aoTargetSize, createRenderer } from './renderer.js';

describe('aoTargetSize', () => {
  it('gives the phone-box example size', () => {
    expect(aoTargetSize({ W: 0.0675, H: 0.1462 }, 1200, 2600)).toEqual([338, 731]);
  });

  it('never exceeds the backing size and stays at least 1x1', () => {
    expect(aoTargetSize({ W: 0.5, H: 0.5 }, 100, 100)).toEqual([100, 100]);
    expect(aoTargetSize({ W: 0.0001, H: 0.0001 }, 10, 10)).toEqual([1, 1]);
  });
});

// Minimal fake WebGL2 context: objects are plain records, framebuffer binds recorded.
// `state.fail` makes every shader compile report a failure with `state.infoLog`.
function makeFakeGl() {
  const state = { fail: false, infoLog: '' };
  const listeners = {};
  const canvas = {
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
  };
  let next = 0;
  const fresh = (kind) => ({ kind, id: (next += 1) });
  const boundFramebuffers = [];
  const gl = {
    canvas,
    isContextLost: () => false,
    // Distinct constants: the renderer only compares or passes them through.
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STATIC_DRAW: 7, FLOAT: 8,
    TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, RED: 12, R8: 13, RGBA8: 14,
    DEPTH_COMPONENT16: 15, DEPTH_COMPONENT24: 16,
    NEAREST: 17, LINEAR: 18, CLAMP_TO_EDGE: 19, TEXTURE_MIN_FILTER: 20,
    TEXTURE_MAG_FILTER: 21, TEXTURE_WRAP_S: 22, TEXTURE_WRAP_T: 23,
    UNPACK_FLIP_Y_WEBGL: 24, FRAMEBUFFER: 25, FRAMEBUFFER_COMPLETE: 26,
    COLOR_ATTACHMENT0: 27, DEPTH_ATTACHMENT: 28,
    TEXTURE0: 29, TEXTURE1: 30, TEXTURE2: 31, TEXTURE3: 32,
    TRIANGLES: 33, TRIANGLE_STRIP: 34, UNSIGNED_SHORT: 35,
    DEPTH_TEST: 36, CULL_FACE: 37, BACK: 38, COLOR_BUFFER_BIT: 39, DEPTH_BUFFER_BIT: 40,
    createShader: (type) => fresh('shader'),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => !state.fail,
    getShaderInfoLog: () => state.infoLog,
    deleteShader: () => {},
    createProgram: () => fresh('program'),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    createBuffer: () => fresh('buffer'),
    bindBuffer: () => {},
    bufferData: () => {},
    createVertexArray: () => fresh('vao'),
    bindVertexArray: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    deleteBuffer: () => {},
    deleteVertexArray: () => {},
    createTexture: () => fresh('texture'),
    bindTexture: () => {},
    pixelStorei: () => {},
    texImage2D: () => {},
    texParameteri: () => {},
    texStorage2D: () => {},
    texSubImage2D: () => {},
    deleteTexture: () => {},
    createFramebuffer: () => fresh('framebuffer'),
    bindFramebuffer: (target, fb) => { boundFramebuffers.push(fb); },
    framebufferTexture2D: () => {},
    checkFramebufferStatus: () => gl.FRAMEBUFFER_COMPLETE,
    deleteFramebuffer: () => {},
    drawBuffers: () => {},
    getUniformLocation: (program, name) => name,
    useProgram: () => {},
    uniform3fv: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform1i: () => {},
    uniformMatrix4fv: () => {},
    activeTexture: () => {},
    viewport: () => {},
    clearColor: () => {},
    clearDepth: () => {},
    clear: () => {},
    enable: () => {},
    disable: () => {},
    cullFace: () => {},
    drawArrays: () => {},
    drawElements: () => {},
  };
  return { gl, listeners, boundFramebuffers, state };
}

// buildLabelAtlas needs a canvas in node: a 2D context that records nothing.
beforeAll(() => {
  vi.stubGlobal('OffscreenCanvas', class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      return new Proxy({}, {
        get: (target, prop) => (prop === 'measureText' ? () => ({ width: 10 }) : () => {}),
        set: () => true,
      });
    }
  });
});
afterAll(() => vi.unstubAllGlobals());

const GL_BOX = { W: 0.0675, H: 0.1462, D: 0.05 };

describe('AO pipeline wiring (fake GL)', () => {
  it('compiles the GTAO programs and binds their framebuffers during draw', () => {
    const { gl, boundFramebuffers } = makeFakeGl();
    const renderer = createRenderer(gl);
    renderer.resize(1200, 2600, GL_BOX);
    boundFramebuffers.length = 0;
    renderer.draw([]);
    const drawnTo = boundFramebuffers.filter((fb) => fb !== null);
    expect(drawnTo).toHaveLength(3); // prepass, GTAO, blur targets
    expect(new Set(drawnTo).size).toBe(3);
    expect(boundFramebuffers.at(-1)).toBe(null); // scene renders to the canvas
    renderer.dispose();
  });

  it('reports a rejected shader with its info log at creation', () => {
    const { gl, state } = makeFakeGl();
    state.fail = true;
    state.infoLog = 'ERROR: 0:1: bad shader';
    expect(() => createRenderer(gl)).toThrow(/bad shader/);
  });

  it('reports a rebuild failure from the context restore path', () => {
    const { gl, listeners, state, boundFramebuffers } = makeFakeGl();
    const errors = [];
    const renderer = createRenderer(gl, { onError: (error) => errors.push(error) });
    renderer.resize(1200, 2600, GL_BOX);
    state.fail = true;
    state.infoLog = 'ERROR: 0:9: unreachable';
    for (const fn of listeners.webglcontextrestored) fn({ preventDefault() {} });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('unreachable');
    // draw() stays inert: the old handles died with the lost context.
    boundFramebuffers.length = 0;
    renderer.draw([]);
    expect(boundFramebuffers).toHaveLength(0);
    renderer.dispose();
  });

  it('rebuilds the programs and AO targets after a context restore', () => {
    const { gl, listeners, boundFramebuffers } = makeFakeGl();
    const renderer = createRenderer(gl);
    renderer.resize(1200, 2600, GL_BOX);
    boundFramebuffers.length = 0;
    renderer.draw([]);
    const before = boundFramebuffers.filter((fb) => fb !== null);
    boundFramebuffers.length = 0;
    for (const fn of listeners.webglcontextrestored) fn({ preventDefault() {} });
    const restored = boundFramebuffers.filter((fb) => fb !== null);
    expect(restored).toHaveLength(3); // targets recreated during restore
    boundFramebuffers.length = 0;
    renderer.draw([]);
    const after = boundFramebuffers.filter((fb) => fb !== null);
    expect(after).toHaveLength(3);
    expect(after.every((fb) => !before.includes(fb))).toBe(true);
    renderer.dispose();
  });
});

// GL triangle strips emit (v0,v1,v2) then (v2,v1,v3), so the second triangle's
// winding is reversed by the strip itself. CCW in NDC is front-facing.
function signedArea(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

describe('floor mesh winding', () => {
  it('emits both strip triangles front-facing', () => {
    const v = [];
    for (let i = 0; i < FLOOR_VERTICES.length; i += 2) {
      v.push([FLOOR_VERTICES[i], FLOOR_VERTICES[i + 1]]);
    }
    expect(v).toHaveLength(4);
    expect(signedArea(v[0], v[1], v[2])).toBeGreaterThan(0);
    expect(signedArea(v[2], v[1], v[3])).toBeGreaterThan(0);
  });

  it('covers the full -1..1 quad', () => {
    const xs = [...FLOOR_VERTICES].filter((_, i) => i % 2 === 0);
    const ys = [...FLOOR_VERTICES].filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(-1);
    expect(Math.max(...xs)).toBe(1);
    expect(Math.min(...ys)).toBe(-1);
    expect(Math.max(...ys)).toBe(1);
  });
});
