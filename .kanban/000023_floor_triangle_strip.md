---
name: "fix: floor triangle strip loses its second triangle to back-face culling"
priority: "high"
state: "doing"
worktree: "fix/23-floor-triangle-strip"
issuer: "#6"
complexity: "simple"
---

# Summary
buildFloorMesh emits a 4-vertex strip whose second triangle is wound CW (strip winding alternates), so with cullFace(BACK) the upper-left half of the floor (the NDC x<y half, i.e. above the world diagonal from (-W/2,-H/2) to (W/2,H/2)) never renders. The clear color shows through wherever no die covers it.

# Specs
## Evidence (live test of #6, headless Chromium + SwiftShader, commit be7545e)
- Floor-only render (`draw([], {direction: DEFAULT_LIGHT})` at 1000x750, box 0.0667x0.05): first non-clear pixel per row (top-based): py 10 -> x 985, py 100 -> 865, py 374 -> 500, py 740 -> 12. The boundary is exactly the v0->v2 diagonal; everything on the upper-left side is the raw clear color [20,21,26].
- Independent minimal repro (raw WebGL2, trivial shaders, same vertex array `[-1,-1, 1,-1, 1,1, -1,1]`, `drawArrays(TRIANGLE_STRIP, 0, 4)`, CULL_FACE BACK): lower-right triangle renders, upper-left triangle is culled. Same array with order `[-1,-1, 1,-1, -1,1, 1,1]` renders both halves.
- Live-test impact: stack-scene floor shadow check failed because the sample point fell in the missing half and returned the clear color.

## Root cause
`src/render/renderer.js` line 73-77: `new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])`. A GL triangle strip emits triangle 0 as (v0,v1,v2) and triangle 1 as (v2,v1,v3) to keep winding consistent. With this order triangle 1 = (1,1),(1,-1),(-1,1), signed area -4 (CW, back-facing) and gets culled. Triangle 0 (lower-right half) renders fine.

## Fix direction
Reorder the strip to `[-1, -1, 1, -1, -1, 1, 1, 1]` (both triangles then front-facing), or use 6 indexed/duplicated vertices with TRIANGLES, or disable culling for the floor pass. The reorder is the smallest change.

## Acceptance
- Floor-only render covers every pixel of the canvas with the floor color (no clear-color pixels anywhere in the box footprint).
- A floor sample in the d12's shadow band on the upper-left side (e.g. world (-0.0134, -0.0018) in the stack scene) renders shadowed floor [14,13,12], not the clear color.

# Notes
- Fix: `src/render/renderer.js` floor strip reordered from `[-1,-1, 1,-1, 1,1, -1,1]` to `[-1,-1, 1,-1, -1,1, 1,1]`; the 8 floats now live in an exported `FLOOR_VERTICES` constant that `buildFloorMesh` reuses, so the winding is testable without a GL context. Committed as a16480a.
- Test: `src/render/renderer.test.js` re-derives the two strip triangles the way GL does, `(v0,v1,v2)` and `(v2,v1,v3)`, and asserts a positive signed area for both, plus full -1..1 quad coverage. Red with the old order, green with the new one.
- Assumption: CCW in NDC is the front face (GL default `FRONT_FACE` is CCW), so positive signed area = front-facing under the existing `cullFace(BACK)`.
- Assumption: no other triangle strip exists in the codebase (`drawArrays` appears once, in the floor pass), so no second site needs the same reordering.
- Verification: scoped run of `renderer.test.js` + `camera.test.js` 8/8 green, `npm run build` green. Clean-room copy of HEAD: 177/177 tests green, build green, relative asset paths in `dist/index.html`.
- Browser check (headless Chromium, SwiftShader, 1000x750, box 0.0667x0.05x0.05): floor-only `draw([], {direction})` readback of 750000 pixels has 0 clear-color [20,21,26] pixels and 0 clear-like pixels, all four quadrants lit floor (range [47,44,40]-[93,90,85]); upper-left sample [53,50,46] instead of the previous clear color. No console errors.
