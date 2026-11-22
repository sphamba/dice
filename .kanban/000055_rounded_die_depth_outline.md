---
name: "fix: render the rounded die shape with true rounded depth and a visibly rounded outline"
priority: "high"
state: "done"
worktree: ""
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
Live-test of the rounded die depth-outline fix (merged commit 5ac4028 on this worktree), run 2026-11-22, suite /tmp/dice55-lt (precedent driver.mjs + ltlib.js; instruments self-tested via selftest.mjs, all PASS before the run). Final verdict: PASS - all live acceptance criteria met, no product defects found, no cards filed.

Runs (RUNID / phases / result):
- retest (full A-F): 32/33 checks passed, consoleFailures=0, gl.getError=0, no unsupported banner.
- retest2 (A,B,C,E, after a harness crop fix): 31/31 checks passed, consoleFailures=0, gl.getError=0.

Constants used (from source): DIE_RADIUS=11.085mm, BEVEL_RADIUS=DIE_RADIUS/(4*sqrt(3))=1.600mm (src/physics/body.js:7,12); flat d6 half-edge model a=6.4mm; desktop scale 16.0 px/mm, phone 17.3 px/mm.

Results table (check -> result):
- A env (desktop 1280x800) -> PASS: webgl2 ok, canvas backing=client*dpr, scale 16.0 px/mm (model corner r=25.6px, a=102.4px)
- B desktop flat d6 half-edge a -> PASS: a=6.38mm vs model 6.4mm, spread 0.39px
- B desktop flat d6 corner radius ~1.6mm -> PASS: polar minima [1.53,1.48,1.51,1.55]mm vs model 1.60mm (720-dir radial scan + 0.5-crossing + Kasa fits; instruments self-tested against synthetic rounded/sharp squares); retest-B-d6-full-2x.png shows the face-up d6 with visibly rounded corners
- C desktop tilted d8/d20, resting+held (4 states) -> PASS: holes=0 in the bevel band in every state (holes = enclosed dark floor pixels; numeral ink excluded by hue dominance, calibrated in selftest); corner arc fits 8-18 per state; tiltedMean radius 1.51-1.53mm vs same-run flat ref 1.52mm
- D two dice in contact -> PASS: 43 die-die contact events, heldGap=8.7mm during calm hold, seam spikes=0
- D seam shows no sharp cut -> PASS: retest-D-seam-wide-3x.png (captured during hold) shows the red d6 in clean contact with the green d8, rounded edge, no sharp corner cutting in
- E phone (393x852 DPR 3) -> PASS: flat d6 a=6.37mm, polar corners [1.58,1.48,1.47,1.51]mm; d8 holes=0, tiltedMean=1.41mm vs flatRef 1.51mm; console clean, gl.getError=0, no unsupported banner
- E phone 4x corner crop -> PASS: retest2-E-d6-corner4-4x.png shows a clearly rounded corner arc on the phone d6
- Console/GL/overlay (desktop D-end and phone E) -> PASS: 0 console failures, getError=0, no #unsupported banner in both contexts

Harness limits (no product impact):
1. Void evidence crops fixed mid-run: the driver read `phiDeg` from flatFit output, which emits `phiEdge`, so flat-d6 corner-crop coordinates were NaN and the crops were 0-byte (this also voided the previous session's final-B/E-d6 corner crops; its gates used polar minima and full-2x evidence, unaffected). Fixed (crop at phiEdge+45 corner angle, direct-match LSQ cross-check, tilted pick closest to 1.5mm, 100px tilted crops); retest2 regenerated all crops non-zero.
2. Desktop flat-d6 4x corner crops land off-corner: cornerCropCoords uses bbox-diag/2 as the corner distance, which overshoots for a rotated square (arc at ~134px along the diagonal vs ~194px placed). Skipped per PM hint; the desktop d6 rounding is carried by the polar minima gate and the full-2x view.
3. retest E-d20-resting gate FAIL (1 valid arc fit, gate needs 2): instrument margin, not a defect - retest2 passed the same gate, the desktop d20 passed with 8 fits, and retest-E-d20-resting-full-2x.png shows visibly rounded corners at every silhouette vertex with no cracks.
4. SwiftShader 1-3 fps post-settle: measurement environment only, observation.

Assumptions made while designing the usage tests: (1) the emulated rounded shape is s*P ⊕ ball(BEVEL_RADIUS) with BEVEL_RADIUS=DIE_RADIUS/(4*sqrt(3))=1.6mm, and measured radii compare against 1.6mm with the self-tested instrument tolerances. (2) A "flat d6" is any face-up d6 regardless of pip count (retest rolled a 1-pip face; both runs' fits are face-outline based). (3) Held-die states only require lifted-and-held (not tilted) for band continuity; tilt evidence comes from the resting states. No observed behavior contradicted the task's stated facts: outlines follow the s-inset rounded hull, radii measure ~1.5mm vs the 1.6mm model, and the depth/band shading shows no cracks where dice touch.

Evidence files: /tmp/dice55-lt/out/retest-*.{png,json,md} and retest2-*.{png,json,md}; logs /tmp/dice55-lt/run-retest.log, run-retest2.log.
