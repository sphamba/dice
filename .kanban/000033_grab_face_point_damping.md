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
Live test #33 status: page-1 core behavior all PASS on the fresh HEAD build (S1 off-center grab no-snap 0.0px drift, S2 slow drag exact follow, S3 near-vertex grab, S4 outside-silhouette no-grab + positive control, S5 mid-tumble catch calms with 0.0px vector and 0.0deg mask-angle drift, S6 fling departs + tumbles + contained, S6b slow release no fling). S6 tumble confirmed via mask angle 50->57->64->-31deg across clipped flight frames.

S8 investigation COMPLETE, root cause found, product defect FILED as card #37:
- The S8 detector used "Roll tumbles the die" as the stuck-hold signal. That signal is INVALID: card #37 = after one Roll click, dice are thrown up with ROLL_LIFT 0.6-1.2 m/s in a 0.05 m-tall box, slam into the ceiling and stay PINNED mid-air, static for the full 20 s measured (14 frames, whole-scene diff 5-13 px, die frozen at (525,334)). Every earlier "die settled before a slow frame" oddity matches this pin. Filed with evidence and fix direction (scale lift to the box / fix wake); it is a roll-feature defect, not a grab-code defect, and it blocks the old S8 method only.
- Also calibrated: in the fresh build a grabbed resting die does NOT lift (y constant 243 through hold+release; the drive holds z at grab-time z), so a fall-based probe needs an airborne grab. CDP rejects a bare touchMove after touchCancel, but a synthetic pointercancel for the touch pointerId leaves the CDP touch session active, so post-cancel touchMove still dispatches.

NEW S8 design (implemented next, no Roll involved): grab -> positive control (pointer move +40px, die must follow, proving the drive path works) -> pointercancel (real CDP touchCancel for touch; synthetic pointercancel for mouse pointerId 1) -> same-pointer move +80px -> the die must NOT follow (released entry). Direct test of the hold-table cleanup, robust at floor level.

Remaining after S8 rewrite: fix S5 follow-check formula (it double-counted the +60px drag; pointerPos already updated) and 900ms settle, relax S6c movement threshold 250->150px (observed 213-336px variance from bounces), rerun full suite, final results table.
