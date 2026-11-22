---
name: "feat: render rounded die edges and corners with shaders only"
priority: "medium"
state: "doing"
worktree: "feat/39-shader-rounded-die-edges"
issuer: "user"
complexity: "complex"
shortName: "shader-rounded-die-edges"
blockedBy: ""
splitter: "done"
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
- State: planning done, implementation not started. Read batch complete (labels.js, shapes.js, renderer.js, shaders.js, gl.js, renderer.test.js, body.js, main.js); all specs mapped to concrete edits.
- Plan: (1) tests first — append faceInsetData describe to src/dice/labels.test.js (inset on face plane within 1e-9, CCW, strictly inside, padding to 5, all 6 types) and new src/render/bevel.test.js (JS mirror of shader normal: mid-face -> face normal, edge midpoint -> bisector of the two face normals within 1e-6, both faces agree at the shared edge; hull helper: d6 resting flat -> inset top square, distance 0 inside / positive outside). (2) labels.js: export faceFrame/toFace2D, add BEVEL_RADIUS = 0.001 and faceInsetData(shape, r) returning per face { right, face2D, inset(5 padded points), scale }. (3) renderer.js: convexHull2D (monotone chain CCW), pointHullDistance2D, projectedInsetHull(shape, model, s); buildDieMesh adds attributes loc 3 face2D vec2, loc 4 tangent vec3, loc 5-7 inset 3x vec4; per-body uHull[20]/uHullCount upload in drawDicePass and AO prepass; SAMPLE_ALPHA_TO_COVERAGE around the forward dice draw. (4) shaders.js: shared bevel GLSL chunk (5-edge closest-point loop with max(dot(e,e),1e-12) guard, q zero inside, nts = normalize(vec3(q, r)), world n via T/B = cross(N,T)/N); litColor(base, n) param; hemisphere ambient mix(GROUND, SKY, n.z*0.5+0.5); Schlick rim pow(1-n.z,5) small strength; dice FS alpha = clamp((r-d)/fwidth(d)+0.5,0,1); AO prepass reuses the dice vertex source, writes the bevel normal and discards when d > r.
- Verified: DIE_RADIUS = 0.016*sqrt(3)/2 ~= 13.86 mm, so r = 1 mm keeps d4 corner numbers ~2 mm inside the flat region and d6 pips clear of the bevel band. main.js uses canvas.getContext('webgl2') default attrs -> antialias true, so alpha-to-coverage has samples; drawing buffer alpha is default true, premultiplied composite — watch for outline halos in the live check, fallback is alpha:false or alpha 1 on covered samples.
- Fake-GL wiring tests draw empty body lists, so new per-body uniform calls (incl. uniform2fv, absent from the fake) stay out of their path.
- Assumptions: BEVEL_RADIUS constant lives in labels.js next to the inset data; rim strength starts at 0.3, tuned live; outColor alpha carries the A2C alpha as spec formula states.
