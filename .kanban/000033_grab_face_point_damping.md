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
## Review outcome: approved

- Verified commit `2cef6cc` against every spec bullet; no code fixes needed; no state move.
- Acceptance: `npx vitest run src/input/pointer.test.js` 15 passed; `npm run build` green with identical asset hashes (`index-CG-QCp7E.js`, `index-DasNQWd4.css`). Both commands first failed only because this worktree's copied `node_modules/.bin` shims lost their symlink targets; restored the `vitest`/`vite` symlinks (untracked environment fix, nothing committed).
- Independent numeric probe (run once, then deleted): for all six die types tilted about (1,2,3) by 0.7 rad, the plane-solve + winding-containment pick matches a brute-force Moller-Trumbore ray-triangle hit, and the drive's `linearVelocity = pull - omega x rWorld` compensation matches with measured post-decay omega within 1e-9.
- Spec checks: exact face pick, body-local anchor, no center snap (1e-9 one-frame test), settle within 1 mm at 30/60/144 fps, under 2 mm jump overshoot with XY speed at the drag clamp, 60 rad/s to under 0.1 rad/s monotone within 1 s, linear rest without drift, nearest-surface pick over greatest center z, bounding-circle miss holds nothing, duplicate shared holds with last-pointer drive, pointercancel keeps the other grab, release/fling and 3 m/s clamp untouched, no new world callback, integrator damping unchanged, roll exclusion safe via Set in `main.js`.
- Accepted (developer-documented): velocity-servo drive instead of momentum retention; unexported damping constants with tests asserting thresholds; faceless bodies unpickable; duplicate holds decay spin once per entry.
- Accepted deviation (found in review, undocumented): the drag clamp now bounds only the XY point pull before spin compensation and the z pull is unclamped, so the initial rise to hold height can transiently exceed 2 m/s (bounded exponential, worst case about 2.8 m/s, no overshoot; anchor XY stays within the clamp). Spec requires no hold-path z clamp.
- Deferred to live testing: a die grabbed near a face edge or vertex must not slide under the finger; a held fling still spins.

Guidance: in this worktree restore `node_modules/.bin` symlinks before trusting the acceptance commands; validate pick math against ray-triangle brute force, not a re-implementation of the winding test.
