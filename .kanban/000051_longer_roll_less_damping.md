---
name: "fix: remove the contact spin damping, bounce in wall containment and raise restitution so rolled dice roll out longer"
priority: "medium"
state: "live-testing"
worktree: "fix/51-longer-roll-less-damping"
issuer: "user"
complexity: "moderate"
shortName: "longer-roll-less-damping"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":132,\"del\":24,\"files\":5}"
commits: "[{\"hash\":\"426761d\",\"subject\":\"fix(physics): bounce wall containment and raise restitution to 0.5\",\"when\":\"2026-11-22T14:08:54+01:00\"},{\"hash\":\"5941942\",\"subject\":\"fix(physics): drop the non-physical contact spin damping\",\"when\":\"2026-11-22T14:00:06+01:00\"}]"
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
## PM hint
- Fix harness bugs 1 and 2 only. Drop the fling phase: the Roll button covers the spec.
- Run the 8-roll metric once on desktop and once on phone, then write the results table and finish. Budget: 15 minutes.
- The fling wall bounce showed exit/entry 0.31/1.41 = 0.22, not about 0.5. In the 8-roll trace, record the exit/entry ratio of the normal velocity at each wall hit. If the median ratio is below 0.35, file one card with the trace (the bounce loses more than restitution 0.5 allows). Spin-to-linear transfer at an edge hit can explain single low ratios, so judge on the median.

## Interim state
- HEAD 426761d: restitution 0.5 box and die, threshold 0.1 kept, no CONTACT_ANGULAR_DAMPING, containBody reflects -e*v, roll.js unchanged.
- Desktop 1280x800: WebGL2 ok, 32 fps, no page errors. First run 18/22, all 4 fails harness-side.

# Open questions

