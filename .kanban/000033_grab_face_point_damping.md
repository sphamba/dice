---
name: "fix: drag dice by the grabbed face point with linear and angular damping"
priority: "high"
state: "live-testing"
worktree: "fix/33-grab-face-point-damping"
issuer: "#8"
complexity: "moderate"
shortName: "grab-face-point-damping"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":284,\"del\":95,\"files\":2}"
commits: "[{\"hash\":\"507cf53\",\"subject\":\"fix(input): grab the exact face point under the pointer with held damping\",\"when\":\"2026-11-18T23:02:40+01:00\"}]"
---

# Summary
Use exact ray/face picking and retain a body-local grab point. Drive that point under the pointer with strong frame-rate-independent linear and angular damping while held, preserving fling behavior and approved shared multi-pointer grabs.

# Specs
# User-visible behavior
- Grab the actual visible point on the die face under the pointer, not the die center. An initial off-center grab must not slide or snap the die center under the pointer.
- While held, pull that same material point toward the pointer and continuously damp both held linear and angular motion. Use frame-rate-independent damping in the fixed-step path; do not rely on the low free-body damping or contact-only damping.
- Do not force the die upright or lock its orientation. Let remaining rotation evolve naturally while angular velocity decays to rest during a stationary hold.
- Preserve the existing release/fling contract: pointer velocity supplies center-of-mass XY velocity, vz becomes zero, residual spin remains and existing speed-based random fling spin is added. Preserve the 3 m/s release clamp and pointercancel behavior.

# Picking and drive requirements
- In `src/input/pointer.js`, intersect the orthographic downward ray with actual transformed convex die faces. Select the closest non-negative surface hit across dice, not the greatest body-center z.
- Convert the selected world hit into a body-local point on pointer down. On every fixed step, rotate that local point with current orientation and drive the center so the material point tracks pointer XY.
- Preserve center hold height `D - 2 * radius`. Account for point velocity as `linearVelocity + angularVelocity x rotatedOffset`, so damping rotation does not move the grabbed anchor away from the finger.
- Retain the existing broad-phase as an optimization if useful, but a press inside a body's bounding circle and outside its projected face must hold nothing.
- Apply dedicated held damping in the existing `world.beforeStep` drive path. Do not add another world callback or change unheld integrator damping.

# Multi-pointer contract (#18)
- A second pointer may grab an already-held die and `heldBodies()` may contain duplicates.
- Every held entry drives in insertion order, so the last held entry determines the final drive that frame. Releasing one pointer removes only its entry; other holds survive without a stuck body.

# Regression coverage
- Cover exact face hits, off-center anchor tracking, misses within the bounding circle, nearest-surface selection between overlapping dice, and every supported die type using complete real shape data or equivalent test doubles.
- Verify anchor and height within 1 mm after settling at 30, 60 and 144 fps, with no initial center snap and no more than 2 mm anchor overshoot after a pointer jump.
- With no collisions and initial angular speed 60 rad/s, held angular speed must fall below 0.1 rad/s within one second and must not grow while the pointer stays still. Verify linear motion also settles without oscillation or ongoing drift.
- Keep existing held-body release and roll-exclusion behavior. Test duplicate shared holds and last-pointer drive without deduplicating `heldBodies()`.

# Acceptance commands
- `npx vitest run src/input/pointer.test.js`
- `npm run build`

# Notes
Live test #33, run5 complete on the fresh HEAD build (index-CG-QCp7E.js was stale; serving /tmp/dice-lt33/dist-check = fresh build of 507cf53 — environment finding for the merger pipeline, not a grab-code defect).

PASSING (core spec behavior, all with 0.0px drift measurements):
- S1 off-center grab +60px: no center snap/slide over 2.5s hold, offset vector constant, center stays 60px off pointer.
- S2 slow drag 240px: die follows exactly (centroid lands at press+drag-off), material point stays under pointer, center never pulled in.
- S3 near-vertex grab 154px from center: no slide, follows.
- S4 press inside bounding circle (140px) but outside silhouette: holds nothing (0.1px), positive control grab right after works.
- S5 mid-tumble catch (retry-press loop caught on attempt 0): held die calms to static ~1.0s after grab, grabbed-point vector drift 0.0px, mask-angle drift 0.0deg over 0.9s hold (damped, orientation not forced).
- S6 fling: departs +x, tumbling confirmed (mask angle 50->57->64->-31 deg across fast clipped flight frames), stays inside walls.
- S6b slow release: no fling (0px). S6c over-speed synthetic fling (3 m/s input): die moves 213-336px, contained in all 8 frames.
- S8 plumbing: touch grab moves the die; pointercancel event fires (pev log confirms pointerdown id=2 touch + pointercancel).

OPEN, under analysis:
1. S8 CRITICAL SUSPECT: after both real-touch pointercancel and synthetic mouse pointercancel, the subsequent panel Roll moved NOTHING (scene pixel diff 11/6, die-region diff 7/6). Since rollDice excludes held bodies, zero movement is consistent with a STUCK HOLD after pointercancel (product defect candidate). Before filing: must rule out harness causes — verifying with the actual s8 frames (die position/visibility) and an isolated rerun (single die, roll clicked manually, also testing WITHOUT any prior grab as a control). Note the app binds pointercancel to the same onRelease as pointerup, and the event log shows the cancel fired, so if the hold survives it is a real bug in entry cleanup (e.g. cancel path differing from the CDP touch path).
2. S5 'grab live after calm' FAIL = harness timing: check formula double-counted the +60px drag (pointerPos already updated), and 300ms settle is short vs ~30fps headless convergence; observed die lagged 71px behind pointer, consistent with damping lag not loss of hold. Fixing formula + 900ms settle.
3. S6c movement threshold 250px too strict vs bounce variance (213-336px observed across runs); lowering to 150px.

Next: isolated S8 reproduction with controls (no-grab control, mouse-grab+cancel, touch-grab+cancel), inspect s8 frames, file defect card if the hold survives pointercancel; fix S5/S6c harness items; rerun full suite; final Notes + results table.
