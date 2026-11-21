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
Live test #33, run8 analyzed. Still 25/27. Both remaining FAILs are harness artifacts, both now fixed in the harness:

1. S8 touch FAIL root cause (definitive, my own bug): the pev spy stores the pointerId under the key `id`, but the driver read `evId.pointerId` -> undefined -> the synthetic pointercancel was dispatched with pointerId 0 (the PointerEvent default), so the app never matched the touch entry keyed 2 and the die correctly kept following. Verified the PointerEvent constructor itself preserves pointerId 1/2/5/33 and listeners receive them. Fix applied: read `evId.id`. (The isolated pid.mjs probe already proved the product behavior is correct: with pointerId 2 + pointerType touch, the die moves 0.0px after cancel.)

2. S6 tumble FAIL root cause: the four rapid CDP mouse.move calls coalesced into ONE pointermove sample, so the app's flingVelocity saw first==last, dt=0 -> zero release velocity AND zero speed-scaled spin (flingSpin = MAX_FLING_SPIN * min(speed/3,1) * random). The die simply stayed at the release point (frozen silhouette in every frame, both runs; run5 only passed because the moves happened not to coalesce). Fixes applied: (a) fling moves now 3x260px spaced 45ms apart so each lands as its own pointer sample (speed ~0.3-0.5 m/s, spin mean ~3-5 rad/s); (b) flight frames now captured with a new in-page rAF frame grabber (lib grabFrames: canvas.toDataURL per rAF, ~15-30fps) instead of CDP screenshots, because screenshots only start ~250ms after release, by which time a fast die has already settled. S6 keeps the 3-attempt retry and now checks depart as max bbox x0 across frames (robust to frame timing).

Next: node --check, run9 full suite; expect the S8 id fix to flip that check and the grabber+spacing to make S6 deterministic. Then final results table and wrap-up.
