export function create() {
  return new Float32Array(9);
}

export function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}

export function fromQuat(out, q) {
  const x = q[0];
  const y = q[1];
  const z = q[2];
  const w = q[3];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  out[0] = 1 - (yy + zz);
  out[1] = xy + wz;
  out[2] = xz - wy;
  out[3] = xy - wz;
  out[4] = 1 - (xx + zz);
  out[5] = yz + wx;
  out[6] = xz + wy;
  out[7] = yz - wx;
  out[8] = 1 - (xx + yy);
  return out;
}

export function transpose(out, a) {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a10 = a[3];
  const a11 = a[4];
  const a12 = a[5];
  const a20 = a[6];
  const a21 = a[7];
  const a22 = a[8];

  out[0] = a00;
  out[1] = a10;
  out[2] = a20;
  out[3] = a01;
  out[4] = a11;
  out[5] = a21;
  out[6] = a02;
  out[7] = a12;
  out[8] = a22;
  return out;
}

export function multiply(out, a, b) {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a10 = a[3];
  const a11 = a[4];
  const a12 = a[5];
  const a20 = a[6];
  const a21 = a[7];
  const a22 = a[8];
  const b00 = b[0];
  const b01 = b[1];
  const b02 = b[2];
  const b10 = b[3];
  const b11 = b[4];
  const b12 = b[5];
  const b20 = b[6];
  const b21 = b[7];
  const b22 = b[8];

  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;
  return out;
}

export function invert(out, a) {
  const a00 = a[0];
  const a01 = a[1];
  const a02 = a[2];
  const a10 = a[3];
  const a11 = a[4];
  const a12 = a[5];
  const a20 = a[6];
  const a21 = a[7];
  const a22 = a[8];
  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;
  const det = a00 * b01 + a01 * b11 + a02 * b21;

  if (det === 0) {
    return null;
  }
  const inv = 1 / det;
  out[0] = b01 * inv;
  out[1] = (-a22 * a01 + a02 * a21) * inv;
  out[2] = (a12 * a01 - a02 * a11) * inv;
  out[3] = b11 * inv;
  out[4] = (a22 * a00 - a02 * a20) * inv;
  out[5] = (-a12 * a00 + a02 * a10) * inv;
  out[6] = b21 * inv;
  out[7] = (-a21 * a00 + a01 * a20) * inv;
  out[8] = (a11 * a00 - a01 * a10) * inv;
  return out;
}

export function fromDiagonal(out, x, y, z) {
  out[0] = x;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = y;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = z;
  return out;
}

export function transformVec3(out, a, v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  out[0] = a[0] * x + a[3] * y + a[6] * z;
  out[1] = a[1] * x + a[4] * y + a[7] * z;
  out[2] = a[2] * x + a[5] * y + a[8] * z;
  return out;
}
