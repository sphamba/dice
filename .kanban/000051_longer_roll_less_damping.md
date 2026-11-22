---
name: "fix: lower contact spin damping so rolled dice roll out for about 1-1.5 s"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "longer-roll-less-damping"
blockedBy: "#50"
---

# Summary
Rolled dice settle in 0.2-0.5 s. Reduce the contact spin damping so a normal Roll tumbles and rolls out for about 1-1.5 s before the dice rest, tuned on the 80% dice of #50.

# Specs
# Need
- After a Roll on a level floor, the dice tumble and roll out for about 1-1.5 s before they rest (now 0.2-0.5 s).

# Change
- Reduce `CONTACT_ANGULAR_DAMPING` in `src/physics/contacts.js` (now 6 1/s, applied to every touching body) to the value that meets the target. Start near 1.5 1/s and tune with the test below.
- Do not change restitution, friction (#43: floor and wall 0.4, lid and die 0.1), the fresh-contact restitution rule (#40), warm starting, sleep thresholds, Baumgarte, iterations or FIXED_DT. If the target cannot be met with this constant alone, write an Open question with the measured options instead of changing another constant.

# Tests
- `src/physics/world.e2e.test.js`: in the desktop box (1280x800) and the phone box (393x852 at DPR 3), 2 d6 settled, then a Roll with the real roll velocity code (`src/physics/roll.js`), over at least 8 fixed seeds. The time from the Roll to the world sleep has a median between 1.0 and 1.5 s and no seed above 2.5 s.
- The #40 pile tests (10 mixed dice, 15 and 30 degrees, both axes, 5 seeds, rest within 3 s) and all other suites stay green.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
