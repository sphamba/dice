---
name: "fix: world sleeps while a die is held still, and release does not wake it, freezing the die at hang height"
priority: "high"
state: "done"
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
# Notes
## Live-test result (run 1, commit 594b85d)
- Outcome: approved. 36/37 checks pass, no page errors, no product defects, no cards filed. The one FAIL is a harness bookkeeping check.
- Setup: headless Chromium + SwiftShader, viewport 1100x1100, hasTouch. Harness and drivers in /tmp/dice-lt52 (copy of the proven task #45 harness; only port, out dir, and worktree path changed). Vite served the worktree on :8797 and stopped after the run. Log: /tmp/dice-lt52/run1.log; results: /tmp/dice-lt52/results-driver.json.

| Check | Verdict | Detail |
| --- | --- | --- |
| env: sample has box, gravity, finite | PASS | box 0.0635 m cube, gravity z -9.81 |
| env: sim clock advances | PASS | dt 0.533 s sim in ~1 s wall |
| env: world-to-screen scale chain | PASS | grab point maps to canvas (elementFromPoint=view) |
| d4/d8/d20: grab holds | PASS | error 0.37-0.86 mm (d20 attempt 3, see harness notes) |
| d4/d8/d20: free die asleep before grab | PASS | sleep precondition for the wake check |
| d4/d8/d20: grab wakes the sleeping world | PASS | asleep true -> false |
| d4/d8/d20: world never sleeps during 1.6 s still hold | PASS | 0 asleep samples out of 63/99/64 (1.6 s > 3x SLEEP_TIME 0.5 s) |
| d4/d8/d20: step loop ran through hold end | PASS | 407-408 trace rows, last row within 0.03 s of hold end |
| d4/d8/d20: held at grab point | PASS | error 0.19-0.21 mm < 2 mm |
| d4: die follows pointer move after still hold | PASS | 11.2 mm xy move, error 0.20 mm, asleep=false |
| d4/d8/d20: release drops the die | PASS | vz -0.326 m/s, drop 22-26 mm, asleep=false at release |
| d4/d8/d20: settles contained, finite | PASS | no NaN, 0.000 mm out of box |
| d4/d8/d20: world sleeps again after release | PASS | free-die sleep (#42) kept |
| cancel: grab holds | PASS | error 1.75 mm |
| cancel: world never sleeps during 1.0 s still hold | PASS | 0 asleep samples out of 43 |
| cancel: pointercancel drops the held die | PASS | vz -0.326 m/s, drop 5.8 mm, asleep=false at cancel |
| cancel: settles contained, finite | PASS | no NaN, 0.000 mm out of box |
| cancel: world sleeps again after cancel | PASS | free-die sleep kept |
| end: panel back to one d8 after cancel phase | FAIL | harness limit, see below |

## Harness limits (not product defects, no cards)
- The cancel phase planned a d8 but grabbed the leftover d20 of the previous phase: its respawn logic only spawns a fresh die when no body exists. So pointercancel ran on a held d20. The release handler does not depend on the die type (pointer.js:242-263), and d8 is covered by the pointerup hold phase. The end-of-run check expected panel d8:1 but the panel showed d20:1; that is the same bookkeeping slip. PM decided: no rerun, no card.
- The d20 grab needed 3 attempts (attempt 1 no converge, die moved 39.7 mm; attempt 2 grab point occluded; attempt 3 held at 0.86 mm). Precedent runs show occasional first-grab misses on d20; this is pick luck, not a regression of this fix.

## Assumptions
- Headless Chromium + SwiftShader with mouse and touch events counts as a real user interface for a pointer-hold flow.
- "Release resumes the simulation" is observable as the die falling, then the world sleeping again.
- A synthetic pointercancel PointerEvent equals a browser-issued one for this handler, which reads only pointerId.
- "Release wakes a sleeping world" cannot be staged live, because with the fix the world never sleeps while held. The task's unit tests cover that exact state, and the live release check covers the user-visible result.
