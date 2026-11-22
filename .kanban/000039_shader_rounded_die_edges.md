---
name: "feat: render rounded die edges and corners with shaders only"
priority: "medium"
state: "done"
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
# Live test (task #39) - FINAL

## Runs
- Run 3 (final): /tmp/dice-lt39/driver3.mjs, log driver3.log, results results-driver3.json (33 checks: 32 PASS, 1 harness limit). Runs 1-2 (driver.mjs, driver2.mjs) superseded; their failures were harness issues (color classifier vs AO floor range, 3 px detector plateau bias, PNM parser OOM), all documented and fixed in later runs. Probe runs: probe-compare.mjs (feature vs parent-commit baseline), probe-live.mjs.
- Environment: vite :8797 (and :8798 for baseline), Playwright desktop 1280x800 dpr 1, 1 mm = 17.32 px. All servers killed and ports verified clear. Baseline worktree removed.

## Results vs acceptance
- Rounded look, all 6 dice (d4 d6 d8 d10 d12 d20): geometric check - every sharp silhouette hull vertex lies strictly outside the rounded outline (cut = dist(V, hull(s*v)) - r > 0; a square-outline bug would give cut = -1 mm). Pixel check - die/floor luminance boundary measured at the analytic rounded-outline position on ALL 72 corner+edge rays, all within +-2 px (0 no-contrast). PASS.
- Quantitative anchor: d6 corner boundary at 174.5 px vs analytic 174.4 px.
- Cut magnitudes match the homothetic inset geometry: d4 1.828 mm, d6/d8 0.414 mm, d10 0.112-0.477 mm (the 180 deg "vertex" is near-collinear, cut ~0 by geometry - no corner there), d12/d20 0.236 mm.
- Shaded band on every edge: visible in 2.5x crops for all 6 types with correct die colors (d4 cream, d6 red, d8 green, d10 blue, d12 purple, d20 orange). PASS.
- Smooth corners: visually rounded in all crops. PASS.
- No AO halos: smooth AO gradient around dice, no bright rings. PASS.
- Mesh/physics/picking unchanged: teleported rest heights equal exact face distances (physics intact); pick/drag verified - empty-floor control picks nothing, center pick lifts to hold height, held die follows target (0.00 mm error), drops to rest on release, and a pick 0.273 mm OUTSIDE the rounded outline but inside the sharp hull still lifts and drags the die (picking uses the full sharp shape). PASS.
- Labels stay the same: d6 full-frame render is pixel-identical to the parent commit (ImageMagick AE = 0.06); d4 histogram identical. PASS.
- d4 corner numbers not covered: numerals fully readable in crops, clear of the band. PASS.
- No GL errors and clean console through the whole session (the only console messages are SwiftShader "GPU stall due to ReadPixels" driver warnings triggered by this harness's own screenshot readbacks - harness artifact, not product output). PASS.

## The one non-PASS (harness limit, not a product defect)
- "Visible boundary inset from the probe point" on the post-fling d6 corner: the boundary-crossing detector found no usable luminance contrast at that corner (band brightness there matches the AO-darkened floor). The claim it supports is covered three times elsewhere: probe geometric margin, the 72-ray boundary sweep, and the sharp-shape pick checks. A square outline at that corner would have reported nocross, not nocontrast, so this does not hide a square-corner bug.

## Observation for the PM (pre-existing, out of this change's scope)
- Labels on camera-facing (flat top) faces do not render: the d6 top face shows a flat, floor-colored square with no pips, same for d8/d12/d20 top-face numerals. Labels on sloping faces (d4 corner numerals, d12/d20 edge glyphs) render fine. This is identical in the parent commit (AE = 0, same histograms), so it is not a regression of #39 - the #39 requirement "labels stay the same" is met. No card filed since the defect predates this task; happy to file one on request.

## Assumptions
- Desktop 1280x800 dpr 1 viewport; phone form factor not exercised. Picking/drag on d6 only (representative, shape-generic code). Teleporting a die via the world spy is a harness determinism aid that bypasses no rendering path. Console criterion filters the harness's own ReadPixels readback warnings.
