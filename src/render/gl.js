export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader compile failed: ${log}`);
  }
  return shader;
}

export function compileProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  return program;
}

export function createBuffer(gl, data, target = gl.ARRAY_BUFFER) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

// attributes: [{ location, data, size }]; indices optional (Uint16Array).
export function createVAO(gl, attributes, indices = null) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffers = attributes.map(({ location, data, size }) => {
    const buffer = createBuffer(gl, data);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  });
  let indexBuffer = null;
  let indexCount = 0;
  if (indices) {
    indexBuffer = createBuffer(gl, indices, gl.ELEMENT_ARRAY_BUFFER);
    indexCount = indices.length;
  }
  gl.bindVertexArray(null);
  return { vao, buffers, indexBuffer, indexCount };
}

export function deleteVAO(gl, mesh) {
  for (const buffer of mesh.buffers) gl.deleteBuffer(buffer);
  if (mesh.indexBuffer) gl.deleteBuffer(mesh.indexBuffer);
  gl.deleteVertexArray(mesh.vao);
}

export function createDepthTexture(gl, size) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function createLabelTexture(gl, canvas) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function createDepthFramebuffer(gl, depthTexture) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
  gl.drawBuffers([gl.NONE]);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`shadow framebuffer incomplete: 0x${status.toString(16)}`);
  }
  return framebuffer;
}
