---
name: "fix: world sleeps while a die is held still, and release does not wake it, freezing the die at hang height"
priority: "high"
state: "live-testing"
worktree: "fix/52-held-die-sleep-freeze"
issuer: "#45"
complexity: "simple"
shortName: "held-die-sleep-freeze"
changes: "{\"base\":\"main\",\"ins\":55,\"del\":0,\"files\":4}"
commits: "[{\"hash\":\"594b85d\",\"subject\":\"fix(input): keep the world awake while a die is held and wake it on release\",\"when\":\"2026-11-22T13:39:29+01:00\"}]"
---

# Summary
After holding a die motionless for about 0.5 s the whole world falls asleep; releasing it then applies no velocity and the step loop stays frozen, so the die hangs in mid-air at the hold height until the user grabs it again. The world must never sleep while any die is held, and every release (pointerup and pointercancel) must wake it.

# Specs
# Evidence
- Live test (task #45, run 2, tall viewport): a d8 was grabbed and held still; the world fell asleep (asleep=true while held). After mouse-up the die stayed at the hold height with position unchanged for 0.8 s and never fell. A released die must fall (free fall from the hang height takes < 65 ms), so the die was frozen by the sleep.
- Root cause in source: `src/physics/world.js` lines 18-20 define whole-world sleep (SLEEP_TIME 0.5 s, SLEEP_SPEED 0.01); the drive output is near zero once the held pendulum calms, so `fastestPoint` drops below the threshold while a die is held. `step()` (world.js lines 141-149) returns early while asleep unless some body has nonzero velocity, and `moving()` (world.js line 30) does not consider held entries. `onRelease` in `src/input/pointer.js` deletes the held entry but never calls `wake()`, so a calm release leaves v=0, spin=0 and the world asleep: the die hangs frozen.
- The same freeze can also trap a pendulum mid-swing: the sleep gate compares a body-point speed that includes the DIE_RADIUS lever arm, so a slowly decaying swing can dip under the threshold and freeze the die off-vertical while still held.

# Fix direction
- While any held entry exists, the world must not sleep. Use the smallest change that does this (for example, the drive wakes the world each step while it holds a die).
- Call `wake()` on release and on pointercancel, so a release always resumes the simulation.
- Keep the existing sleep behavior for free dice (do not regress task #42).

# Tests (`src/input/pointer.test.js`)
- Grab a die, hold the pointer still for 2 s of simulated time: `world.asleep` stays false the whole time.
- Release after that hold: vz < 0 after one step.
- Release and pointercancel each wake a sleeping world.
- The whole-world sleep tests for free dice stay green.

# Acceptance criteria
- `npx vitest run src/input src/physics`
- `npm test`
- `npm run build`

# Notes
# Notes
- Live test of commit 594b85d (run 1, viewport 1100x1100, headless Chromium + SwiftShader, hasTouch). Harness and drivers in /tmp/dice-lt52 (copy of the proven task #45 harness; only port, out dir, and worktree path changed). Vite served on :8797 and stopped after the run. Log: /tmp/dice-lt52/run1.log; results: /tmp/dice-lt52/results-driver.json.
- Result: 36/37 checks pass, no page errors. Every spec bullet of this task passes as user-visible behaviour. No product defects found so far.
- Spec "world must not sleep while a die is held": PASS. Grabbed d4, d8, d20; each held motionless 1.6 s (more than 3x SLEEP_TIME = 0.5 s). A Node-side poll read world.asleep every 100 ms: 0 asleep samples out of 63/99/64 samples. Trace rows (one per 2 fixed steps) reach the hold end, so the step loop never stalled. The die stays at the grab point (error 0.19-0.21 mm).
- Spec "wake on release": PASS. After each still hold, mouse-up drops the die: vz -0.326 m/s, drop 22-26 mm; settles inside the box, no NaN, world sleeps again (free-die sleep kept).
- Spec "wake on pointercancel": PASS. Held a die still 1.0 s, dispatched pointercancel with the logged pointer id: the die falls (vz -0.326 m/s, drop 5.8 mm) and settles. Deviation: the die was a d20, not the planned d8 (see below).
- Spec "keep free-die sleep (#42)": PASS. Every spawn starts asleep; a grab wakes the world (asleep true -> false); after each release and after cancel the world sleeps again.
- Extra: after the 1.6 s still hold a d4 follows a 20 mm pointer move (11.2 mm xy move, grab-point error 0.20 mm, asleep=false). A long still hold leaves the die driven, not frozen.
- Harness deviation (not a product defect): the cancel phase grabbed the leftover d20 of the previous phase, because its respawn logic only spawns a fresh die when no body exists. So pointercancel ran on a held d20. The release handler is type-independent (pointer.js:242-263), and d8 is covered by the pointerup hold phase. Plan: quick d8-cancel rerun on release for exact evidence-type match.
- The only FAIL is my end-of-run bookkeeping check: it expected panel d8:1 but the panel showed d20:1, the same deviation.
- Assumptions: (1) headless Chromium + SwiftShader with mouse and touch events counts as a real user interface for a pointer-hold flow; (2) "release resumes the simulation" is observable as the die falling, then the world sleeping again; (3) a synthetic pointercancel PointerEvent equals a browser-issued one for this handler, which reads only pointerId; (4) "release wakes a sleeping world" cannot be staged live, because with the fix the world never sleeps while held - the task's unit tests cover that exact state, and the live release check covers the user-visible result.
- Environment note: the d20 grab needed 3 attempts (attempt 1 no converge, die moved 39.7 mm; attempt 2 grab point occluded; attempt 3 held at 0.86 mm). Precedent runs show occasional first-grab misses on d20; this looks like pick luck, not a regression of this fix.
