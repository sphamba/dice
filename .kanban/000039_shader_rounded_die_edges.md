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
# Review (re-review, outcome: approved)
- Scope: 39ea3ff+a25104c vs main, clean tree; touches only labels.js, renderer.js, shaders.js and their tests. Spec map re-verified on the current tree: faceInsetData (rho, s=1-r/rho, toFace2D inset, pad to 5, right axis) with CCW/strictly-inside/1e-9-plane/padding tests; attributes loc 3-7 (vec2 facePos, vec3 tangent, 3x vec4 inset, constant per face); 5-edge inset loop with max(dot(e,e),1e-12) guard; nts=normalize(vec3(q,r)), n=T*x+B*y+N*z, B=cross(N,T); litColor(base,n) with constant (0,0,1) view vector (token-enforced by ao.test.js); bevel normal written to the AO prepass target; per-body hull via setHullUniform in both drawAoPasses and drawDicePass; uHull[20]/uHullCount, monotone chain, s*v model-projected xy; alpha=clamp((r-d)/fwidth(d)+0.5) with SAMPLE_ALPHA_TO_COVERAGE around the forward dice draw; prepass discard past r; hemisphere ambient x AO + Schlick rim pow(1-n.z,5)*0.3; no crease AO; no physics/picking/label-layout/mesh changes; aoPrepassVertexSource removed with zero leftover references.
- Evidence (replayed): npx vitest run src/render src/dice 86/86 exit 0; npm test 298/298 exit 0; npm run build green. All spec acceptance commands pass.
- Prior findings still hold: d4 comment fix (39ea3ff) in tree - band 1.41 mm reaches past digit tips, readability interpretation ("numbers stay readable", not band-boundary-outside-glyph-box) recorded; per-face bevel scale uniform (spread <= 1e-16) validates bevelScale[0] for the hull; max hull 20 (d12) fits uHull[20]; getContext('webgl2') leaves antialias on; page background equals CLEAR_COLOR so premultiplied-alpha compositing assumption is sound.
- Deferred to live test: band/rim readability on all six dice, rounded d6 outline corners, console/GL cleanliness, no AO halos, picking/drag on the full sharp shape.
- Guidance: when a shared JS mirror backs a shader function, keep the mirror's epsilon and clamp structure line-identical to the GLSL so test evidence transfers; comment-only corrections still count as the fixed outcome.
