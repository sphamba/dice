---
name: "fix: remove the non-physical contact spin damping so rolled dice roll out longer"
priority: "medium"
state: "to-do"
worktree: "fix/51-longer-roll-less-damping"
issuer: "user"
complexity: "moderate"
shortName: "longer-roll-less-damping"
blockedBy: "question"
splitter: "done"
---

# Summary
Rolled dice settle in 0.2-0.5 s, partly because of CONTACT_ANGULAR_DAMPING, a non-physical viscous spin damping on every touching die. Remove it completely and let restitution, friction and the faceted shape slow the dice, with whole-world sleep for the final rest.

# Specs
# User decision
- Remove the contact spin damping completely. It is not physical: it scales every touching die's angular velocity by `1/(1 + 6*dt)` each step, independent of the contact force and without coupling to linear velocity.
- Energy loss must come only from physical sources: restitution, Coulomb friction, the faceted die shape (each tip-over onto an edge is an impact), plus the existing global damping in `integrator.js`. Whole-world sleep (#42) gives the final rest.

# Change
- In `src/physics/contacts.js`, delete `CONTACT_ANGULAR_DAMPING`, the `touching` set and the damping loop (around :34 and :270-287 on main). Delete every import or use of the constant.
- Do not add any replacement damping or rolling resistance. Do not change restitution, friction (#43: floor and wall 0.4, lid and die 0.1), the fresh-contact restitution rule (#40), warm starting, sleep thresholds, Baumgarte, iterations, FIXED_DT or the global `LINEAR_DAMPING`/`ANGULAR_DAMPING` in `integrator.js`.

# Tests
- Delete or rewrite the test that checks the contact spin damping (`contacts.test.js` 'settling').
- A source check that `CONTACT_ANGULAR_DAMPING` no longer exists in `src/`.
- `src/physics/world.e2e.test.js`: in the desktop box (1280x800) and the phone box (393x852 at DPR 3), 2 d6 settled, then a Roll with the real roll velocity code (`src/physics/roll.js`), over at least 8 fixed seeds. Measure the time from the Roll to the world sleep and record the median and maximum in the test name or Notes. The median must be longer than on main (main: 0.2-0.5 s), and every seed must reach sleep within 5 s.
- The #40 pile tests (10 mixed dice, 15 and 30 degrees, both axes, 5 seeds, rest within 3 s) and all other suites stay green.
- If a pile or settle test fails without the damping, do not add damping back and do not change another constant: write an Open question with the measured settle times.

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
- The pinned pile case (10 mixed dice, 30 degrees about y, seed 1234) now needs 4.41 s to rest against the 3 s SETTLE_LIMIT (0.54 s with the damping; the other four seeds of that case rest within 0.69 s). Raise SETTLE_LIMIT for the tilted piles, accept the slow rock on that seed, or leave it as a known red?
- The removal does not lengthen the roll: roll to world sleep median is 0.74 s desktop and 0.78 s phone, against 0.78 s on main, and a 10x damping probe lands in the same band. Friction 0.4 and the vertex wall containment dominate, so the 'median longer than main' criterion fails. Which physical source should change next to reach the longer roll the report asks for (friction, box scale, linear damping), or is the corrected physics enough for this task?

