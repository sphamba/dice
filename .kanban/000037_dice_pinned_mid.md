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
## Live test in progress (checkpoint write)

### Scope accepted
Testing only the #37 change: headroom-derived roll lift (rise 60-75% of headroom, apex up to ~95%, never touching the lid on Roll/Space), plus the deferred items from the review verdict: glass-sound silence on a plain roll, glass sound reachable via grab/fling/tilt, visual toss height. No die stays pinned mid-air. Unit suites are excluded per instructions.

### Inspection done (one batched pass)
- `src/physics/roll.js`: headroom = ray-to-next-wall along up minus DIE_RADIUS; lift = sqrt(2*|g|*f*headroom); band 0.60-0.75; zero lift for zero/negative headroom or zero gravity. Consumed by `src/main.js` rollDice (Roll button and Space both reach it via `src/ui/panel.js`).
- Event path for the glass sound: collision surfaces include 'lid'; contacts -> events {a,b,surface,point,speed,impulse}; `sound.play` filters speed < 0.15, then playVoice -> GLASS plate modes for surface 'lid'. So glass sound on a plain roll is equivalent to a lid contact event with enough speed/impulse.
- Physics stepping: FIXED_DT 1/480, max 16 substeps per frame; at headless fps this is slow motion, so sim time must be counted from substeps, not wall time.
- Box: desktop 1280x800 dpr1 -> 80x50x50 mm; phone 393x852 dpr3 -> 68x147x68 mm. DIE_RADIUS = 0.0139. Lid contact threshold for a d6 centre: z > D - DIE_RADIUS.
- Pointer grab lifts a held die to holdHeight D - 2*radius (circumsphere grazes the lid); fling sets horizontal-only velocity (up to 3 m/s), lid reach only via corner bounces; tilt via devicemotion can flip gravity so dice fall onto the lid (most reliable glass-sound trigger).

### Environment prepared
- Playwright 1.59.1 at /home/phamba/repos/dotfiles/pi-agent/skills/web-browser/node_modules/playwright (browsers cached), harness dir /tmp/dice37-lt/.
- Vite dev server running detached on localhost:46137 (page, /src/main.js, /src/audio/sound.js all HTTP 200; served texts captured for exact-match spy rewrites).
- Instrumentation plan: two served-module rewrites (main.js exposes window.__dice = {world, sound}; sound.js logs every attempted voice with surface/played flag), test-side wrap of world.step for per-substep positions (apex z, max vertex z via quat rotate), event drain, console whitelist from a first probe run.

### Next steps
1. One front-loaded probe run: WebGL2, rAF fps, AudioContext state after a real click, console message texts, box dims and dice count in-page.
2. Desktop driver: settle, 2-3 plain rolls (button + Space): no lid contacts, no glass voices, apex rise >= ~0.5*headroom mean, settle <= 3 s sim, no pinned dice.
3. Phone-viewport roll (393x852 dpr3), then glass-sound reachability: tilt (devicemotion flip), fling at a wall, grab-hold.
4. File defects via kanban_create with issuer #37, rewrite Notes with the results table, kill server, verify port.
