---
name: "fix: render the rounded die shape with true rounded depth and a visibly rounded outline"
priority: "high"
state: "reviewing"
worktree: "fix/55-rounded-die-depth-outline"
issuer: "user"
complexity: "complex"
shortName: "rounded-die-depth-outline"
splitter: "done"
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
## PM hint
- Remove the `|q| > uBevelRadius` discard in the dice pass and in the AO prepass. On the sharp mesh, each pixel inside the silhouette is covered by exactly one front face, so no neighbouring face draws that pixel. On a tilted die (most visible on d4, dihedral 70.5 deg, where the in-plane band reaches about 1.43 r), the discard leaves holes along edges and at corners.
- The projected rounded hull (`uHull`) already gives the exact top-down outline of s·P ⊕ ball(r), because the projection of a Minkowski sum is the Minkowski sum of the projections. Keep it as the only transparency test.
- For `|q| > r`, clamp `|q|` to r for the normal and for `bevelDrop`. Keep the existing hull discard in the AO prepass.
- Live check: add a 4x crop of a tilted d4 and a tilted d8 and look for holes or cracks along the edges. Run the live script in the background with a longer timeout, or split it into one run per viewport.

## State
- Commit 30617cb: BEVEL_RADIUS = DIE_RADIUS/(4*sqrt(3)) = 1.6 mm moved to src/physics/body.js; gl_FragDepth with the rounded drop in the dice pass and the AO prepass; AO upsample uses the rounded surface z. The `|q| > uBevelRadius` discard removed in both passes (hull discard kept in the AO prepass), `|q|` clamped to r for the normal and bevelDrop. npm test 353 passed, build green.
- Live check complete, one viewport per run (desktop 1280x800, phone 393x852 DPR 3), no timeout problems. 4x crops: flat d6 corner shows smooth round arcs; held tilted d4, d8 and d20 show continuous edges with the band wrapping the silhouette; no holes or cracks in both viewports. Touch test with two overlapping d10: no sharp corner cuts into the other die. No console or GL errors, no #46 overlay; only message is the known pre-existing navigator.vibrate feature-policy warning.
- Measured corner radius: rotation-invariant boundary-profile arc fit (edge-normal minima give the die frame and a, diagonal peak gives the arc; validated against a synthetic rounded-square oracle: measured r 24.75, maxDev 1.9 px at truth 25.6). Desktop 21.8-24.3 px, phone 24.3-26.7 device px, i.e. 1.4-1.7 mm vs the 1.6 mm model; a ~1 px anti-aliased boundary bias amplified 2.4x through the 1/tan(22.5 deg) diagonal divisor explains the low side. A sharp corner would measure r = 0; the corners measure decisively round. Max deviation from the fitted arc center 6.2 px (synthetic floor 1.9 px).
- Evidence files: /tmp/pw-live/out/ (desktop- and phone-d6-corner-4x.png, held-d4-4x.png, held-d8-4x.png, desktop-held-d20-4x.png, touch crops), /tmp/pw-live/report-measure-{desktop,phone}.json.
