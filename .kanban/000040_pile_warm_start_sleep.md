---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "done"
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
## Live test result: PASS (run lt40-run2, results at /tmp/dice-lt40/results-pile-warm-start-sleep-phone.json, 36/36 checks)

Real-usage test of the merged commit (da52aff) through the app's real interface: Chrome phone context 390x844 at DPR 3 (touch, mobile UA, SwiftShader), 10 mixed dice built through the panel UI (d4:2 d6:2 d8:2 d10:2 d12:1 d20:1), tilts applied as synthetic devicemotion events (the app's only gravity input path), settle measured in simulated time via a per-step clock on `world.beforeStep` with the spec thresholds (every die |v| < 0.005 m/s and |w| < 0.1 rad/s). Box from the live viewport: 0.0675 x 0.1462 x 0.0675 m, matching the spec's 390x844@3 dims.

- Settle within 3 s of simulated time, all cases: level drop 0.35 s; tilt 15 deg about x 0.40 s; 15 deg about y 0.62 s; 30 deg about x 0.48 s; 30 deg about y 0.00 s (see observations); Roll at 30 deg about y 0.80 s (harsher than the drop case: 15-40 rad/s spins, full scatter); level restore 0.32 s; grab release 0.20 s. Worst case is 0.80 s against the 3 s budget. At every settle the sampled states were genuinely at rest (max |v| <= 5e-4 m/s, max |w| <= 5e-2 rad/s).
- Defect scenario: at both 30 deg tilts the d4s end at |w| <= 0.003 rad/s (pre-fix they spun at 1.6-7.5 rad/s in a corner); no die of any type keeps residual spin, and the per-step |w| jump monitor saw large jumps only during active impacts (17-23 rad/s mid-bounce), never at rest.
- Whole-world sleep: the world fell asleep after every settle (0.4-0.5 s sim of stillness), velocities zeroed exactly.
- Stay settled until woken: while asleep at 30 deg about x, bodies were bit-identical over 2 s wall (position and quaternion drift exactly 0), zero events, asleep stayed true.
- Grab wakes at once: mousedown on a sleeping die woke the world within ~150 ms (first sample after mousedown), the die responded immediately (0.21 m/s), followed the pointer and lifted to hold height (z 0.011 -> 0.040 m, hold height = D - 2r = 0.0398 m); after release the pile re-settled in 0.20 s and the world re-slept.
- Warm-start snapshots after wake: `contactCache === null` after sleep (direct read), and after both wake paths (grab release, Roll) the pile re-settled cleanly within 3 s with no kicks or jitter, so no stale impulses resurrect.
- No NaN in any body state at any sampled point; console clean (no product errors); final render non-blank (screenshot /tmp/dice-lt40/final-settled.png).

## Assumptions made while designing the usage tests
- "Dropped into the phone box" is exercised as the app's real spawn flow: panel adds at level gravity (dice spawn in the upper half and fall), then tilts wake the pile from sleep; each tilt case measures from the tilt dispatch. Consecutive tilts reuse the pile, so configuration carries over between cases.
- The 3 s settle budget is a simulated-time budget (spec's e2e wording); in the live app sim runs at ~0.94 s per wall s, so measured wall feel matches.
- Roll at 30 deg was added as a harsher-than-spec warm-start stress, not a spec requirement; its 0.80 s settle is reported as evidence beyond the minimum.
- Gravity tilt values are exact (9.81 sin/cos components); the sampled world gravity matched each expected vector to <= 4e-7.

## Observations (no product defects filed)
- tilt30y settle=0.00 s is weak evidence on its own: the pile was already wedged near the 30 deg-about-y equilibrium by the preceding 15y -> 30x -> grab phases, so dice barely moved. The 30 deg settle evidence comes from 30x (0.48 s, real slide across the box) and the full-scatter Roll at 30y (0.80 s).
- While asleep, `world.contacts` retains the last awake step's contact list (69 entries at 30x); `step` performs no detection or solving while asleep (events 0, state bit-frozen), `contactCache` is cleared, and nothing app-facing reads `world.contacts`, so this is stale internal state, not user-visible behavior.
- Environment difficulties, solved in harness: Playwright's devices['iPhone 13'] viewport is 390x664 (browser chrome subtracted), which gave a box H 21 percent short of the spec's 390x844 box; fixed by overriding the viewport to 390x844. Driver run 1 was aborted by a harness bug of mine (undeclared variable in the in-page clock wrapper killed the simulation); rerun clean, no product impact.
