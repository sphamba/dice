---
name: "fix: remove the contact spin damping, bounce in wall containment and raise restitution so rolled dice roll out longer"
priority: "medium"
state: "doing"
worktree: "fix/51-longer-roll-less-damping"
issuer: "user"
complexity: "moderate"
shortName: "longer-roll-less-damping"
blockedBy: ""
splitter: "done"
---

# Summary
Rolled dice settle in 0.2-0.5 s, partly because of CONTACT_ANGULAR_DAMPING, a non-physical viscous spin damping on every touching die. Remove it completely and let restitution, friction and the faceted shape slow the dice, with whole-world sleep for the final rest.

# Specs
# User decisions
- Remove the contact spin damping completely. It is not physical: it scales every touching die's angular velocity by `1/(1 + 6*dt)` each step, independent of the contact force and without coupling to linear velocity.
- The wall containment must bounce, not stop: reflect the into-wall velocity with the box restitution instead of zeroing it.
- Raise restitution: box 0.3 to 0.5, die-die 0.4 to 0.5.
- Raise SETTLE_LIMIT of the tilted pile tests from 3 s to 5 s. A slow rock of a pile is physical.

# Change
- `src/physics/contacts.js`: delete `CONTACT_ANGULAR_DAMPING`, the `touching` set and the damping loop (done in 5941942). Set box restitution 0.5 and die restitution 0.5. Keep `RESTITUTION_THRESHOLD = 0.1` and the fresh-contact restitution rule (#40).
- `src/physics/world.js` `containBody` (:57-88): where it now zeroes `linearVelocity[axis]` that points into the wall, set it to `-e * v` with `e` the box restitution from `contacts.js` (import it, do not copy the value). Apply the same `RESTITUTION_THRESHOLD`: below it, zero the component as now. Do not touch `clampIntoBox` (setBox only).
- Do not add any replacement damping or rolling resistance. Do not change friction (#43: floor and wall 0.4, lid and die 0.1), warm starting, sleep thresholds, Baumgarte, iterations, FIXED_DT, the global `LINEAR_DAMPING`/`ANGULAR_DAMPING` in `integrator.js`, or the roll velocity ranges in `roll.js`.

# Tests
- Keep the 5941942 tests: the rewritten `contacts.test.js` 'settling' guard and the source sweep for `CONTACT_ANGULAR_DAMPING`.
- `world.test.js` (or the existing containment test file): a die pushed past a wall at 1 m/s into the wall leaves with 0.5 m/s out of the wall; at 0.05 m/s it leaves with 0.
- Update the restitution value tests to 0.5.
- `world.e2e.test.js` 'roll out' block (8 seeds, desktop 1280x800 and phone 393x852 DPR 3): every seed asleep within 5 s. Record the roll-to-rest and roll-to-sleep median and maximum in Notes and compare to main (sleep median 0.78 s, rest median 0.28 s). Assert the sleep median is longer than 0.78 s.
- #40 pile tests: SETTLE_LIMIT 5 s for the tilted cases, all seeds green.
- If a test still fails, do not add damping and do not change another constant: write an Open question with the measured times.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
# Notes
## Deliverable
- Commit 5941942 removes `CONTACT_ANGULAR_DAMPING`, the `touching` set and the per-step spin scale from `src/physics/contacts.js`; no replacement damping was added and no other constant changed.
- `contacts.test.js`: the old 'settling' spin-damping test is now a guard that the solver leaves angular velocity to the contact impulses, plus a sweep over `src/**/*.js` that fails while any source contains `CONTACT_ANGULAR_DAMPING`.
- `world.e2e.test.js`: new 'roll out' block settles 2 d6, applies the real `roll.js` toss and spin on 8 fixed seeds in the desktop (1280x800) and phone (393x852 DPR 3) boxes, and asserts every seed is asleep within 5 s with the median between SLEEP_TIME and 2 s.

## Verification
- HEAD 5941942, `npx vitest run src/physics`: 111 passed, 1 failed. The failure is the pinned pile case 'settles ten mixed dice within 3 s on a 30 degree tilt about y': seed 1234 rests at 4.41 s (0.54 s with the damping), the other four seeds of that case rest at 0.36-0.69 s.
- `npm test`: 326 passed, 1 failed (same pile case). `npm run build`: green, `dist/index.html` links `./assets/index-BrdgkfOl.js`.
- Measured roll to world sleep on the pinned fixture (8 seeds): desktop median 0.74 s, phone median 0.78 s, max 0.92 s; roll to rest median 0.27 s. On main the same fixture gives sleep median 0.78 s, rest median 0.28 s, so the roll does not lengthen and the 'median longer than main' criterion is not met.
- Sensitivity probe over damping 0, 6 and 60 at 8 seeds and the speed/rise band corners: rest median 0.24-0.31 s in all three, so the contact term was never the limiting sink in this box; friction 0.4 plus per-vertex wall containment dominate.

## Assumptions
- Fixture: 2 d6 spawned at ±W/4, settled 3 s, then the `main.js` roll path (rollVelocity with in-band angle, speed 0.8-1.6, rise 0.6-0.75, random axis spin 15-40 rad/s) on both dice; time to `world.asleep` is the metric.
- The pile red is a slow physical settle, not instability: the pile stays contained and finite, rests at 4.41 s and sleeps at 4.48 s.
- SETTLE_LIMIT and the other pile thresholds are unchanged, per Specs.

## Blockers
- One pinned pile assertion is red after the removal; the resolution needs the user decision recorded in Open questions.


# Open questions

