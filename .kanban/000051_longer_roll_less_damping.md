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
## Live test (interim checkpoint, in progress)

Scope: the review's deferred item only - perceived roll feel in a browser (spin, wall bounces, settle), exercised through the real UI (Roll button clicks, grab-and-fling pointer drag). No unit suites run. Assumptions: durations measured in sim time via the beforeStep clock (SwiftShader runs ~0.5x wall speed at 32 fps); live sleep median compared to the task's recorded main baseline 0.78 s and committed fixture 0.843 s (desktop); wall-bounce evidence read as per-axis velocity flips in a 1/240 s-decimated trace of the fastest die, expected exit/entry ratio ~0.5 from RESTITUTION_BOX.

- Source state confirmed: HEAD 426761d; RESTITUTION_BOX/RESTITUTION_DIE 0.5 (contacts.js:8,10), RESTITUTION_THRESHOLD 0.1 kept, no CONTACT_ANGULAR_DAMPING anywhere in src, containBody reflects into-wall velocity as -e*v (world.js:57-88), roll.js ranges untouched.
- Environment probe (desktop 1280x800 dpr 1): WebGL2 ok, 32 fps, canvas backing 1280x800 = client*dpr, box 0.08x0.05x0.05 m (MIN_BOX_EDGE guard raises mpp on the 800 px side, expected), no page errors.
- Harness: /tmp/dice-lt53 (copied from dice-lt52 precedent, port 8798). First full run 18/22 checks; all four failures are harness-side so far, no product defect yet.
- Harness bug 1 (found, fix ready): oneRoll's poll loop can sample the stale pre-roll asleep=true within the click frame and break immediately (sleep=0.000 s, samples=1). Fix: wait for the world to wake after the roll before polling for sleep.
- Harness bug 2 (under diagnosis): one spurious TypeError "s.bodies is not iterable" after the first poll sample; a 12-sample probe around a roll shows every sample well-formed (keys asleep/gravity/box/simT/bodies). Next step: print err.stack in the phase catch.
- Harness bug 3: fling replica returned 0.00 m/s from 7 logged moves (window math vs move timing), so the fling phase's speed and ratio checks were void; the die still visibly bounced off the +x wall (entry 1.41 -> exit 0.31 m/s) and settled in 0.848 s, finite and contained.
- The core 8-roll desktop metric (rest/sleep medians, wall-bounce ratios) has not run yet; rerun after the fixes, then the phone box 393x852 dpr 3.

# Open questions

