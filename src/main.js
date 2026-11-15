import { backingSize } from './render/canvas-size.js';

const canvas = document.querySelector('#view');
const ui = document.querySelector('#ui');
const gl = canvas.getContext('webgl2');

function resize() {
  const { width, height } = backingSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0.078, 0.082, 0.102, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

if (gl) {
  addEventListener('resize', resize);
  resize();
} else {
  const message = document.createElement('p');
  message.id = 'unsupported';
  message.textContent = 'WebGL2 is not supported by this browser';
  ui.append(message);
}
