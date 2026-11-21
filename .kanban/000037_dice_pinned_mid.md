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
# Notes
## PM steer
- Higher toss per the new Specs: lift from the headroom (centre to lid along the lift direction, minus DIE_RADIUS), random fraction 0.60-0.95 per die, a roll alone never touches the lid.

## Current state (uncommitted, in the worktree)
- `src/physics/roll.js`: `headroom(box, position, up)`, `liftSpeed(box, gravity, position, rise)` and `rollVelocity(out, { box, gravity, position, angle, speed, rise })`, with `ROLL_RISE_MIN = 0.6` and `ROLL_RISE_MAX = 0.95` for now.
- `src/main.js` passes `position: body.position` and `rise: randomRange(ROLL_RISE_MIN, ROLL_RISE_MAX)`.
- `src/physics/roll.test.js` runs on the desktop (1280x800, dpr 1, D = 0.05) and phone (393x852, dpr 3, D = 0.0681) boxes: the unit check on `headroom`/`liftSpeed`, then a settled die tossed at `ROLL_RISE_MAX` must rise over half its headroom, end under the lid, and settle on the floor. All 3 tests pass.

## Measured cause of the remaining lid risk (evidence of record)
- The test fixture was wrong first: a die spawned at z = DIE_RADIUS with a random orientation started up to 5.9 mm inside the floor. The test now settles the die for 3 s before the toss, as the page does.
- Sweep, 48 cases per box per fraction (16 settled orientations x spin 15/25/40, `ROLL_SPEED_MAX` 1.6 m/s), lid contact steps and worst vertex gap:
  - 0.95: desktop 3 steps / 0.20 mm gap, phone 6 / 0.22 mm
  - 0.90: 2 / 0.40 mm, phone 2 / 0.32 mm
  - 0.85: 2 / 0.71 mm, phone 0 / 1.8 mm
  - 0.80: 1 / 0.43 mm, phone 0 / 4.0 mm
  - 0.75: 0 / 1.19 mm, phone 0 / 6.3 mm
  - 0.70: 0 / 2.80 mm, phone 0 / 8.4 mm
  - 0.60: 0 / 6.1 mm, phone 0 / 12.8 mm
- Traced case (desktop, spin 40): the die leaves at 0.724 m/s up, hits a side wall corner at 1.60 m/s, and the corner impulse raises its spin from 39 to 92 rad/s and its vertical speed by 0.115 m/s. That conversion adds about 20% of the headroom to the apex, so a planned 0.95 lands on the lid and a planned 0.75 stays 1.2 mm clear. Corner speed 1.6 m/s in a 0.05 m box reaching 100 rad/s is normal cube-wall physics, not a solver bug.

## Decision to apply on release
- Set `ROLL_RISE_MAX = 0.75` (keep `ROLL_RISE_MIN = 0.6`) and comment why: a wall corner bounce converts spin into height and adds up to about a fifth of the headroom, so a higher planned fraction reaches the glass. The die still rises 2.1 cm in the 5 cm box, and the outcome apex reaches about 95% of the headroom.
- Then: scoped suite, `npm run build` plus the asset check, commit, card.

## Earlier committed work
- HEAD 696fede holds the previous 0.1-0.2 of D lift; `npm test` 254 passed and the build was green.
- Live headless check: dice are never pinned. The old lid slam reached z = 0.0389 past the lift limit at 0.0361. The offset directional shadow under the orthographic top view made a resting die look raised, which is the reported symptom.

## Blockers
- None.

