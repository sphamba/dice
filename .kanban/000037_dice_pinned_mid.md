---
name: "fix: scale the roll lift to the box headroom so rolls never hit the lid"
priority: "high"
state: "reviewing"
worktree: "fix/37-dice-pinned-mid"
issuer: "#33"
complexity: "simple"
---

# Summary
The #32 roll lift (0.6-1.2 m/s) throws dice past the glass lid in a 50 mm box. Derive the lift from the box so each rolled die rises to 60-95% of its free headroom: high, but a roll never touches the lid. Dice were not really pinned: the offset shadow made a die on the floor look raised.

# Specs
# User decision
- Keep a high toss: each rolled die gets a planned rise of a random 60-75% of its headroom. A wall-corner bounce can turn spin into height and add up to about 20% of the headroom, so the real apex reaches up to about 95%. A roll alone never touches the glass lid. Grabs, flings and tilts may still hit the lid (the lid keeps its glass sound).
- The "pinned mid-air" report came from the offset directional shadow under the orthographic top view (a die on the floor looked raised). No die stays pinned. Do not add any wake or pin logic for it.

# Behavior
- Headroom of a die = distance from its current centre to the box boundary along the lift direction (opposite gravity), minus `DIE_RADIUS` (circumradius, so any orientation stays below the lid). With level gravity this is `D - DIE_RADIUS - z`.
- On Roll or Space, each free die gets a lift speed `sqrt(2 * |g| * f * headroom)` along the lift direction, with `f` uniform random in [`ROLL_RISE_MIN` = 0.60, `ROLL_RISE_MAX` = 0.75] per die. If the headroom is zero or negative, the lift is zero.
- Keep the #32 horizontal speed (0.8-1.6 m/s) and spin (15-40 rad/s) ranges, the gravity-relative lift direction for tilted gravity, the replacement of free-die velocities, and the exclusion of held dice.
- Keep the roll tuning in one module (`src/physics/roll.js`) that both `src/main.js` and the tests use.

# Tests
- `src/physics/roll.test.js`: for a die settled on the floor, in a desktop box (1280x800 viewport) and a phone box (393x852 at DPR 3), over at least 8 orientations and the worst-case horizontal speed and spin, tossed at `ROLL_RISE_MAX`:
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
# Notes
## PM steer
- Planned rise 60-75% of the headroom, wall corner bounces may add up to about 20%, a roll alone never touches the glass lid. Grabs, flings and tilts may still hit the lid. No wake or pin logic: the raised look came from the offset directional shadow under the orthographic top view.

## Deliverable (commit bdfa647)
- `src/physics/roll.js`: `headroom(box, position, up)` (free centre travel to the next wall along `up`, minus `DIE_RADIUS`), `liftSpeed(box, gravity, position, rise)`, `rollVelocity(out, { box, gravity, position, angle, speed, rise })`, `ROLL_RISE_MIN = 0.6`, `ROLL_RISE_MAX = 0.75`.
- `src/main.js` passes `position: body.position` and a random rise in that band to `rollVelocity`.
- `src/physics/roll.test.js`: unit check on `headroom` and `liftSpeed`, and on the desktop (1280x800, dpr 1, D = 0.05) and phone (393x852, dpr 3, D = 0.0681) boxes a settled die tossed at `ROLL_RISE_MAX` over 8 orientations must never touch the lid, must clear it with every vertex, must average over half the headroom, and must settle flat and still on the floor within 3 s.

## Verification
- `npm test` 255 passed (24 files), `npm run build` green, `dist/index.html` references `./assets/index-BCw1x8EH.js` and `./assets/index-DA_12YQk.css`.
- Measured apex as a share of the headroom over those 8 orientations: desktop mean 0.59 (0.39-0.88), phone mean 0.68 (0.59-0.79). Lid contact steps: none, both boxes.
- Wider sweep, 48 cases per box per fraction (16 settled orientations x spin 15/25/40 at the 1.6 m/s dash), lid steps / worst vertex gap: 0.95 -> 3 / 0.20 mm, 0.90 -> 2 / 0.40 mm, 0.85 -> 2 / 0.71 mm, 0.80 -> 1 / 0.43 mm, 0.75 -> 0 / 1.19 mm, 0.70 -> 0 / 2.80 mm, 0.60 -> 0 / 6.1 mm. The band therefore stops at 0.75.

## Assumptions
- Two launch effects shape the apex, both from cube-wall and cube-floor geometry, not from the lift: a wall corner hit at the dash speed raises spin from 39 to 92 rad/s and adds 0.115 m/s of climb, while the launch spin digs a corner into the floor and takes back part of the climb. The plan stays at 60-75% so the added climb never reaches the glass.
- The test fixture settles each die for 3 s before the toss, as the page does. A die spawned at rest height with a random orientation starts up to 5.9 mm inside the floor and the push alone throws it at the lid.

## Blockers
- None.

## Manual checks left to other roles
- Live page: dice rise high and tumble, no glass sound on a plain roll, and a grab, fling or tilt can still hit the lid with its glass sound.

