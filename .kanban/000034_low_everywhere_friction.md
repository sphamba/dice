---
name: "fix: reduce box and die friction and clamp diagonal friction correctly"
priority: "high"
state: "reviewing"
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
## Review progress (checkpoint)

- Read TASK.md, the full diff `main...HEAD` (4 files, +124/-15), and all changed files plus `src/physics/world.js` context. Base branch confirmed as `main`.
- Spec compliance verified by reading: FRICTION_BOX/FRICTION_DIE = 0.10; `solveAxis` split into `solveNormal` + `solveFriction` with one 2D Coulomb disk clamping the combined tangent magnitude to `mu * normal.impulse`; iterations, restitution, Baumgarte, event thresholds, angular damping untouched; `FRICTION_*`/tangents used nowhere else; audio reads only the summed normal event impulse (unchanged).
- `containBody` fix in world.js judged correct and in scope: with any nonzero push (e.g. floor penetration), the old loop zeroed positive x/y velocity on zero-push axes via the ternary false branch; the new `push[axis] === 0` skip removes that blocker. It removes a bug, adds no damping.
- Scoped tests run: `contacts.test.js` 18/18 passed; `world.e2e.test.js` flaky only in the pre-existing `performance` test (observed 511/632 ms fails and one pass in 3 runs); `world.test.js` 13/13 passed. `npm run build` green after the documented node_modules/.bin symlink repair; dist asset hashes match the developer's Notes.
- Performance A/B: `main` code run from a git-archive copy in /tmp (main checkout untouched) failed the same 500 ms threshold in 4/4 runs at 584-612 ms, so the threshold failure is pre-existing machine noise, not a regression from this change. Developer's environment-noise claim verified.
- Numeric probe designed: disk saturation across tangent directions 0-90 degrees plus critical-angle boundary at 5.5/5.9 degrees. First run failed on a probe formula error (used `v0 - v` on both axes instead of per-axis initial components); solver behavior confirmed correct by direct inspection (v = [0.935, 0, 0.15] for a 1 m/s tangent). Probe fixed, rerun pending.
- Still pending: probe rerun, final verdict, final Notes rewrite. No findings requiring fixes so far.
