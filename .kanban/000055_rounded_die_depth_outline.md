---
name: "fix: render the rounded die shape with true rounded depth and a visibly rounded outline"
priority: "high"
state: "doing"
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
# Deliverable
Dice now shade as the rounded solid with true rounded depth, per specs: BEVEL_RADIUS doubled to DIE_RADIUS/(4·sqrt(3)) = 1.6 mm (25.6 px on the 1280x800 desktop scale, 27.7 device px at 393x852 DPR 3) and moved next to DIE_RADIUS in src/physics/body.js; all users (labels.js, renderer.js, labels.test.js, bevel.test.js) import it from there. Dice fragment shader and AO prepass write the emulated rounded-surface depth with gl_FragDepth: inside the bevel band the surface sits r - sqrt(r^2 - |q|^2) below the face plane along the face normal (bevelDrop), fragments with |q| > uBevelRadius discard so the neighbouring face owns its band, and the prepass declares uniform vec2 uDepthRange for the window-depth conversion. AO upsample is depth-aware against the rounded surface: sampleAo takes the surface z, litColor takes a z parameter, dice pass the rounded surface.z, the floor passes vWorldPos.z.

# Verification
- Red-first: new failing tests written before the change (BEVEL_RADIUS value test in body.test.js; rounded-depth source checks + tangent-sphere JS mirror + one-common-inset-scale test in bevel.test.js; upsample callsite checks in ao.test.js); all failed for the missing behaviour first.
- Full suite green after the change: 353 passed (npm test).
- npm run build green; dist/index.html references the hashed js/css assets.
- Committed as 30cb97b (9 files, +113/-23), branch fix/55-rounded-die-depth-outline.
- Live check in progress: playwright-core + chromium headless shell against vite preview of dist; script measures the flat-d6 corner arc radius on both viewports, crops 4x corner/die/junction shots, grabs and holds d20/d8 for tilted shots, collects console errors and checks the #ui overlay. First run hit the 300 s tool timeout mid-run, no verdict yet; rerun with a longer timeout pending.

# Assumptions
- Panel selector rows are in DICE_TYPES order (d4,d6,d8,d10,d12,d20) and '+' is the 2nd button in each row.
- Screenshot pixels are device pixels; desktop 1280x800 hits the MIN_BOX_EDGE guard (1 CSS px = 0.0625 mm), phone 393x852 DPR 3 does not.

# Blockers
- None.

# Manual checks left to other roles
- Visual verdict on the 4x crops (roundness, no sharp corner cuts, no double outline) once the live check completes.
