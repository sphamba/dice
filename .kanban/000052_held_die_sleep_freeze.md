---
name: "fix: world sleeps while a die is held still, and release does not wake it, freezing the die at hang height"
priority: "high"
state: "backlog"
worktree: ""
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
- While any held entry exists (`held.length > 0`), skip the sleep accumulation entirely (the world must never sleep while a die is held).
- Call `wake()` in `onRelease` and in the pointercancel handler, so a release always resumes the simulation.
- Keep the existing sleep behavior for free dice (do not regress task #42).

# Acceptance criteria
- Grab a die, hold it perfectly still for more than 1 s: the world stays awake (`world.asleep === false` the whole time).
- Release after that long still hold: the die falls immediately (vz goes negative within one step).
- Release and pointercancel wake a sleeping world.
- Existing settle/sleep behavior for free dice is unchanged (unit tests for whole-world sleep still pass).

# Notes
