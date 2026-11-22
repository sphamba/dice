---
name: "fix: world sleeps while a die is held still, and release does not wake it, freezing the die at hang height"
priority: "high"
state: "to-review"
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
- Deliverable: `world.wake()` is now public; `src/input/pointer.js` calls it on every drive step while a die is held and on every release (pointerup and pointercancel share `onRelease`). Whole-world sleep for free dice unchanged.
- Verification: `npx vitest run src/input/pointer.test.js src/physics/world.test.js src/physics/world.e2e.test.js` at b41bc44: 3 files, 68 tests passed. `npm run build` green, asset check resolves both hashed assets.
- New tests: hold a d8 still for 1.5 s and the world stays awake (red before the fix: it slept at ~0.52 s); release after a long hold falls within one step; release and pointercancel each wake a world already asleep; `world.wake()` wakes a sleeping world.
- Assumption: the hold signals "keep the world awake" through `world.wake()` per drive step instead of a new held-flag property on the world, so `world.js` gains only the public `wake` reference.
- Assumption: a d8 at the hold height reproduces the sleep in a jsdom test, a settled d6 does not; the sleep-while-held regression test therefore uses a d8.
- Out of scope: the sleep gate still compares a point speed that includes the DIE_RADIUS lever arm, so a free die spinning slowly in place can sleep early; task #42 behaviour is untouched.
