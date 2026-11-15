---
name: "feat: 3D math vec3 and quaternion"
priority: "high"
state: "to-do"
worktree: ""
issuer: "#2"
complexity: "simple"
shortName: "math-vec3-quat"
---

# Summary
Implement src/math/vec3.js and src/math/quat.js (gl-matrix style, no dependencies) with Vitest unit tests. Half of the parent math library task, developed in parallel with the mat3/mat4 subtask.

# Specs
## Constraints
- Plain ES modules, no dependencies. Style like gl-matrix: functions take an `out` argument first and return it, so the hot loop does not allocate. Values are `Float32Array` or plain arrays (functions must accept both). Physics may use `Float64Array`, so do not hard-code the array type in operations.
- Quaternions are `[x, y, z, w]` (mat3.fromQuat and mat4.fromRotationTranslation in the parallel subtask rely on this exact layout).
- Coordinate system of the app: right-handed, x right, y up on the screen, z out of the screen toward the viewer.
- Do not import between `src/math/*` modules; functions operate on array elements directly (gl-matrix style). This keeps the two parallel subtasks file-disjoint.

## Files (only these)
- `src/math/vec3.js`: `create, fromValues, copy, set, add, sub, scale, scaleAndAdd, dot, cross, length, lengthSq, normalize, negate, distance, lerp, transformMat3, transformMat4 (point, w=1), transformQuat`. `transformMat3` assumes column-major mat3.
- `src/math/quat.js`: `create, identity, setAxisAngle, multiply, normalize, conjugate, invert, rotateVec3 (or rely on vec3.transformQuat), fromMat3, random(out, rng = Math.random)` (uniform random rotation, Shoemake method), and `integrate(out, q, omega, dt)`: first-order update `q + dt/2 · (omega, 0) ⊗ q`, then normalize. `omega` is the angular velocity in world frame.
- Tests beside the modules: `src/math/vec3.test.js`, `src/math/quat.test.js`.

## Tests (minimum)
- vec3: cross product right-handed (`x × y = z`), normalize of zero vector returns zero (no NaN).
- quat: rotating `x` by 90° about `z` gives `y`; `integrate` with constant `omega` for many small steps gives the same rotation as `setAxisAngle(|omega|·t)` within 1e-3; unit length kept after 10000 steps; `random` returns unit quaternions.

## Acceptance criteria
- `npx vitest run src/math/vec3.test.js src/math/quat.test.js` exits 0.
- `npm run build` exits 0.

# Notes
