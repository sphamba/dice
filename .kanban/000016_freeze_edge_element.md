---
name: "fix: freeze edge element arrays in cached dice shapes"
priority: "low"
state: "done"
worktree: "fix/16-freeze-edge-element"
issuer: "#3"
complexity: "trivial"
map: "{\"files\":[{\"path\":\"src/dice/shapes.js\",\"symbols\":[{\"name\":\"freezeShape\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:28:27.996Z\",\"head\":\"75b3276\"}"
changes: "{\"base\":\"main\",\"ins\":1,\"del\":0,\"files\":1}"
commits: "[{\"hash\":\"1cd368e\",\"subject\":\"fix(dice): freeze edge pair arrays in cached dice shapes\",\"when\":\"2026-11-15T20:28:03+01:00\"}]"
---

# Summary
createShape deep-freezes every nested array of the shape except the edge pair arrays. edges[0] (and the rest) stay mutable, so a consumer that mutates an edge silently corrupts the globally cached shape for all later callers.

# Specs
In src/dice/shapes.js, freezeShape(shape) freezes shape.edges (the outer array) but not its [i, j] elements, while vertices, face indices, face normals, edgeDirs, inertia and d4 vertexValues are all frozen element-wise. A consumer doing shape.edges[k][0] = x (easy to do accidentally while building SAT axis lists) mutates the shared cached object with no error and no way to repair it. Fix: Object.freeze each edge pair in freezeShape (or freeze inside buildEdges). Verified by live test: Object.isFrozen(createShape('d12', 1).edges[0]) === false while Object.isFrozen(createShape('d12', 1).vertices[0]) === true.

# Notes
Live test of #16 (freeze edge pair arrays in cached dice shapes) on commit 1cd368e, run from the worktree cwd. No code edited, no unit suites run.

Method: served the worktree with the Vite dev server (npm run dev, port 8907, HTTP 200 for / and /src/dice/shapes.js) and drove it with headless Chromium via Playwright. main.js does not wire the renderer yet, so the changed module was exercised through the real served interface: in-page `await import('/src/dice/shapes.js')`, 19 checks total, all PASS, no console or page errors. App smoke: page loads with #view canvas.

Results (19/19):
- App loads with canvas; no page errors on load or during module exercise.
- All 6 dice types (d4-d20) at radius 1 and 2.5: outer edges array frozen and every [i, j] edge pair frozen (Object.isFrozen true).
- Spec probe confirmed: Object.isFrozen(createShape('d12', 1).edges[0]) === true and Object.isFrozen(...vertices[0]) === true; d12 has 30 edges as expected.
- Regression: vertices, faces (+ indices, normals), edgeDirs (+ arrays), inertia, d4 vertexValues, and the shape object itself all still frozen.
- createShape returns the same cached object on repeat calls.
- Strict-mode attempt shape.edges[0][0] = 99 throws TypeError ("Cannot assign to read only property '0'") and the cached edge is unchanged; sloppy-mode attempt silently does not change the value; a later createShape caller sees pristine edges. Cache corruption via edge mutation is no longer possible.

Assumptions made while designing the usage tests:
- The module-level data flow (createShape + CACHE) is the real interface of this change since no app flow consumes shapes yet; testing in-page against the dev-served module is equivalent to user usage.
- Frozen edge pairs must also stay frozen across repeat createShape calls for the same type|radius key (cache identity + freeze persistence).
- Test limit: no UI flow exercises shapes.js yet, so no end-to-end visual flow could cover this change; the in-page module exercise is the closest real usage path.
