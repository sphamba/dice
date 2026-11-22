---
name: "fix: world sleeps while a die is held still, and release does not wake it, freezing the die at hang height"
priority: "high"
state: "to-merge"
worktree: "fix/52-held-die-sleep-freeze"
issuer: "#45"
complexity: "simple"
shortName: "held-die-sleep-freeze"
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
- Outcome: approved (no fixes committed).
- Spec bullet "world must not sleep while any die is held": met by `world.wake()` at the top of `drive()` (src/input/pointer.js:172), which runs as `world.beforeStep` before the asleep early-return in `world.step()` (src/physics/world.js:148-149), so a held die keeps the world awake every step; matches the spec's own suggested smallest change.
- Spec bullet "wake on release and pointercancel": met; `onRelease` is bound to both events and calls `world.wake()` (pointer.js:257).
- Spec bullet "keep free-die sleep behavior (#42)": met; the world.js diff adds only the public `wake` reference, sleep logic untouched, all sleep/waking tests in world.test.js green.
- Tests: hold-still test asserts asleep=false for 1.5 s (90 frames) vs the spec's "2 s"; 1.5 s is 3x the 0.5 s SLEEP_TIME and was red before the fix, accepted as covering the bullet. Release-after-hold (vz < 0, position drops) and pointerup/pointercancel wake tests present and green. New `wake()` unit test in world.test.js green.
- Evidence: `npx vitest run src/input src/physics` 10 files 136 tests passed; `npm test` 27 files 322 tests passed; `npm run build` green.
- Reachability checked: `asleep` is read only inside world.js (main.js never gates update on it, so the drive-wake path always executes); `wake` consumers are drive and onRelease only.
- The lever-arm sleep-gate quirk for free dice stays out of scope as recorded; a held die can no longer sleep regardless of the gate, so the off-vertical held freeze from the Evidence section is also covered.
