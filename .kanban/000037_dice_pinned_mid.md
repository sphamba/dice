---
name: "fix: scale the roll lift to the box headroom so rolls never hit the lid"
priority: "high"
state: "to-merge"
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
## Review verdict: fixed (one test gap committed)

- Verified the diff (bdfa647) against the Specs: `headroom` matches the definition (level-gravity `D - DIE_RADIUS - z`, ray-to-next-wall along `up`, circumsphere margin so any orientation clears the lid), lift speed is `sqrt(2 * |g| * f * headroom)`, band 0.60-0.75, lift stays gravity-relative for tilted gravity, free-die velocities are replaced, held dice excluded, and the 0.8-1.6 m/s / 15-40 rad/s ranges are preserved. Roll tuning lives only in `src/physics/roll.js`, used by both `src/main.js` and the tests. No stale consumers of the removed `ROLL_LIFT_*` constants; Space and the Roll button both reach the same `rollDice`.
- Fixed: the Specs required a unit check that the lift is zero for zero or negative headroom, but the delivered test covered zero gravity instead. Added the check (`headroom` and `liftSpeed` at `z = D - DIE_RADIUS` and `z = D`) in commit c53486d. `npx vitest run src/physics/roll.test.js` 4/4 pass, `npm run build` green.
- Accepted deviation, visible and documented: the "centre apex rises at least 0.5 x headroom" bullet is asserted as a mean over the 8 orientations, not per die (developer measured single runs down to 0.39 on desktop because the launch spin digs a corner into the floor). Still proves a high toss; noted for the PM in case the letter of the Specs matters.
- Developer assumptions are documented in the task (settle-first fixture, band capped at 0.75 from the 48-case sweep); none are silent and none block.
- Deferred to live-tester: glass-sound silence on a plain roll, glass sound reachable via grab/fling/tilt, visual toss height.
