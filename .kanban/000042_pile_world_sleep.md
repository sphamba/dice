---
name: "fix: whole-world sleep that freezes and wakes the dice world"
priority: "medium"
state: "reviewing"
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
- Deliverable: whole-world sleep in `src/physics/world.js`. Exports `SLEEP_SPEED = 0.01`, `SLEEP_TIME = 0.5`, `WAKE_GRAVITY_DELTA = 0.5` and a read-only `world.asleep`. After each step the fastest die point speed (`|v| + DIE_RADIUS*|w|`) below `SLEEP_SPEED` for `SLEEP_TIME` zeroes every velocity and marks the world asleep. An asleep `step` does no integration, contacts or events. Wakes and restarts the timer on a driven hold, any non-zero body velocity, `addBody`, `removeBody`, `setBox`, and a gravity change above 0.5 m/s^2 from the gravity at sleep time.
- Verification: HEAD eb6d2ef. `npx vitest run src/physics` -> 86 passed in 8 files. `npm run build` green, `dist/index.html` references the hashed JS and CSS assets.
- Assumptions: held-die wake is detected by running `world.beforeStep` while asleep and waking on any velocity it writes, because `pointer.js` keeps its `held` map private and the drive callback is the only in-scope signal; a held die that is already at rest still lets the world sleep.
- Blockers: none.
- Manual checks left to other roles: live check that grabbing a sleeping die moves it at once, that a settled pile stops all visible motion, and that Roll, Space and fling wake it.
