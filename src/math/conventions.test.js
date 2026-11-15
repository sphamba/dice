import { describe, expect, it } from 'vitest';
import * as mat3 from './mat3.js';
import * as mat4 from './mat4.js';
import * as quat from './quat.js';
import * as vec3 from './vec3.js';

const near = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

const q = quat.normalize(quat.create(), [0.2, -0.4, 0.5, 0.7]);
const v = [1, 2, -3];

describe('math conventions', () => {
  it('rotates vectors the same way through quat, mat3 and mat4', () => {
    const byQuat = quat.rotateVec3([], q, v);
    const byMat3 = vec3.transformMat3([], v, mat3.fromQuat(mat3.create(), q));
    const byMat4 = vec3.transformMat4(
      [],
      v,
      mat4.fromRotationTranslation(mat4.create(), q, [0, 0, 0]),
    );
    for (let i = 0; i < 3; i += 1) {
      near(byMat3[i], byQuat[i]);
      near(byMat4[i], byQuat[i]);
    }
  });

  it('inverts a rotation consistently across quat and mat4', () => {
    const m = mat4.fromRotationTranslation(mat4.create(), q, [0, 0, 0]);
    const byQuat = quat.rotateVec3([], quat.invert([], q), quat.rotateVec3([], q, v));
    const byMat4 = vec3.transformMat4([], vec3.transformMat4([], v, m), mat4.invert(mat4.create(), m));
    for (let i = 0; i < 3; i += 1) {
      near(byQuat[i], v[i], 1e-5);
      near(byMat4[i], v[i], 1e-5);
    }
  });

  it('writes Float64Array output in every module', () => {
    expect(vec3.normalize(new Float64Array(3), [1, 0, 0])).toBeInstanceOf(Float64Array);
    expect(quat.normalize(new Float64Array(4), [0, 0, 0, 1])).toBeInstanceOf(Float64Array);
    expect(mat3.identity(new Float64Array(9))).toBeInstanceOf(Float64Array);
    expect(mat4.identity(new Float64Array(16))).toBeInstanceOf(Float64Array);
  });
});
