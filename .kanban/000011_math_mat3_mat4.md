---
name: "feat: 3D math mat3 and mat4"
priority: "high"
state: "done"
worktree: "feat/11-math-mat3-mat4"
issuer: "#2"
complexity: "simple"
shortName: "math-mat3-mat4"
map: "{\"files\":[{\"path\":\"src/math/mat3.js\",\"symbols\":[{\"name\":\"create\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"identity\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"fromQuat\",\"kind\":\"fn\",\"ins\":32,\"del\":0,\"isNew\":true},{\"name\":\"transpose\",\"kind\":\"fn\",\"ins\":24,\"del\":0,\"isNew\":true},{\"name\":\"multiply\",\"kind\":\"fn\",\"ins\":37,\"del\":0,\"isNew\":true},{\"name\":\"invert\",\"kind\":\"fn\",\"ins\":31,\"del\":0,\"isNew\":true},{\"name\":\"fromDiagonal\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"transformVec3\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\"src/math/mat3.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"quaternion\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"mat3\",\"kind\":\"class\",\"ins\":52,\"del\":0,\"isNew\":true}]},{\"path\":\"src/math/mat4.js\",\"symbols\":[{\"name\":\"create\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"identity\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"multiply\",\"kind\":\"fn\",\"ins\":57,\"del\":0,\"isNew\":true},{\"name\":\"invert\",\"kind\":\"fn\",\"ins\":62,\"del\":0,\"isNew\":true},{\"name\":\"transpose\",\"kind\":\"fn\",\"ins\":40,\"del\":0,\"isNew\":true},{\"name\":\"fromRotationTranslation\",\"kind\":\"fn\",\"ins\":39,\"del\":0,\"isNew\":true},{\"name\":\"fromRotationTranslationScale\",\"kind\":\"fn\",\"ins\":43,\"del\":0,\"isNew\":true},{\"name\":\"ortho\",\"kind\":\"fn\",\"ins\":23,\"del\":0,\"isNew\":true},{\"name\":\"lookAt\",\"kind\":\"fn\",\"ins\":50,\"del\":0,\"isNew\":true},{\"name\":\"normalFromMat4\",\"kind\":\"fn\",\"ins\":47,\"del\":0,\"isNew\":true}]},{\"path\":\"src/math/mat4.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"quaternion\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"transformPoint\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"mat4\",\"kind\":\"class\",\"ins\":73,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T17:29:33.686Z\",\"head\":\"249883b\"}"
changes: "{\"base\":\"main\",\"ins\":668,\"del\":0,\"files\":4}"
commits: "[{\"hash\":\"d6b6cf0\",\"subject\":\"feat(math): add mat3 and mat4 with unit tests\",\"when\":\"2026-11-15T18:28:48+01:00\"}]"
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
Live test report (worktree feat/11-math-mat3-mat4, commit d6b6cf0).

What was tested
- The change is a math library with no app callers yet, so I tested it as a downstream consumer: direct module imports in Node 24, plus a real WebGL2 render in headless Chromium that uploads the matrices with uniformMatrix4fv(loc, false, m) and uniformMatrix3fv.
- Node usage checks, 28/28 passed: physics inertia flow with Float64Array (fromDiagonal, fromQuat, multiply, transpose, transformVec3; I_world^-1 = R*I_body^-1*R^T agrees with the per-vector route to 1e-12); multiply(invert(M), M) = identity for a rigid transform; in-place aliasing out===a and out===b in multiply; mixed array types (Float32Array out, Float64Array out, plain array out); every function returns its out argument; fromQuat equals the mat4 rotation part for 4 quaternions; ortho maps (left,bottom,-near) to (-1,-1,-1) and (right,top,-far) to (1,1,1) and the box center to NDC center; lookAt for a normal camera and for a straight-down shadow light; invert and normalFromMat4 return null for singular matrices; fromRotationTranslationScale applies scale before rotation; normalFromMat4 of a rigid transform equals the rotation part and keeps a transformed normal perpendicular to a transformed tangent under non-uniform scale.
- Browser WebGL2 checks, 16/16 passed: matrices uploaded directly with transpose=false render correctly through proj*view*model (ortho + lookAt + fromRotationTranslation / fromRotationTranslationScale): model translation, 90-degree rotation with non-uniform scale, a straight-down shadow light camera (ground quad centered, world -z appears up in light view, quad moves in view when translated in world -z), and normalFromMat4 passed to a lighting shader through uniformMatrix3fv (60-degree tilted quad lights at dot 0.5 and shows the foreshortened height).
- Confirmed the spec constraints: column-major layout, out-first signature, no imports between the two modules, quat layout [x,y,z,w], right-handed system (x right, y up on screen, z toward viewer).

Assumptions I made while designing the tests
- Nothing in src imports the new modules yet, so no app-level UI flow exists for this change. The module API plus a real WebGL draw is the real interface.
- The app scaffold is WebGL2, so I used a webgl2 context for the uniformMatrix4fv check.
- fromDiagonal takes separate x, y, z numbers (matches the task Notes).
- Quaternions are kept unit length by callers (physics normalizes), so I did not treat non-unit quat input as a defect.

Observations (gl-matrix parity, within spec, no defects filed)
- lookAt with up parallel to the view direction (a straight-down light with up (0,1,0), the classic shadow camera trap) silently zeroes the x and y basis and yields a singular view. Same behavior as gl-matrix. Callers must pass a different up vector.
- fromQuat and fromRotationTranslation with a non-unit quaternion produce a scaled (non-orthogonal) matrix. Same as gl-matrix; callers must normalize.
- The earlier dev Notes (singular returns null, scale before rotation, fromDiagonal signature) all matched observed behavior.

Environment notes (not defects of this change)
- Headless Chromium (SwiftShader) warned "GPU stall due to ReadPixels" and once dropped the WebGL context after about 25 readPixels calls in one page. A page reload reran the same checks fine. If future pixel tests grow, batch reads or split across pages.
