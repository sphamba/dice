import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as shaders from './shaders.js';

const FRAGMENTS = {
  aoPrepass: shaders.aoPrepassFragmentSource,
  gtao: shaders.gtaoFragmentSource({
    slices: 2,
    steps: 4,
    samplePower: '2.0',
    finalPower: '2.2',
    zFalloffScale: '0.5',
  }),
  blur: shaders.blurFragmentSource(),
  dice: shaders.diceFragmentSource,
  floor: shaders.floorFragmentSource,
};

const VERTICES = {
  fullscreen: shaders.fullscreenVertexSource,
  dice: shaders.diceVertexSource,
  floor: shaders.floorVertexSource,
};

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('shader source portability', () => {
  it('keeps the modulo operator out of every program', () => {
    for (const [name, source] of Object.entries({ ...FRAGMENTS, ...VERTICES })) {
      expect(source, name).not.toContain('%');
    }
  });

  it('bounds every loop with a constant', () => {
    for (const [name, source] of Object.entries({ ...FRAGMENTS, ...VERTICES })) {
      for (const header of source.match(/for\s*\([^)]*\)/g) ?? []) {
        expect(header, `${name} ${header}`).not.toMatch(/\bu[A-Z]/);
      }
    }
  });

  it('walks the hull with a constant bound and a count break', () => {
    expect(FRAGMENTS.dice).toContain('for (int k = 0; k < 20; k++)');
    expect(FRAGMENTS.dice).toContain('if (k >= uHullCount) break;');
  });

  it('guards the outline fwidth division', () => {
    expect(FRAGMENTS.dice).toContain('max(fwidth(d), 1e-7)');
  });
});

describe('render error path', () => {
  const main = read('../main.js');

  it('requests an opaque canvas that survives skipped frames', () => {
    expect(main).toContain("getContext('webgl2', { alpha: false, preserveDrawingBuffer: true })");
  });

  it('reports a renderer creation failure on the page', () => {
    expect(main).toMatch(/try \{\s*return createRenderer\(gl, \{ onError: showError \}\);/);
    expect(main).toMatch(/catch \(error\) \{[\s\S]*?showError\(error\);/);
  });

  it('listens for uncaught errors and rejections', () => {
    expect(main).toContain("addEventListener('error'");
    expect(main).toContain("addEventListener('unhandledrejection'");
  });

  it('keeps no silent catch in the render directory', () => {
    for (const file of ['renderer.js', 'gl.js', 'shaders.js']) {
      expect(read(`./${file}`), file).not.toMatch(/catch\s*(\([^)]*\))?\s*\{\s*\}/);
    }
  });
});
