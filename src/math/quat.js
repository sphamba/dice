export function create() {
  return new Float32Array([0, 0, 0, 1]);
}

export function identity(out) {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}

export function setAxisAngle(out, axis, rad) {
  const half = rad * 0.5;
  const s = Math.sin(half);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(half);
  return out;
}

export function multiply(out, a, b) {
  const ax = a[0];
  const ay = a[1];
  const az = a[2];
  const aw = a[3];
  const bx = b[0];
  const by = b[1];
  const bz = b[2];
  const bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function normalize(out, a) {
  const len = Math.hypot(a[0], a[1], a[2], a[3]);
  if (len === 0) return identity(out);
  const inv = 1 / len;
  out[0] = a[0] * inv;
  out[1] = a[1] * inv;
  out[2] = a[2] * inv;
  out[3] = a[3] * inv;
  return out;
}

export function conjugate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}

export function invert(out, a) {
  const lenSq = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
  if (lenSq === 0) return identity(out);
  const inv = 1 / lenSq;
  out[0] = -a[0] * inv;
  out[1] = -a[1] * inv;
  out[2] = -a[2] * inv;
  out[3] = a[3] * inv;
  return out;
}

export function rotateVec3(out, q, v) {
  const x = v[0];
  const y = v[1];
  const z = v[2];
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + qy * tz - qz * ty;
  out[1] = y + qw * ty + qz * tx - qx * tz;
  out[2] = z + qw * tz + qx * ty - qy * tx;
  return out;
}

export function fromMat3(out, m) {
  const trace = m[0] + m[4] + m[8];
  if (trace > 0) {
    const root = Math.sqrt(trace + 1);
    out[3] = 0.5 * root;
    const s = 0.5 / root;
    out[0] = (m[5] - m[7]) * s;
    out[1] = (m[6] - m[2]) * s;
    out[2] = (m[1] - m[3]) * s;
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const root = Math.sqrt(1 + m[0] - m[4] - m[8]);
    out[0] = 0.5 * root;
    const s = 0.5 / root;
    out[1] = (m[3] + m[1]) * s;
    out[2] = (m[6] + m[2]) * s;
    out[3] = (m[5] - m[7]) * s;
  } else if (m[4] > m[8]) {
    const root = Math.sqrt(1 + m[4] - m[0] - m[8]);
    out[1] = 0.5 * root;
    const s = 0.5 / root;
    out[0] = (m[3] + m[1]) * s;
    out[2] = (m[7] + m[5]) * s;
    out[3] = (m[6] - m[2]) * s;
  } else {
    const root = Math.sqrt(1 + m[8] - m[0] - m[4]);
    out[2] = 0.5 * root;
    const s = 0.5 / root;
    out[0] = (m[6] + m[2]) * s;
    out[1] = (m[7] + m[5]) * s;
    out[3] = (m[1] - m[3]) * s;
  }
  return out;
}

export function random(out, rng = Math.random) {
  const u1 = rng();
  const u2 = rng();
  const u3 = rng();
  const r1 = Math.sqrt(1 - u1);
  const r2 = Math.sqrt(u1);
  const t1 = 2 * Math.PI * u2;
  const t2 = 2 * Math.PI * u3;
  out[0] = r1 * Math.sin(t1);
  out[1] = r1 * Math.cos(t1);
  out[2] = r2 * Math.sin(t2);
  out[3] = r2 * Math.cos(t2);
  return out;
}

export function integrate(out, q, omega, dt) {
  const half = dt * 0.5;
  const wx = omega[0] * half;
  const wy = omega[1] * half;
  const wz = omega[2] * half;
  const qx = q[0];
  const qy = q[1];
  const qz = q[2];
  const qw = q[3];
  out[0] = qx + wx * qw + wy * qz - wz * qy;
  out[1] = qy + wy * qw + wz * qx - wx * qz;
  out[2] = qz + wz * qw + wx * qy - wy * qx;
  out[3] = qw - wx * qx - wy * qy - wz * qz;
  return normalize(out, out);
}
