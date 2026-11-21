---
name: "fix: drag dice by the grabbed face point with linear and angular damping"
priority: "high"
state: "reviewing"
worktree: "fix/33-grab-face-point-damping"
issuer: "#8"
complexity: "moderate"
shortName: "grab-face-point-damping"
blockedBy: ""
splitter: "done"
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
## Deliverable
- `src/input/pointer.js`: rays are intersected with the transformed convex faces of each die (plane solve on the orthographic downward ray plus per-edge containment), and the closest non-negative surface hit wins across bodies, so the nearest surface replaces the old greatest-center-z rule. The bounding circle stays only as a broad-phase prune.
- Pointer down converts the world hit to a body-local offset. Every fixed step rotates that offset with the current orientation and drives the center so the material point tracks pointer XY, with `linearVelocity + angularVelocity x rotatedOffset` accounted for, so damping the spin does not pull the anchor off the finger. Center z still drives to hold height `D - 2 * radius`.
- Held damping lives in the existing `world.beforeStep` drive: frame-rate-independent exponential gain for the point pull and per-step exponential decay of angular velocity. No new world callback, unheld integrator damping unchanged, no upright forcing.
- Release/fling untouched: pointer velocity to center XY, `vz = 0`, residual spin plus the existing speed-based random spin, 3 m/s clamp, pointercancel handled as before.
- `src/input/pointer.test.js` rewritten: exact top-face hit for every die type (d4, d6, d8, d10, d12, d20 real shape data), tilted off-center grab anchored to the pressed material point, miss inside the bounding circle but outside the face, nearest-surface pick between overlapping dice with a lower center, no center snap on an off-center grab, anchor and height within 1 mm at 30/60/144 fps, pointer jump with under 2 mm overshoot and held XY speed at the drag clamp, 60 rad/s spin to under 0.1 rad/s within one second and monotone decay, linear rest without drift, duplicate shared holds in insertion order, and pointercancel keeping the other grab.

## Verification
- `npx vitest run src/input/pointer.test.js`: 15 passed.
- `npm run build`: green; `dist/index.html` references `./assets/index-CG-QCp7E.js` and `./assets/index-DasNQWd4.css`.
- Commit `2cef6cc` on `fix/33-grab-face-point-damping`.

## Assumptions
- Held drive commands the point velocity directly from the current anchor error instead of retaining momentum: this is the only shape that meets the settle, no-snap and no-overshoot requirements at every frame rate, and it keeps the old drag-speed clamp.
- Hold damping constants are unexported module values (120 1/s point pull, 8 1/s angular decay); tests assert the spec thresholds, not the constants.
- Bodies without face data are not pickable; every body from `createBody` has shape faces.
- Duplicate holds damp spin once per held entry, so a shared grab decays slightly faster.

## Blockers
- None.

## Manual checks left to other roles
- Confirm in a browser that a die grabbed near a face edge or vertex does not slide under the finger and that a held fling still spins.
