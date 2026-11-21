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
# Notes
## PM steer
- Higher toss per the new Specs: lift from the headroom (centre to lid along the lift direction, minus DIE_RADIUS), random fraction 0.60-0.95 per die, roll alone never touches the lid.
- Settling the die before the toss in the test is correct. Do not change the 0.60-0.95 range yourself. If 0.95 still touches the lid after the die settles, keep 0.95, write the largest fraction that clears in Notes, and add an Open question for the user.

## Current state (in progress, not committed)
- `src/physics/roll.js` now exports `headroom(box, position, up)`, `liftSpeed(box, gravity, position, rise)` and `rollVelocity(out, { box, gravity, position, angle, speed, rise })` with `ROLL_RISE_MIN = 0.6`, `ROLL_RISE_MAX = 0.95`. Headroom is the ray-box exit distance from the die centre along the lift direction, using per-axis limits x in [-W/2, W/2], y in [-H/2, H/2], z in [0, D], minus DIE_RADIUS.
- `src/main.js` passes `position: body.position` to `rollVelocity`.
- `src/physics/roll.test.js` parametrised over the desktop (1280x800, dpr 1, D=0.05) and phone (393x852, dpr 3, D=0.0681) boxes: unit check on the headroom and lift, plus the toss must rise over half the headroom, never touch the lid, and settle on the floor within 3 s.
- Unit test and the apex and settle assertions pass. The lid-contact assertion still fails on a few orientations.

## Open cause (evidence of record)
- The test fixture spawns the die at z = DIE_RADIUS with a random orientation, so corners start up to 5.9 mm inside the floor. The Baumgarte push and restitution then kick the die upward by itself, and a lid contact appears at every rise fraction from 0.80 to 0.95 (sweep of 48 configs per box), with a worst vertex gap of 0.2 mm.

## Next step
- Settle the die before the toss in the test and re-run.

## Earlier committed work
- HEAD 696fede: the previous 0.1-0.2 of D lift, `npm test` 254 passed, build green.
- Live headless check: dice are never pinned. The old lid slam reached z = 0.0389 past the lift limit at 0.0361; the offset shadow under the orthographic top view made a resting die look raised.

## Blockers
- None.
