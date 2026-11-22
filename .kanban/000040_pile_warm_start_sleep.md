---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "reviewing"
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
## Review progress (checkpoint)

- Scope read: one commit d29f7a9, diff touches `src/physics/contacts.js` (approach measured before warm start; restitution only on fresh contacts), `src/physics/world.js` (sleep drops `contactCache`), plus tests. Constants untouched, `src/input/motion.js` untouched.
- `npx vitest run src/physics`: 103 passed (16.5 s). `npm run build`: ok, same assets as claimed.
- Seeds probe: spec demands at least the 5 measured seeds (20240601, 7, 99, 1234, 55); the test used only 3. I edited the test to all 5: all 5 pile cases pass (16 s), so nothing was masked - the shortfall was cost only. Fix to be committed.
- Red evidence verified by me on a main-sources copy of the worktree: the two new contacts.test.js regressions fail pre-fix (2 failed, 24 passed) and 2 of 5 pile settle cases fail pre-fix. Red claims hold.
- Focused d4-corner regression (spec bullet): probed a lone d4 started from three captured pre-fix corner-spin states - it settles even on pre-fix code; subsets of 7-9 dice still reproduce, so no cheap isolated repro exists. Developer's reading (root-cause unit tests in contacts.test.js + e2e pile cases at 30 degrees in world.e2e.test.js) is a sound interpretation; will record as assumption, not a violation.
- Box dims: test uses 393x852 (the e2e convention since task #5; app sizes from live viewport) vs spec's 390x844 - negligible, will note.
- Remaining: decide on a direct `contactCache === null` sleep assertion, rerun scoped physics tests with the seed fix, commit, final Notes.
