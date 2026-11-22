---
name: "fix: remove the non-physical contact spin damping so rolled dice roll out longer"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "longer-roll-less-damping"
blockedBy: "#50"
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
