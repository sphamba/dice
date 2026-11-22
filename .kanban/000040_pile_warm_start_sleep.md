---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "live-testing"
worktree: "fix/40-pile-warm-start-sleep"
issuer: "#31"
complexity: "moderate"
shortName: "pile-warm-start-sleep"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":226,\"del\":3,\"files\":4}"
commits: "[{\"hash\":\"da52aff\",\"subject\":\"test(physics): run the pile settle cases on all five measured seeds and assert the sleep drops warm starts\",\"when\":\"2026-11-22T10:15:26+01:00\"},{\"hash\":\"d29f7a9\",\"subject\":\"fix(physics): settle a tilted pile by measuring approaches before warm start\",\"when\":\"2026-11-22T03:01:51+01:00\"}]"
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
## Live test in progress (state at watch checkpoint)

- Setup done: harness at /tmp/dice-lt40 (Playwright at /home/phamba/repos/dotfiles/pi-agent/skills/web-browser/node_modules, vite on :8790, SwiftShader WebGL flags, world spy via main.js route rewrite, in-page helpers: state sample, synthetic devicemotion tilt, sim-time clock wrapping the pointer drive).
- Environment probe PASSED (7/8): app loads on a 390x844@DPR3 phone context, world spawns 2 d6, tilt dispatch sets world gravity exactly, mouse grab moves a die (31.9 mm in 0.75 s), canvas renders non-blank, console clean, sim runs ~0.94 s per wall s. The one probe failure was my context, not the product: Playwright's devices['iPhone 13'] viewport is 390x664 (browser chrome subtracted), which gave box H=0.115 m instead of the spec's 390x844 -> 0.146 m; fixed by overriding the viewport to 390x844 (still a real phone flow: touch, mobile UA, DPR 3).
- Planned flow (assumption: the spec's "dropped into the phone box" is exercised as panel adds at level gravity, then tilts applied by synthetic devicemotion, matching a user tilting a phone; settle criterion |v|<0.005 m/s, |w|<0.1 rad/s per die, measured in simulated time; phone box 0.0675 x 0.1462 x 0.0675 m): level drop settle, tilts 15x, 15y, 30x, 30y (each: gravity applied, wake, settle within 3 s, whole-world sleep), frozen-while-asleep at 30x (bit-identical over 2 s, no events, contactCache null), grab wakes sleeping world at once + re-settle within 3 s after release, Roll stress at 30y, restore level, no NaN, console clean.
- Driver run 1 aborted by a harness bug before any product check: my in-page clock wrapper referenced an undeclared variable (bi), which threw inside world.beforeStep every step and stopped the simulation; this is a test-harness defect, not a product defect. Fixing the wrapper and rerunning the driver; no product findings yet.
