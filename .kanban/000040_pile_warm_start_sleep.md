---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "doing"
worktree: "fix/40-pile-warm-start-sleep"
issuer: "#31"
complexity: "simple"
shortName: "pile-warm-start-sleep"
blockedBy: ""
splitter: "done"
---

# Summary
Verification only: once warm starting (#41) and whole-world sleep (#42) have landed, verify the combined behaviour end to end, so 10 mixed dice settle within 3 s under tilted gravity and stay settled until woken.

# Specs
# Scope
- The pieces live in #41 (contact warm starting, `src/physics/contacts.js`) and #42 (whole-world sleep, `src/physics/world.js`). This task owns only their combined verification: the e2e test and cross-feature checks.
- Keep friction at 0.10 (#34). No low-pass filter on the accelerometer input in `src/input/motion.js`.

# E2E test (`src/physics/world.e2e.test.js`)
- 10 mixed dice (d4 to d20) dropped into the phone box (390x844 at DPR 3) under gravity tilted 15 degrees and, as a second case, 30 degrees. Within 3 s of simulated time every die has |v| < 0.005 m/s and |w| < 0.1 rad/s. Use fixed seeds.
- Same check on a level floor.
- Cross-feature checks: a grab (held die) wakes a sleeping world at once; after waking, the pile re-settles within 3 s; while asleep, `step` does no integration, no contacts and no events; warm-start snapshots written by #41 do not resurrect stale impulses after a wake.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
- Deliverable: verification-only e2e suite `src/physics/world.e2e.test.js` for the #41 warm start + #42 whole-world sleep pair, plus the cross-feature checks (grab wakes / re-settle / inert while asleep / no stale warm-start impulses).
- State: scoped e2e scenarios not written yet. `world.e2e.test.js` on HEAD (bdf6809) covers per-die settling, containment, floor events and energy but has no 10-dice 3 s settle under 15/30 degree tilt, no level-floor 10-dice case, and no sleep/grab/stale-impulse cross checks.
- Measured on HEAD, 10 mixed dice in `boxFromViewport(390, 844, 3)`, seeds 20240601/7/99/1234/55, 6 s budget, criterion all |v| < 0.005 and |w| < 0.1 sustained: level floor 0.37-0.60 s all seeds, both axes. 15 degree tilt 0.49-3.07 s (one seed over 3 s). 30 degree tilt: x axis seed 20240601 never settles, y axis seed 1234 never settles, y axis seed 55 takes 5.89 s.
- Root cause under investigation: one d4 resting in a box corner (wall+floor) keeps spinning at 1.6-7.5 rad/s with zero active contact impulse read back from `world.contacts`, so the world never reaches `SLEEP_SPEED` and never sleeps. Angular velocity swings by up to +13 rad/s inside one 1/480 s step. Overlay probes: disabling warm start entirely makes all 30 degree x-axis seeds settle (y-axis seed 1234 still never), clearing `world.contactCache` in `sleep()` changes nothing.
- Assumption: tilt means gravity rotated 15/30 degrees about either horizontal axis, generated with `world.setGravity`, friction stays 0.10.
- Blocker: the pinned acceptance criterion (every die still within 3 s at 30 degrees) fails on the current tree, and a green e2e suite needs a small physics fix; the suspect is the corner-contact torque source inside `solveContacts`, not the sleep or cache wiring.
- Manual checks left to other roles: none.
