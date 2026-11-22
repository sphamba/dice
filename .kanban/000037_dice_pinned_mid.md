---
name: "fix: scale the roll lift to the box headroom so rolls never hit the lid"
priority: "high"
state: "live-testing"
worktree: "fix/37-dice-pinned-mid"
issuer: "#33"
complexity: "simple"
changes: "{\"base\":\"main\",\"ins\":206,\"del\":18,\"files\":3}"
commits: "[{\"hash\":\"c53486d\",\"subject\":\"test(roll): cover the zero and negative headroom lift guard\",\"when\":\"2026-11-22T01:38:12+01:00\"},{\"hash\":\"bdfa647\",\"subject\":\"fix(roll): plan the toss rise from the box headroom\",\"when\":\"2026-11-22T01:34:07+01:00\"},{\"hash\":\"696fede\",\"subject\":\"fix(roll): scale the toss lift to the box depth\",\"when\":\"2026-11-21T21:34:22+01:00\"}]"
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
## Live test in progress (checkpoint write, ~70% done)

### Results so far (instrument calibrated on synthetic signals before use; all numbers measured live)
- Desktop rolls (1280x800, D=50 mm), 3 rolls via Roll button and Space key, 2 d6: 0 lid events and 0 glass voices in every roll; max vertex top 25.6-46.7 mm vs 50 mm box depth; apex rise 31-89% of headroom (mean ~55%, >= 50%); settle 0.2-0.3 s after launch (limit 3 s); dice rest at 8.00 mm (d6 face height) with 0.000 mm spread, so no die stays pinned mid-air.
- Phone rolls (393x852 dpr3, D=68 mm), 3 rolls: 0 lid events, 0 glass voices, rises 52-84%, settle <= 0.5 s, rest 8.00 mm stable.
- Visual toss: screenshot burst during a roll shows both dice clearly airborne with offset directional shadows (the shadow offset from the tilted light is the "pinned mid-air" illusion source; at rest the die body sits at 8.00 mm on the floor while its shadow looks raised).
- Tilt (synthetic devicemotion, gravity flipped to [0,0,+9.81]): 8 lid events, 4 glass voices actually played (speed 0.81 m/s, impulse 5.2e-3, audio context running) -> the glass sound is reachable. Dice rest against the lid at 42.0 mm; after resetting gravity they fall back to 8.24 mm on the floor.
- Fling (drag + fast release toward a wall): 86 wall events, wall speed up to 3.15 m/s, max vertex top 30.2 mm of 50 mm, no lid contact. Fling did not reach the lid, which the Specs allow ("may still hit").

### Instrumentation issues found and fixed during testing (my harness, not product defects)
- Playwright does not invoke newline-led function-shaped evaluate strings; one helper (voices clear) silently never ran, so voice logs accumulated across windows. The 4 "glass voices" seen in later windows were stale tilt-window entries; roll/phone sessions had 0 lid voices in every pull, so the glass-silence conclusion is unaffected.
- Settle metric originally anchored at window start and could latch onto pre-roll quiet samples; re-anchored at motion onset and re-verified against a synthetic signal with known apex/settle.
- Headless screenshots need explicit SwiftShader args (--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader); the default GPU path captures a blank canvas.

### Remaining
- Re-run grab+Space with corrected window analysis (held-die roll-exclusion check; first attempt had a windowing artifact, free-die apex was sliced wrong).
- Re-run desktop rolls to capture proper visual-toss screenshots.
- Write results table, file defects if any, kill server, verify port.
