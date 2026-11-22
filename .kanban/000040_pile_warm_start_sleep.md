---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "doing"
worktree: "fix/40-pile-warm-start-sleep"
issuer: "#31"
complexity: "moderate"
shortName: "pile-warm-start-sleep"
blockedBy: ""
splitter: "done"
---

# Summary
Verify warm starting (#41) and whole-world sleep (#42) end to end, and fix the physics defect that keeps a d4 spinning in a box corner under 30 degree tilt, so 10 mixed dice settle within 3 s under tilted gravity and stay settled until woken.

# Specs
# Scope
- The pieces live in #41 (contact warm starting, `src/physics/contacts.js`) and #42 (whole-world sleep, `src/physics/world.js`). This task owns their combined verification (the e2e test and cross-feature checks) and the fix of any physics defect that makes the e2e criteria fail.
- Keep friction at 0.10 (#34), restitution, Baumgarte, SOLVER_ITERATIONS and FIXED_DT as they are. No low-pass filter on the accelerometer input in `src/input/motion.js`. Do not loosen the thresholds or the 3 s limit, and do not change the seeds to avoid a failing case.

# Known defect to fix
- At 30 degree tilt, one d4 resting in a box corner (wall + floor) keeps spinning at 1.6-7.5 rad/s with zero active contact impulse read back, and its angular velocity jumps by up to 13 rad/s inside one 1/480 s step. With warm starting off, most of these cases settle. Find the root cause (for example a warm-started impulse applied to a contact whose point or lever arm no longer matches, a stale friction impulse projected onto new tangents, or a corner contact with a wrong lever arm) and fix it at the source in `src/physics/contacts.js` or `src/physics/collision.js`.
- Add a focused regression test for the root cause (a d4 in a box corner under 30 degree tilt comes to rest), next to the e2e test.
- If the only fix you find needs a change to a constant listed in Scope, do not make it: write an Open question with the measured options.

# E2E test (`src/physics/world.e2e.test.js`)
- 10 mixed dice (d4 to d20) dropped into the phone box (390x844 at DPR 3) under gravity tilted 15 degrees and, as a second case, 30 degrees, about both horizontal axes. Within 3 s of simulated time every die has |v| < 0.005 m/s and |w| < 0.1 rad/s. Use fixed seeds (at least the 5 seeds already measured: 20240601, 7, 99, 1234, 55).
- Same check on a level floor.
- Cross-feature checks: a grab (held die) wakes a sleeping world at once; after waking, the pile re-settles within 3 s; while asleep, `step` does no integration, no contacts and no events; warm-start snapshots written by #41 do not resurrect stale impulses after a wake.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
## PM steer
- The physics fix is in scope for this task now (see Specs, "Known defect to fix"). Fix the d4 corner spin at its root, add its regression test, then write the e2e suite.

## Measured on HEAD bdf6809 (before any fix)
- 10 mixed dice in `boxFromViewport(390, 844, 3)`, seeds 20240601/7/99/1234/55, 6 s budget, criterion all |v| < 0.005 and |w| < 0.1 sustained.
- Level floor: 0.37-0.60 s for all seeds, both axes.
- 15 degree tilt: 0.49-3.07 s (one seed over 3 s).
- 30 degree tilt: x axis seed 20240601 never settles, y axis seed 1234 never settles, y axis seed 55 takes 5.89 s.
- One d4 in a box corner (wall + floor) keeps spinning at 1.6-7.5 rad/s with zero active contact impulse read back from `world.contacts`. Angular velocity jumps by up to 13 rad/s inside one step. Warm start off: all 30 degree x-axis seeds settle, y-axis seed 1234 still never. Clearing `world.contactCache` in `sleep()` changes nothing.
- Assumption: tilt = gravity rotated 15/30 degrees about either horizontal axis with `world.setGravity`, friction 0.10.
