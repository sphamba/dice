---
name: "feat: render rounded die edges and corners with shaders only"
priority: "medium"
state: "live-testing"
worktree: "feat/39-shader-rounded-die-edges"
issuer: "user"
complexity: "complex"
shortName: "shader-rounded-die-edges"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":492,\"del\":26,\"files\":5}"
commits: "[{\"hash\":\"81f1c34\",\"subject\":\"docs: correct d4 bevel band clearance comment\",\"when\":\"2026-11-22T11:21:29+01:00\"},{\"hash\":\"473aa5f\",\"subject\":\"feat: procedural rounded die edges, corners and outline\",\"when\":\"2026-11-22T11:11:19+01:00\"}]"
---

# Summary
Make every die look like it has rounded edges and corners (fillet radius 1.0 mm) without changing the mesh positions. Use an exact procedural bevel normal, an exact rounded outline with alpha-to-coverage, and hemisphere ambient plus a Fresnel rim.

# Specs
# Goal
- Every die type (d4, d6, d8, d10, d12, d20) looks rounded: rounded edges, spherical corners, and a rounded outline seen from the top-down orthographic camera.
- Mesh vertex positions, physics shapes and picking stay the same. Only new vertex attributes, uniforms and shader code are allowed.

# Geometry
- Every die is isohedral: all face planes are at the same distance `rho` from the centre. The rounded die is the Minkowski sum `s*P (+) ball(r)` with `s = 1 - r/rho`. Its flat regions lie exactly on the face planes of P, so resting height and contacts stay visually correct.
- Fillet radius `r = BEVEL_RADIUS = 1.0 mm` (0.001 m), one constant for all dice. Useful tuning range 0.8 to 1.4 mm. The d4 corner numbers (at 0.62 of the way from the face centroid to each vertex) limit the upper end: the bevel band must not cover them.

# (b) Exact procedural bevel normal
- CPU, in `src/dice/labels.js` (reuse `faceFrame` and `toFace2D`): for each face compute `rho = dot(v0, n)`, `s = 1 - r/rho`, and the inset polygon `inset2D_k = toFace2D(frame, s*v_k + r*n)` for each face corner. The polygon is CCW. Pad a polygon with fewer than 5 points to 5 by repeating the last point. Return per face: frame `right`, per-vertex face-2D position, and the 5 inset points.
- `src/render/renderer.js` `buildDieMesh`: add attributes face-2D position (vec2, metres), tangent `right` (vec3), and the inset polygon (three vec4, two points each), with the same inset and tangent values on every vertex of a face. Stay within the WebGL2 minimums (16 attributes, 15 varyings).
- `src/render/shaders.js` dice program: pass the face-2D position, the model-rotated tangent and the inset polygon (flat). In the fragment shader, find the closest point of the inset polygon to the fragment's face-2D position (5-edge loop, guard zero-length edges with `max(dot(e,e), 1e-12)`). `q` is the 2D vector from that point to the fragment, or zero inside the polygon. Tangent-space normal `nts = normalize(vec3(q, r))`. World normal `n = normalize(T*nts.x + B*nts.y + N*nts.z)` with `B = cross(N, T)`.
- `litColor` takes the normal as a parameter. Use the constant orthographic view vector `(0, 0, 1)` for specular, not `uEye - vWorldPos`.
- Write the bevel normal into the AO prepass normal target of #38 too, so the AO sees the same normal.

# (d) Exact rounded outline
- Per die per frame in `drawDicePass` (and in the AO prepass): transform the inset vertices `s*v` by the model matrix, take x and y, build the 2D convex hull (monotone chain), and set `uHull[20]` and `uHullCount`. For this camera, a pixel is inside the rounded die exactly when its distance to that hull is at most r.
- Fragment: `d` = 2D distance from `vWorldPos.xy` to the hull. `alpha = clamp((r - d)/fwidth(d) + 0.5, 0, 1)`. Enable `SAMPLE_ALPHA_TO_COVERAGE` for the forward dice draw so MSAA antialiases the curve. In the AO prepass (no MSAA), use `discard` when `d > r`.

# (e) Lighting so the bevel reads with one light
- Hemisphere ambient: `ambient * mix(GROUND, SKY, n.z*0.5 + 0.5)`, still multiplied by the AO of #38.
- Schlick Fresnel rim on the bevel: weight `pow(1 - n.z, 5)` with a small constant strength. Tune live.
- No edge darkening or fake crease AO on convex edges.

# Out of scope
- No baked normal maps, no bump maps, no raymarched impostor, no `gl_FragDepth`.
- The rim normal fix on the outline (raising the horizontal normal component where the hull distance is positive) is not needed now.
- No physics, picking or label-layout change.

# Tests (vitest, node, no GPU)
- For every die type and face: every inset point lies on the face plane after the `+ r*n` shift (within 1e-9 m), the inset polygon is CCW, and it lies strictly inside the face polygon.
- A JS copy of the normal function: at the middle of a face it gives the face normal, at an edge midpoint it gives the bisector of the two face normals within 1e-6, and it is continuous across the edge.
- Hull helper: the hull of the projected inset vertices of a d6 resting flat is its inset top square, and the point-to-hull distance is 0 inside and positive outside.

# Acceptance criteria
- `npx vitest run src/render src/dice`
- `npm test`
- `npm run build`
- Live check (browser): no console or GL errors. Every die type shows a lighter or darker shaded band along every edge and smooth corners. The outline corners of a d6 resting on a face are rounded, not square. The numbers and pips stay readable, and the d4 corner numbers are not covered by the bevel band. Picking and drag still work on the full sharp shape.

# Notes
# Live test (task #39, in progress - held at watch checkpoint)

## Setup
- Served the worktree with vite on :8797 (curl 200 on /, main.js, shaders.js, renderer.js, labels.js). Playwright (require from tarot/app) desktop 1280x800 dpr 1; 1 mm = 17.32 px. Harness + drivers in /tmp/dice-lt39/ (harness.mjs, driver.mjs, driver2.mjs, driver3.mjs; logs + results-*.json alongside).
- Console page listener + pageerror; GL errors via getContext spy with a per-frame getError poll; world spy (route rewrite of main.js createWorld import, marker verified against the served body).
- Per-type flow: add via panel button (aria-labels), wait for settle, capture, remove. Six types one at a time (max 10 dice rule respected).

## Results so far
- A (load): GL errors none; console clean. Default set spawns 2 d6 as expected.
- Geometric outline check (all 6 dice, teleported face-down at origin, stable pose): every sharp silhouette hull vertex lies strictly OUTSIDE the rounded outline (cut = dist(V, hull(s*v)) - r > 0). Cut magnitudes match the homothetic inset geometry: d4 1.828 mm, d6 0.414 mm, d8 0.414 mm, d12 0.236 mm, d20 0.236 mm (d10: see below). A square-outline bug (s=1 or missing dilation) would give cut = -1 mm on every vertex, so this discriminates.
- d6 quantitative pixel check (calibration profile printed in driver2.log): die/floor luminance boundary measured at t=174.5 px vs analytic rounded-outline position 174.4 px - the outline sits exactly where the spec's hull(s*v)+r predicate puts it.
- Picking/drag (d6): control (empty floor pointerdown picks nothing) PASS; center pick holds and lifts to hold height PASS; held die follows drag target (0.00 mm error) PASS; drops back to rest on release PASS; pick at a point inside the sharp hull but 0.273 mm outside the rounded outline lifts the die and follows a drag PASS - picking works on the full sharp shape.
- GL errors after all captures and at session end: none. Console: only SwiftShader "GPU stall due to ReadPixels" driver warnings, triggered by this harness's own screenshot readbacks (harness artifact, not product output; filtered and reported as such).

## Harness issues hit (fixed, not product defects)
- Sample/shoot race: dice not fully asleep creep up to ~10 mm/s between sampling and screenshot (run 1 color checks sampled the floor). Fixed by teleporting each die to a deterministic face-down pose at the world origin via the world spy and requiring 3 consecutive 200 ms polls with |dp| < 0.2 mm before capture.
- Color classification is a harness limit: die face colors (RGB 41-52) fall inside the AO-darkening range of the floor near contact, so nearest-reference classification is ambiguous. Replaced with a boundary-step detector on the luminance profile with the expected outline position computed analytically (bisect on dist(p, hull(s*v)) <= r).
- First boundary detector had a -3 px systematic bias (argmax of a 3 px-baseline gradient returns the first sample of the full-drop plateau); d6 profile shows the true boundary at the expected position. Fixed in driver3.mjs with a sub-pixel midpoint-crossing detector (inside-out scan, bidirectional, tolerant of a rim bump, and it flags - rather than passes - a hypothetical square outline via extended level windows).
- Node heap OOM on run 2 first attempt: PNM header parser loop did not advance the cursor (infinite string build). Fixed.
- d10 run-1 "min cut 0.000 mm": near-collinear silhouette vertex (angle ~180 deg) has cut ~0 by geometry - there is no corner there. Run 2 prints per-vertex angles; assertion now requires cut > 0 for all vertices and a visible cut for true corners (<165 deg).

## Still to do (driver3.mjs written, not yet run)
- Full boundary-position sweep on all rays of all 6 types with the fixed detector (expected within +-2 px of the analytic rounded outline).
- Visual inspection of 2.5x crops: band visibility on every edge, smooth corners, numbers/pips readability, d4 corner numbers not covered by the band, no AO halos.
- Final console/GL audit; write results and file any defects.

## Assumptions made
- Desktop 1280x800 dpr 1 viewport (acceptance names no viewport); phone form factor not exercised.
- Picking/drag exercised on d6 only (representative; pick code is shape-generic).
- Teleporting a die through the world spy is a harness action to make poses deterministic; it does not touch rendering paths.
- "Numbers and pips stay readable" and "d4 corner numbers not covered" judged visually from 2.5x crops.
- Console criterion filters the SwiftShader ReadPixels readback warnings that this harness's own screenshots trigger; any other console message fails the check.
