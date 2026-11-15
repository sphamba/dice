---
name: "fix: floor triangle strip loses its second triangle to back-face culling"
priority: "high"
state: "done"
worktree: ""
issuer: "#6"
complexity: "simple"
map: "{\"files\":[{\"path\":\"src/render/renderer.js\",\"symbols\":[{\"name\":\"buildFloorMesh\",\"kind\":\"fn\",\"ins\":2,\"del\":3,\"isNew\":false},{\"name\":\"FLOOR_VERTICES\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true}]},{\"path\":\"src/render/renderer.test.js\",\"symbols\":[{\"name\":\"signedArea\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"floor mesh winding\",\"kind\":\"case\",\"ins\":26,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:47:27.946Z\",\"head\":\"a16480a\"}"
changes: "{\"base\":\"main\",\"ins\":33,\"del\":3,\"files\":2}"
commits: "[{\"hash\":\"f93b31f\",\"subject\":\"fix: wind floor triangle strip so both halves render\",\"when\":\"2026-11-15T20:44:59+01:00\"}]"
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
Live test (2026-11-15, headless Chromium + SwiftShader, worktree head f93b31f): 12/12 checks passed, no defects filed. Reference and driver: /tmp/dice-lt23/reference.mjs + expected.json, /tmp/dice-lt23/live.test.mjs + live.log.

Acceptance 1 (floor full coverage) PASS: floor-only render `draw([], {direction: DEFAULT_LIGHT})` at 1000x750, box 0.0667x0.05x0.05. Full-frame readback of 750000 pixels: 0 exact clear-color [20,21,26] pixels and 0 clear-like pixels (2-unit tolerance, border ring included). Every one of the 750 rows spans the full width (first/last non-clear column 0/999). Evidence rows that exposed the bug (old first-non-clear py 10 -> 985, py 100 -> 865, py 374 -> 500, py 740 -> 12) now all read first=0, last=999: the v0->v2 diagonal boundary is gone. Interior pixel min/max [47,44,40]-[92,90,85] sits inside the shader-exact expected lit-floor range ([46.08,43.2,38.88]-[92.44,89.56,85.24] from a verbatim port of LIGHTING_FS). Upper-left quadrant patch [250,187] reads [53,50,46] region, 81/81 pixels matching expected [53.27,50.39,46.07]; all four quadrant patches 81/81 lit floor.

Acceptance 2 (d12 shadow band on the upper-left half) PASS: stack scene rebuilt deterministically from the #6 live-test search (d12 value 3 up at center; resting d6 at [0.024, 0, 0.008]; floating d6 at [0, 0.006, 0.05602]; default light). Floor sample at world (-0.013385, -0.001762) -> px [299, 401], verified independently to sit on the upper-left side of the diagonal y = 0.75x (the previously culled half), renders [14,13,12] vs reference [14.28,13.39,12.05] (exact to 1 RGB unit), not the clear color; 5x5 patch around it 25/25 shadowed. Floor lit control at px [860, 105] renders [85,82,77] vs expected [84.62,81.74,77.42]. No console or page errors in either scene.

Assumptions made while designing the usage tests: (1) the renderer is not yet wired into main.js, so the real interface for this change is the WebGL2 renderer module driven in a page exactly as main.js will use it (createRenderer -> resize -> draw); (2) the stack scene from the #6 evidence is the scene the acceptance names, rebuilt by re-running the same deterministic placement search against the current worktree modules; (3) GL default FRONT_FACE=CCW with cullFace(BACK), so both emitted strip triangles must be CCW; (4) SwiftShader rasterization is representative for winding/culling behavior. Test limits: software GL only, no hardware GPU paths; the d6/d12 meshes and shadow map are exercised only as shadow casters for the floor checks (label appearance and dice shading are out of scope for this task). Confirmed via grep that `drawArrays(gl.TRIANGLE_STRIP, ...)` appears exactly once (src/render/renderer.js line 181), matching the stated no-second-site assumption. Unit suites (renderer.test.js) intentionally not run per live-test scope; developer's scoped run covers them.
