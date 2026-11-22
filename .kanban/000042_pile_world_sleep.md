---
name: "fix: whole-world sleep that freezes and wakes the dice world"
priority: "medium"
state: "to-merge"
worktree: "fix/42-pile-world-sleep"
issuer: "#40"
complexity: "moderate"
shortName: "pile-world-sleep"
splitter: "done"
---

# Summary
Freeze the whole world once every die is still and wake it on every input, so settled dice cost nothing and stay settled until the user acts.

# Specs
# Problem
- Dice that have come to rest keep integrating every step, and any residual motion (rocking piles) is visible forever. A whole-world sleep freezes all dice once they are still.

# Scope
- Files: `src/physics/world.js` and `src/physics/world.test.js`. Read `src/input/pointer.js` to get the held-die semantics right.
- Do not edit `src/physics/contacts.js`, `collision.js` or `src/input/*`; another subtask owns contact warm starting.
- Do not add a low-pass filter on the accelerometer input in `src/input/motion.js`.
- Do not change friction, restitution, Baumgarte, SOLVER_ITERATIONS or FIXED_DT.

# Sleep (`src/physics/world.js`)
- After each step, compute the fastest die point speed `max(|v| + DIE_RADIUS*|w|)` over all bodies (`DIE_RADIUS` lives in `src/physics/body.js`).
- When it stays below `SLEEP_SPEED = 0.01 m/s` for `SLEEP_TIME = 0.5 s` of simulated time, set every velocity to zero and mark the world asleep. While asleep, `step` returns at once (no integration, no contacts, no events).
- The world wakes, and the sleep timer restarts, on each of these:
  - a held die (pointer grab or drag through the `beforeStep` drive of #33). A grab must always move the die at once.
  - any body with a non-zero velocity (Roll, Space, fling),
  - `addBody`, `removeBody` and `setBox` (resize),
  - a gravity change of more than 0.5 m/s^2 from its value at sleep time.
- Held-die semantics: `src/input/pointer.js` sets `world.beforeStep = drive` once and only clears it in `destroy()`, so the drive callback stays set when no die is held. The wake condition must be "a die is held" (the held set is non-empty), not "a callback exists", or the world never sleeps. Check what state the drive exposes to detect a hold (for example the `held` map or the `heldBodies` accessor) and pick the cheapest reliable signal.

# Tests (add to `src/physics/world.test.js`)
- The world sleeps after 0.5 s below the threshold.
- Each wake condition wakes it: held die, non-zero velocity, addBody, removeBody, setBox, gravity change above 0.5 m/s^2.
- A gravity change below 0.5 m/s^2 does not wake it.
- While asleep, `step` does no integration, no contacts and no events.
- All existing physics tests stay green.

# Acceptance criteria
- `npx vitest run src/physics`

# Notes
- Outcome: approved. No fixes needed.
- Diff eb6d2ef touches only src/physics/world.js and world.test.js; no forbidden files, no changes to friction, restitution, Baumgarte, SOLVER_ITERATIONS or FIXED_DT, no motion low-pass filter.
- Spec mapping verified: fastest point speed `|v| + DIE_RADIUS*|w|` after each step; sleep at SLEEP_SPEED=0.01 for SLEEP_TIME=0.5 zeroes every velocity and marks the world asleep; asleep step runs only beforeStep plus the velocity check, so no integration, contacts or events; wake and timer restart on held die, non-zero velocity, addBody, removeBody, setBox and gravity change above WAKE_GRAVITY_DELTA measured against the gravity captured at sleep time, so cumulative small tilts add up correctly.
- Held-die wake assumption accepted: the drive callback's velocity writes are the hold signal, because pointer.js keeps `held` private, its `heldBodies()` accessor never reaches the world, and src/input/* and main.js are out of scope. A grab always writes a non-zero lift velocity, so a grab moves the die at once; behaviorally equivalent to "held set non-empty" in every observable case. If a later task wires heldBodies() into the world, this assumption can be retired.
- Non-blocking observation: `world.contacts` keeps stale entries while asleep (detectContacts is skipped); no consumer outside src/physics reads world.contacts, so it is harmless.
- Evidence: `npx vitest run src/physics` -> 86 passed in 8 files, exit 0. `npm run build` green, hashed assets emitted.
- Deferred to live-tester: grabbing a sleeping die moves it at once, a settled pile shows no residual motion, Roll/Space/fling wake the world, strong accelerometer tilt (above 0.5 m/s^2) wakes it while small tilt does not.
- Guidance for future reviewers: the held-die wake signal is the drive's velocity writes, not a held-set query; judge any change to that signal against the grab-moves-at-once requirement.
