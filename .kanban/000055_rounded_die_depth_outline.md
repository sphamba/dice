---
name: "fix: render the rounded die shape with true rounded depth and a visibly rounded outline"
priority: "high"
state: "to-live-test"
worktree: "fix/55-rounded-die-depth-outline"
issuer: "user"
complexity: "complex"
shortName: "rounded-die-depth-outline"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":121,\"del\":24,\"files\":9}"
commits: "[{\"hash\":\"5ac4028\",\"subject\":\"fix: keep band fragments, clamp the band normals and depth\",\"when\":\"2026-11-22T15:44:17+01:00\"},{\"hash\":\"cf3f4c2\",\"subject\":\"fix: shade dice as the rounded solid with true rounded depth\",\"when\":\"2026-11-22T15:33:35+01:00\"}]"
---

# Summary
The die corners still look sharp. Make the dice shaders emulate the displacement of the rounded shape s·P ⊕ ball(r): drop pixels outside it, write the depth of the rounded surface, and make the rounding large enough to see.

# Specs
# User request
- "The corners still look sharp. The round edges and corners shaders must draw transparent pixels where needed to account for the emulated displacement mapping."

# Facts (main)
- The mesh is the sharp polyhedron. `BEVEL_RADIUS = DIE_RADIUS/(8*sqrt(3))` = 0.8 mm (`src/dice/labels.js:127`), inset `s = 1 - r/rho` per face (d4 0.78, d6/d8 0.875, d10 0.89, d12/d20 0.91). `entry.bevelScale` takes s from face 0 only (`renderer.js:213`).
- Dice pass: alpha = coverage of the projected rounded hull (s-scaled vertices, 2D hull, `uHull`, max 20 points), with alpha-to-coverage (`shaders.js:336-337`, `renderer.js:439,454`). The AO prepass discards outside the same hull (`shaders.js:170`) without MSAA.
- Every pass writes the depth of the sharp face plane, also in the bevel band. So where two dice touch, the sharp corners cut through each other, and the AO upsample compares against the sharp depth (`shaders.js:24-42`).

# Step 1: measure
- In a browser (desktop 1280x800 and phone 393x852 DPR 3), capture a 4x crop of a flat d6 corner and of a tilted d8 and d20. Compare the outline with the expected rounded corner of radius r. Write the measured radius in Notes.

# Change
- Outline: every pixel outside the rounded shape s·P ⊕ ball(r) must be transparent, in the dice pass and in the AO prepass, on desktop and on phone. If step 1 shows that this already holds, keep the current hull method.
- Rounded depth (the emulated displacement): in the bevel band, compute the height of the rounded surface from the inset offset q (`r - sqrt(r^2 - |q|^2)` below the face plane along the face normal) and write it with `gl_FragDepth` in the dice pass and the AO prepass. On the flat part keep the face-plane depth. Discard where `|q| > r`. The AO upsample must use the same depth.
- Radius: set `BEVEL_RADIUS = DIE_RADIUS/(4*sqrt(3))` (1.6 mm, 12.5% of the 12.8 mm d6 edge). Move the constant next to `DIE_RADIUS` in `src/physics/body.js`, so the physics can use it. All users import it from there.
- Compute s per face, or check that face 0 is correct for every die type (all faces of one type have the same rho).
- #46 mobile GLSL rules for every new line: no uniform-bounded loops, no `%` by a uniform, guard every division and sqrt argument (`max(.., 0.0)`).

# Tests
- Unit: the rounded height at |q| = 0 is 0, and at |q| = r it is r. The source check for `gl_FragDepth` in both programs. `BEVEL_RADIUS` equals `DIE_RADIUS/(4*sqrt(3))`.
- Existing render, bevel, AO, carve and #46 tests stay green (update the expected radius).

# Acceptance criteria
- `npx vitest run src/render src/dice src/physics`
- `npm test`
- `npm run build`
- Live check: in a 4x crop, the corners of a flat d6 and a tilted d8/d20 are round with radius about 1.6 mm. Where two dice touch, no sharp corner cuts into the other die. No console or GL errors, and no #46 overlay.

# Notes
- Outcome: approved. Every Spec bullet maps to diff or test evidence; no fixes needed.
- Constant: `BEVEL_RADIUS = DIE_RADIUS/(4*sqrt(3))` (= 1.6 mm, 12.5% of the 12.8 mm d6 edge) now lives next to `DIE_RADIUS` in `src/physics/body.js`; all users (`labels.js`, `renderer.js`, tests) import it from there; `body.test.js` asserts the ratio.
- Rounded depth: `bevelDrop`/`roundedSurface`/`surfaceDepth` in `BEVEL_FRAG`; `gl_FragDepth` written in the dice pass and the AO prepass (shaders.js:195, 354); flat part keeps the face-plane depth (drop 0 at |q| = 0, r at |q| = r, clamp beyond — JS mirror tested including the mid-band tangent-sphere value). AO upsample compares the same surface z (`sampleAo(z)`); the depth round-trip `(x - z)/y` ↔ `x - d*y` is consistent across prepass, GTAO, blur and upsample.
- Band handling: the `|q| > uBevelRadius` discard is removed in both passes per the PM hint (holes on tilted dice); `|q|` clamps to r for the rim-frozen normal and the drop. Accepted interpretation: the Spec bullet "discard where |q| > r" is overridden by the PM hint. Hull alpha stays the only outline test in the dice pass, the hull discard stays in the prepass (both source-checked).
- Face scale: `renderer.js` keeps taking s from face 0; new `bevel.test.js` 'face inset scale' proves every face of every type shares rho, so face 0 is exact.
- #46 mobile GLSL rules hold on every new line: `sqrt(max(.., 0.0))`, `inversesqrt(max(dot(q, q), 1e-12))`, `max(uDepthRange.y, 1e-6)`; no new loops, no % by a uniform.
- Evidence: `npx vitest run src/render src/dice src/physics` 238 passed (17 files); `npm test` 353 passed (28 files); `npm run build` green; glslangValidator compile+link PASS for all five programs (dice, aoPrepass, gtao, blur, floor).
- Live: the developer's crops in /tmp/pw-live/out re-checked visually (flat d6 corner round, held d8 edges continuous, no holes or cracks); measured radius 1.4-1.7 mm (developer's boundary-fit) vs the 1.6 mm model. Formal live-GL, touch and console sign-off stays with the live-tester role.
