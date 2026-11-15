---
name: "feat: 3D math mat3 and mat4"
priority: "high"
state: "doing"
worktree: "feat/11-math-mat3-mat4"
issuer: "#2"
complexity: "simple"
shortName: "math-mat3-mat4"
---

# Summary
Implement src/math/mat3.js and src/math/mat4.js (gl-matrix style, no dependencies) with Vitest unit tests. Half of the parent math library task, developed in parallel with the vec3/quat subtask.

# Specs
## Constraints
- Plain ES modules, no dependencies. Style like gl-matrix: functions take an `out` argument first and return it, so the hot loop does not allocate. Values are `Float32Array` or plain arrays (functions must accept both). Physics may use `Float64Array`, so do not hard-code the array type in operations.
- Matrices are column-major (WebGL convention, `uniformMatrix4fv(loc, false, m)` works directly).
- Quaternion arguments are `[x, y, z, w]` (matches `src/math/quat.js` written in the parallel subtask; rely on this layout, do not import quat).
- Coordinate system of the app: right-handed, x right, y up on the screen, z out of the screen toward the viewer.
- Do not import between `src/math/*` modules; functions operate on array elements directly (gl-matrix style). This keeps the two parallel subtasks file-disjoint. Because `vec3.transformMat3` lives in the parallel subtask, implement `transformVec3` in mat3.js unconditionally.

## Files (only these)
- `src/math/mat3.js`: `create, identity, fromQuat, transpose, multiply, invert, fromDiagonal, transformVec3`. Needed for inertia tensors (`I_world^-1 = R · I_body^-1 · R^T`).
- `src/math/mat4.js`: `create, identity, multiply, invert, transpose, fromRotationTranslation(out, q, v), fromRotationTranslationScale, ortho(out, left, right, bottom, top, near, far)` (WebGL clip space z in [-1, 1]), `lookAt` (needed for the shadow light camera), `normalFromMat4` (returns mat3). `perspective` is not needed.
- Tests beside the modules: `src/math/mat3.test.js`, `src/math/mat4.test.js`.

## Tests (minimum)
- mat4: `multiply(invert(M), M) ≈ identity` for a random rigid transform; `ortho` maps the box corners `(left,bottom,-near)` and `(right,top,-far)` to NDC `(-1,-1,-1)` and `(1,1,1)`.
- mat3: `fromQuat` equals the rotation part of `mat4.fromRotationTranslation`.

## Acceptance criteria
- `npx vitest run src/math/mat3.test.js src/math/mat4.test.js` exits 0.
- `npm run build` exits 0.

# Notes
