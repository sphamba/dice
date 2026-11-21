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
Live test #33 in progress. Setup: worktree `dist` (index-CG-QCp7E.js) served on 127.0.0.1:4733; Playwright chromium from /home/phamba/repos/tarot/app; harness in /tmp/dice-lt33 (lib.mjs shared helpers: red-die blob analysis with hull/mask-angle, CDP touch helpers on one reused session per page, box math, event log). No code edits; storage seeded per fresh context with app format `dice.set={"d6":1}`.

Probe done: pointerIds sequential per context (mouse=1, touch 2,3); touchMove lists only changed points; touchEnd lifts listed points; touchCancel takes no points and cancels remaining. Console clean on load (only SwiftShader artifacts at close). Box: W=0.08m=1280px, px/m=16000, die circumradius 221.7px, face halfwidth 128px, fps ~29.5.

Scenario driver /tmp/dice-lt33/driver.mjs written covering: S1 off-center hold (no snap/slide, offset vector constant), S2 slow drag tracks material point, S3 near-edge/vertex grab, S4 press inside bounding circle but outside silhouette holds nothing (+positive control), S5 roll-then-catch hold (spin calms, no forced upright, angle-drift check), S6 fling (departs +x, tumbles, stays in walls), S6b slow-release control, S6c over-speed synthetic fling (clamp/containment), S9 Roll/Add-d8 exclusion while held (die held via touch so mouse clicks don't chase the held die) + d8 grab sanity, S8 pointercancel real-touch + synthetic-mouse paths (stuck-hold detected via per-die crop pixel diff after Roll), S7 two-dice page: mouse hovers A over B, touch2 presses the overlap (nearest-surface pick), B unmoved, releasing one pointer returns A to pointer-1 hold, both release cleanly.

Pending: add cropDiff helper to lib.mjs, node --check, run driver, analyze results. No product findings yet.
