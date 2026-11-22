---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "to-do"
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
