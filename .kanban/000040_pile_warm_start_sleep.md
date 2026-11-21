---
name: "fix: let resting dice piles settle with warm starting and whole-world sleep"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "#31"
complexity: "moderate"
shortName: "pile-warm-start-sleep"
blockedBy: "#37"
---

# Summary
Piles of dice, mostly under tilted gravity, rock forever. Add contact warm starting in the solver and a whole-world sleep that freezes all dice once they are still, with correct wake on every input, so 10 mixed dice settle within 3 s.

# Specs
# Problem
- With tilted gravity (15-30 degrees, the usual case on a hand-held phone), 10 mixed dice form a corner pile that never comes to rest (angular speed up to 1.2 rad/s forever). A level floor settles in about 0.4 s.
- Cause (measured in a copy of the engine): contact impulses restart at zero every step (no warm starting), so 10 iterations cannot converge 20-40 coupled contacts. More substeps with fewer iterations, soft contacts and a relax pass were tested and did not fix it.

# User decisions
- Fix with warm starting plus whole-world sleep.
- Keep friction at 0.10 (#34). Do not change friction, restitution, Baumgarte, iterations or FIXED_DT.
- No low-pass filter on the accelerometer input in `src/input/motion.js`.

# Warm starting (`src/physics/contacts.js`, plus contact data from `collision.js` if needed)
- Keep the solved contacts of the last step on the world object (not in module state).
- For each new contact, find the old contact with the same body pair and surface whose point is within 1 mm and whose normal agrees (dot > 0.99).
- Start the new accumulated normal impulse at the old value and apply it before the iterations. Project the old friction impulse onto the new tangent directions, clamp it to the friction disk of the warm-started normal impulse, and apply it.
- A contact with no match starts at zero, as today.

# Whole-world sleep (`src/physics/world.js`)
- After each step, compute the fastest die point speed `max(|v| + DIE_RADIUS*|w|)` over all bodies.
- When it stays below `SLEEP_SPEED = 0.01 m/s` for `SLEEP_TIME = 0.5 s` of simulated time, set every velocity to zero and mark the world asleep. While asleep, `step` returns at once (no integration, no contacts, no events).
- The world wakes, and the sleep timer restarts, on each of these:
  - a held die (pointer grab or drag through the `beforeStep` drive of #33). A grab must always move the die at once.
  - any body with a non-zero velocity (Roll, Space, fling),
  - `addBody`, `removeBody` and `setBox` (resize),
  - a gravity change of more than 0.5 m/s^2 from its value at sleep time.
- Find how `src/input/pointer.js` sets the drive. If the drive callback stays set when no die is held, the wake condition must be "a die is held", not "a callback exists", or the world never sleeps.

# Tests
- `src/physics/world.e2e.test.js`: 10 mixed dice (d4 to d20) dropped into the phone box (390x844 at DPR 3) under gravity tilted 15 degrees and, as a second case, 30 degrees. Within 3 s of simulated time every die has |v| < 0.005 m/s and |w| < 0.1 rad/s. Use fixed seeds.
- Same check on a level floor.
- Warm starting: a unit test that a matched contact starts with the old normal impulse and that an unmatched one starts at zero.
- Sleep: unit tests that the world sleeps after 0.5 s below the threshold, and that each wake condition above wakes it (held die, velocity, addBody, removeBody, setBox, gravity change above 0.5 m/s^2), and that a gravity change below 0.5 m/s^2 does not.
- All existing physics tests stay green.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
