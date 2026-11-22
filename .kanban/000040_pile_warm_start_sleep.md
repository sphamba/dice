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
- Plan per PM steer: fix the corner/die chatter at its root, add its regression test, then the e2e suite.
- Two findings since the last checkpoint.
- Finding 1, the earlier probe fixture was invalid: spawning 10 dice at random positions inside a box only 4 die-widths wide put 16 pairs closer than one die diameter, the worst with centres 7.4 mm apart against a 27.7 mm diameter. Deep spawn overlap handed the solver a violent initial state and polluted every variant sweep in the previous notes. The corrected fixture spawns on a 2x5 jittered grid with random orientations and random drop heights, no initial overlap.
- Finding 2, on the corrected fixture restitution is the driver: `RESTITUTION_BOX`/`RESTITUTION_DIE` at 0 settles every seed and both axes at 0/15/30 degrees within 0.19-1.25 s, while the shipped values leave the y-axis (long slide, 0.146 m) piles in a permanent limit cycle, max |w| oscillating 2-12 rad/s with no decay over 20 s and the world never sleeping.
- Root-cause measurement: freeze the settled pile by zeroing every velocity and gravity, then step. With the warm-start cache kept, |w| jumps to 3.67 rad/s at once; with the cache cleared the pile stays frozen (0.029 to 0). So cached impulses are replayed into a state that no longer needs them, and restitution on top of a persistent contact keeps pumping the rocking mode.
- Candidate fix now measured (candidate only, `/tmp/ab40v16`, worktree still untouched): keep the restitution constants exactly as they are and change only the condition, so restitution applies to a fresh contact and a contact already present in the previous step is inelastic. Grid matrix, seeds 20240601/7/99/1234/55, 6 s budget: level 0.27-0.33 s, 15 degrees 0.36-0.91 s, 30 degrees 0.44-1.25 s, both axes, every seed inside the 3 s bar and the |v|/|w| bar.
- Ruled out on the corrected fixture: SOLVER_ITERATIONS 40 (still fails), CONTACT_ANGULAR_DAMPING 10/20/40/80 (all still fail), feature-id warm-start matching alone (worse, y-axis fails on all seeds), skipping impact-step replays (worse), containment teleport (not the cause), no speculative contact margin (much worse).
- Constraints honoured: friction 0.10, restitution values, Baumgarte, SOLVER_ITERATIONS, FIXED_DT and `src/input/motion.js` untouched in the worktree; all experiments in `/tmp/ab40*` overlays.
- Assumption: tilt = gravity rotated 15/30 degrees about either horizontal axis through `world.setGravity`; the e2e fixture spawns 10 mixed dice on the non-overlapping grid described above.
- Next: land the fresh-contact restitution condition in `src/physics/contacts.js` with a regression test for the failing tilt case, then the e2e suite and the three acceptance commands.
- Manual checks left to other roles: none.
