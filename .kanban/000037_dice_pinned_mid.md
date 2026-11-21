---
name: "fix: scale the roll lift to the box headroom so rolls never hit the lid"
priority: "high"
state: "doing"
worktree: "fix/37-dice-pinned-mid"
issuer: "#33"
complexity: "simple"
---

# Summary
The #32 roll lift (0.6-1.2 m/s) throws dice past the glass lid in a 50 mm box. Derive the lift from the box so each rolled die rises to 60-95% of its free headroom: high, but a roll never touches the lid. Dice were not really pinned: the offset shadow made a die on the floor look raised.

# Specs
# User decision
- Keep a high toss: each rolled die rises to a random 60-95% of its headroom. A roll alone never touches the glass lid. Grabs, flings and tilts may still hit the lid (the lid keeps its glass sound).
- The "pinned mid-air" report came from the offset directional shadow under the orthographic top view (a die on the floor looked raised). No die stays pinned. Do not add any wake or pin logic for it.

# Behavior
- Headroom of a die = distance from its current centre to the box boundary along the lift direction (opposite gravity), minus `DIE_RADIUS` (circumradius, so any orientation stays below the lid). With level gravity this is `D - DIE_RADIUS - z`.
- On Roll or Space, each free die gets a lift speed `sqrt(2 * |g| * f * headroom)` along the lift direction, with `f` uniform random in [0.60, 0.95] per die. If the headroom is zero or negative, the lift is zero.
- Keep the #32 horizontal speed (0.8-1.6 m/s) and spin (15-40 rad/s) ranges, the gravity-relative lift direction for tilted gravity, the replacement of free-die velocities, and the exclusion of held dice.
- Keep the roll tuning in one module (`src/physics/roll.js`) that both `src/main.js` and the tests use.

# Tests
- `src/physics/roll.test.js`: for a die at rest on the floor, in a desktop box (1280x800 viewport) and a phone box (390x844 at DPR 3), over at least 8 orientations and the worst-case horizontal speed and spin:
  - no lid contact during the roll and no vertex above the box depth,
  - the centre apex rises at least 0.5 x headroom (proves a high toss),
  - the die rests on the floor with near-zero linear and angular speed within 3 s.
- A unit check that the lift is zero for zero or negative headroom.

# Acceptance criteria
- `npx vitest run src/physics/roll.test.js`
- `npm test`
- `npm run build`

# Notes
# Notes
## PM steer
- The user wants a higher toss than 0.1-0.2 of D. Read the new Specs: lift from the headroom (centre to lid along the lift direction, minus DIE_RADIUS), with a random fraction 0.60-0.95 per die. A roll alone must never touch the lid.
- Change `src/physics/roll.js`, `src/main.js` and `src/physics/roll.test.js` to match. The test must also prove a high toss (apex at least 0.5 x headroom) on desktop and phone boxes.

## Earlier progress (fraction 0.1-0.2 of D, now replaced)
- Lift was `sqrt(2 g rise D)` with rise 0.1-0.2 of D in `src/physics/roll.js`. `rollDice` in `src/main.js` uses `rollVelocity`. Regression test `src/physics/roll.test.js` with 8 orientations. HEAD 696fede, `npm test` 254 passed, build green.
- Live headless check: before the fix the die centre reached z=0.0389, past the lid limit at 0.0361. Dice were never pinned: the offset shadow made a resting die look raised.
