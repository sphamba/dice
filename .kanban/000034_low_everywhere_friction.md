---
name: "fix: reduce box and die friction and clamp diagonal friction correctly"
priority: "high"
state: "merging"
worktree: "fix/34-low-everywhere-friction"
issuer: "#8"
complexity: "simple"
shortName: "low-everywhere-friction"
---

# Summary
Lower box and die-die Coulomb friction to 0.10 and use a true 2D friction disk so diagonal contacts cannot exceed the selected coefficient. Preserve unrelated restitution and damping.

# Specs
# Required tuning
- Set both `FRICTION_BOX` and `FRICTION_DIE` in `src/physics/contacts.js` to 0.10 (currently 0.4 and 0.3).
- Treat each contact's two tangent impulses as one 2D Coulomb friction vector. Clamp its combined magnitude to at most `mu * normalImpulse`; do not retain two independent caps that permit sqrt(2) times the requested friction on diagonal motion.

# Physics scope
- Fix the shared contact solver path used by all callers. Do not compensate with stronger world or held-body damping.
- Preserve solver iterations, restitution, Baumgarte correction, event thresholds, free-body damping and contact angular damping. Held-drag damping is handled by its separate task.
- Dice must reliably slide/tumble away from slanted walls rather than remain friction-stuck, while still settling on a level floor and remaining contained.

# Regression coverage
- Retain and adapt one-axis friction tests. Add a diagonal-tangent test proving the combined tangent impulse never exceeds 0.10 times the accumulated normal impulse.
- Add a flat sliding-contact/incline regression: friction 0.10 resists sliding below its critical angle (about 5.7 degrees) and permits sliding above it; include a case such as 10 degrees that cannot remain stuck.
- Run end-to-end world checks with mixed dice to confirm level-floor settling within the existing limit, no tunneling, no NaN state and no dice escaping the box.
- Browser live-test tilted-device or equivalent gravity on walls and die-die contacts on phone and desktop sizes.

# Acceptance commands
- `npx vitest run src/physics/contacts.test.js src/physics/world.e2e.test.js`
- `npm run build`

# Notes
## Review outcome: approved (no fixes committed, state unchanged)

- Spec verified in the diff: FRICTION_BOX/FRICTION_DIE = 0.10; `solveAxis` split into `solveNormal` + `solveFriction` with one 2D Coulomb disk clamping the combined tangent magnitude to `mu * normal.impulse`, so diagonal motion cannot reach sqrt(2) times the coefficient. Solver iterations, restitution, Baumgarte, event thresholds, and free/contact angular damping are untouched; `FRICTION_*` and tangents have no consumers outside contacts.js; audio uses only the summed normal event impulse, which kept its semantics.
- `containBody` fix accepted as in scope and correct: with any nonzero push on another axis (e.g. floor penetration), the old loop's ternary zeroed positive x/y velocity on zero-push axes, which blocked +x/+y sliding; the new `push[axis] === 0` skip removes that bug and adds no damping. The developer disclosed it in Notes.
- Tests: `contacts.test.js` 18/18, `world.test.js` 13/13, `npm run build` green (dist hashes match the Notes; needed the documented node_modules/.bin symlink repair). New regression coverage matches the spec: one-axis test retained, diagonal disk bound, incline hold at 5 degrees and slide at 10 degrees, mixed-dice level settling, tilted-gravity 10-degree slide, all passing.
- Performance test: the e2e `performance` threshold (500 ms) fails intermittently here, but an A/B on a git-archive copy of `main` (main checkout untouched) failed 4/4 runs at 584-612 ms, so this is pre-existing machine noise, not a regression from this change. The developer's environment-noise interpretation is verified and accepted, as is the `MIN_IMPULSE = 1e-12` skip (probe confirms exact disk saturation despite it).
- Independent numeric probe: applied friction impulse saturates exactly at `mu * N` (0.065) for tangent directions 0/15/30/45/60/75/90 degrees, restitution target preserved, and the incline boundary sits between 5.5 and 5.9 degrees, matching the documented atan(0.1) ~ 5.71 degrees.
- Deferred to live testing: browser check of tilted-device gravity on walls and die-die contacts at phone and desktop sizes.
- Guidance for future reviewers: run only `contacts.test.js` and `world.test.js` plus one `world.e2e.test.js` pass, and weigh the `performance` case against a `main` baseline before calling it a regression.
