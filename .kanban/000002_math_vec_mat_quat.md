---
name: "feat: 3D math library (vec3, mat4, quaternion)"
priority: "high"
state: "merging"
worktree: "feat/2-math-vec-mat-quat"
issuer: "user"
complexity: "simple"
shortName: "math-vec-mat-quat"
blockedBy: ""
splitter: "done"
---

# Summary
Verify the complete 3D math library across all four modules once the vec3/quat (#10) and mat3/mat4 (#11) subtasks have landed.

# Specs
## Verification scope
- `src/math/vec3.js`, `src/math/quat.js`, `src/math/mat3.js`, `src/math/mat4.js` all exist, each with its test file beside it (`vec3.test.js`, `quat.test.js`, `mat3.test.js`, `mat4.test.js`).
- `npx vitest run src/math` exits 0.
- `npm run build` exits 0.

## Cross-module checks (the pieces were built in parallel)
- Conventions hold uniformly: gl-matrix out-argument style, array-type agnostic (plain arrays, Float32Array, Float64Array), column-major matrices, quaternions `[x, y, z, w]`, right-handed coordinate system.
- Quaternion layout is consistent between `quat.js` and its consumers `mat3.fromQuat` / `mat4.fromRotationTranslation`.
- No new dependencies were added; no dangling imports or re-exports between the parallel halves.

# Notes
- All four modules and their test files present: `vec3.js`, `quat.js`, `mat3.js`, `mat4.js` plus `*.test.js` beside each.
- `npx vitest run src/math`: 39 tests in 5 files pass. `npm run build`: passes, `dist/index.html` uses relative `./assets/...` paths.
- Added `src/math/conventions.test.js` to cover the cross-module checks: quat rotation matches `mat3.fromQuat` and `mat4.fromRotationTranslation`, quat and mat4 inverses agree, and all four modules write Float64Array output. Committed as `0bdf7c7`.
- Assumption: `mat3.invert`, `mat4.invert`, and `mat4.normalFromMat4` return `null` on singular input while `vec3.normalize` and `quat.normalize` fall back to zero/identity; treated as intentional per-type handling, no code change.
- Assumption: `mat3.test.js` importing `mat4` is a test-only cross-check, not a runtime coupling between modules.
- No dependency changes: `package.json` and the lockfile match `main`; no dangling runtime imports (only `src/main.js` imports `./render/canvas-size.js`).
- Conventions confirmed: gl-matrix out-argument style, column-major matrices, `[x, y, z, w]` quaternions, right-handed cross product, plain array and typed-array output supported.
