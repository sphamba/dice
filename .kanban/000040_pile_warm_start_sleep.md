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
## PM hint
- Box2D and Bullet match warm-start contacts by contact feature id (body pair plus the vertex, edge or face indices that made the contact), not by point distance. A replay onto a contact from a different feature of a light die gives exactly a "replay much larger than the need" residual. Check whether `collision.js` can tag each contact with its feature ids and match on those first.
- Keep the constraints in Specs. If the only stable fix discards normal replay or needs a scale factor below 1, write the measured options as an Open question instead of choosing.

- Plan per PM steer: fix the d4 corner spin at its root, add its regression test, then write the e2e suite.
- Deliverable state: `src/physics/world.e2e.test.js` still lacks the 10-dice 3 s settle under 15/30 degree tilt, the level-floor 10-dice case, and the grab-wakes / re-settle / inert-while-asleep / stale-warm-start cross checks. Not written yet.
- Root cause named by measurement (instrumented overlay of `prepare`/`solveContacts`, 10 mixed dice, x axis, 30 degrees, seed 20240601, watched d4, 1 s window, sum of |angularVelocity| change per source): warm start +2518.6, solver -2483.7, angular damping -27.9, net +7.0 rad/s. Warm start replays the previous step's impulse and the 10-iteration solver cancels almost all of it but not all, so the residual keeps one light die spinning at 3-20 rad/s. A replay impulse reached 14.6x the impulse the current constraint needs. 88 warm-start events in 24 steps, 1.43 overall replay/need ratio.
- Ruled out by overlay probes (full seed matrix x/y at 0/15/30 degrees, seeds 20240601/7/99/1234/55): body mass, inertia and vertex centroids are correct (d4 mass 1.64e-3 kg, isotropic invInertia 2.38e7); 40 solver iterations still fails; clearing `world.contactCache` in `sleep()` changes nothing; skipping impact-step replays is worse; `WARM_START_DISTANCE` 0.1 mm is mixed; friction-only warm start settles every seed but discards the #41 normal replay; normal replay at 0.5 settles all but one seed at 3.36 s; match-quality weighted replay is mixed. Single-die, all-d4 and d4+d6 minimal repros settle, so the spin needs the loaded mixed pile.
- Constraints honoured: friction 0.10, restitution, Baumgarte, SOLVER_ITERATIONS and FIXED_DT untouched; variants only in `/tmp/ab40*` overlays.
- Assumption: tilt = gravity rotated 15/30 degrees about either horizontal axis through `world.setGravity`; the e2e fixture spawns 10 mixed dice across the box at random orientations with a fixed seed, no initial velocity.
- Next: choose the root fix for the replay residual, land it with the failing-seed regression test, then the e2e suite and the three acceptance commands.
