---
name: "feat: 3D math library (vec3, mat4, quaternion)"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "simple"
shortName: "math-vec-mat-quat"
blockedBy: "#10, #11"
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
