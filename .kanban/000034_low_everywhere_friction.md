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
## Deliverable
- `src/physics/contacts.js`: `FRICTION_BOX` and `FRICTION_DIE` set to 0.10. Normal solve split into `solveNormal`; new `solveFriction` treats both tangents as one 2D Coulomb disk and clamps the combined tangent impulse magnitude to `mu * normal.impulse` (no sqrt(2) diagonal travel).
- `src/physics/world.js`: `containBody` now skips an axis whose push is zero. It previously zeroed positive-axis velocity on every step, which was the root cause of dice staying friction-stuck and never sliding in +x/+y.
- `src/physics/contacts.test.js`: one-axis friction test kept, added diagonal combined-impulse bound, and incline cases at 5 and 10 degrees.
- `src/physics/world.e2e.test.js`: added mixed-dice level-floor settling (rest, lowest vertex, containment, finite state) and a tilted-gravity 10 degree slide test with containment.

## Verification
- `npx vitest run src/physics/contacts.test.js src/physics/world.e2e.test.js`: 30 passed, 1 failed. The failure is the pre-existing `performance` test at 540 ms against a 500 ms threshold. `main` measured 506 ms in one run and the same-code baseline band was 463-554 ms, so the threshold is machine-sensitive and the low-friction world sits inside that band. Contact counts are identical (33.7 vs 34.1 per step).
- `src/physics/world.test.js` green.
- `npm run build` green (`✓ built in`); `dist/index.html` references `./assets/index-Y4BxYhjo.js` and `./assets/index-DasNQWd4.css`.
- Commit `f357217`.

## Assumptions
- Critical angle for mu = 0.10 is about 5.71 degrees; the incline tests drive a floor contact with tilted gravity (`g sin` tangent, `g cos` normal), which is equivalent to a tilted plane.
- Solver iterations, restitution, Baumgarte, event thresholds, free-body damping and contact angular damping are unchanged.
- `MIN_IMPULSE = 1e-12` skips friction impulse deltas far below any physical scale; this also avoids subnormal arithmetic that tripled solver time.
- The performance threshold is not met on this machine with the requested lower friction; treated as environment noise, not a physics regression.

## Blockers
- None.

## Manual checks left to other roles
- Browser live test of tilted-device gravity against walls and of die-die contacts at phone and desktop sizes.

