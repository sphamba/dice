---
name: "feat: 3D math library (vec3, mat4, quaternion)"
priority: "high"
state: "to-do"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "math-vec-mat-quat"
blockedBy: ""
---

# Summary
Write the 3D vector, 4x4 matrix (and 3x3 for inertia) and quaternion math that physics and WebGL2 rendering use, with Vitest unit tests.

# Specs
## Constraints
- Plain ES modules, no dependencies. Style like gl-matrix: functions take an `out` argument first and return it, so the hot loop does not allocate. Values are `Float32Array` or plain arrays (functions must accept both). Physics may use `Float64Array`, so do not hard-code the array type in operations.
- Matrices are column-major (WebGL convention, `uniformMatrix4fv(loc, false, m)` works directly).
- Quaternions are `[x, y, z, w]`.
- Coordinate system of the app: right-handed, x right, y up on the screen, z out of the screen toward the viewer.

## Files
- `src/math/vec3.js`: `create, fromValues, copy, set, add, sub, scale, scaleAndAdd, dot, cross, length, lengthSq, normalize, negate, distance, lerp, transformMat3, transformMat4 (point, w=1), transformQuat`.
- `src/math/mat3.js`: `create, identity, fromQuat, transpose, multiply, invert, fromDiagonal`, plus `transformVec3` if not in vec3. Needed for inertia tensors (`I_world^-1 = R · I_body^-1 · R^T`).
- `src/math/mat4.js`: `create, identity, multiply, invert, transpose, fromRotationTranslation(out, q, v), fromRotationTranslationScale, ortho(out, left, right, bottom, top, near, far)` (WebGL clip space z in [-1, 1]), `perspective` is not needed. Add `lookAt` (needed for the shadow light camera), `normalFromMat4` (returns mat3).
- `src/math/quat.js`: `create, identity, setAxisAngle, multiply, normalize, conjugate, invert, rotateVec3 (or use vec3.transformQuat), fromMat3, random(out, rng = Math.random)` (uniform random rotation, Shoemake method), and `integrate(out, q, omega, dt)`: first-order update `q + dt/2 · (omega, 0) ⊗ q`, then normalize. `omega` is the angular velocity in world frame.
- One test file per module beside it: `src/math/vec3.test.js`, `mat3.test.js`, `mat4.test.js`, `quat.test.js`.

## Tests (minimum)
- vec3: cross product right-handed (`x × y = z`), normalize of zero vector returns zero (no NaN).
- mat4: `multiply(invert(M), M) ≈ identity` for a random rigid transform; `ortho` maps the box corners `(left,bottom,-near)` and `(right,top,-far)` to NDC `(-1,-1,-1)` and `(1,1,1)`.
- mat3: `fromQuat` equals the rotation part of `mat4.fromRotationTranslation`.
- quat: rotating `x` by 90° about `z` gives `y`; `integrate` with constant `omega` for many small steps gives the same rotation as `setAxisAngle(|omega|·t)` within 1e-3; unit length kept after 10000 steps; `random` returns unit quaternions.

## Acceptance criteria
- `npx vitest run src/math` exits 0.
- `npm run build` exits 0.

# Notes
