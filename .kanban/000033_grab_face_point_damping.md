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
## PM steer
- The S6 "die froze mid-air" reading is not a pin. The #37 developer measured die heights: under the orthographic top view, the offset directional shadow makes a die that rests on the floor look raised. A constant mask after a fling means that the die came to rest. Do not file or update anything about pinning. #37 now only scales the Roll lift to the box.
- Do not change #37 again. Finish run8 and write the final results of this task.

Live test #33, run7 results: 25/27 PASS. Two remaining FAILs, both root-caused:

1. S8 touch FAIL = HARNESS BUG (found and fixed): the synthetic pointercancel for the touch pointer arrived at the app with pointerId 0 instead of 2, because the harness dispatched PointerEvent with pointerType 'mouse' while the touch entry is keyed by pointerId 2; Chrome normalizes mouse-type synthetic pointer events to mouse pointerIds. Isolated rerun with pointerType 'touch' and pointerId 2: die moves 0.0px after cancel, so the product correctly releases the hold on touch pointercancel. The mouse-variant cancel (pointerId 1) passes: 0px follow after cancel.

2. S6 tumble FAIL: the flung die showed a constant mask over 6 frames (it had come to rest, see PM steer). Harness updated: S6 retries the fling up to 3 times and passes if any attempt shows visible rotation (run5 showed normal tumbling: angles 25->37->42->56->48->-27->-44deg).

Next: rerun full driver (run8) with the pointerType fix + S6 retry, expect 27/27, then final results table and wrap-up.
