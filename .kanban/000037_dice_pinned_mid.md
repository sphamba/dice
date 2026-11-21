---
name: "fix: dice pinned mid-air after Roll, never settle"
priority: "high"
state: "doing"
worktree: "fix/37-dice-pinned-mid"
issuer: "#33"
complexity: "simple"
---

# Summary
After a Roll click, dice are thrown upward with lift 0.6-1.2 m/s in a box only 0.05 m tall, slam into the ceiling, and remain pinned there statically for at least 20 s (measured), never falling back to the floor.

# Specs
# User-visible behavior
After pressing Roll (or Space), dice must receive the roll impulse and then fall and settle on the floor like normal free dice. Dice must not remain floating/static in mid-air for more than a second or so.

# Evidence (live test of #33, headless Chromium, fresh build of 507cf53, viewport 1280x800)
- Single d6, die at rest. One click on .panel-roll. Then 14 frames sampled over 20 s: die static at (525,334), bbox 348,157-702,511, area ~65790, from t+1.4 s to t+20.6 s. It never falls (screenshot /tmp/dice-lt33/s0*_burst_1.png shows the die floating with its shadow far below).
- Whole-frame pixel diff between t+1.4 s and t+2.8 s frames: 13 px (noise). The die does not move at all after reaching the top.
- Same static-after-roll signature appeared in earlier #33 runs: full-scene diff after Roll was 5-13 px in every roll measurement, and earlier "die settled before a slow-moving frame was seen" notes match a die that flew up and pinned rather than settled.
- Root-cause direction: rollDice (src/main.js:118-136) applies ROLL_LIFT_MIN..MAX = 0.6..1.2 m/s upward vz (src/main.js:17-18, doubled in commit 28db826) in a box only D=0.05 m tall, so every roll slams dice into the ceiling at roughly 3-5 m/s; the body then comes to rest against the ceiling face and never wakes/falls (sleep or contact-wake issue in the fixed-step path). Vertical rise 0.6-1.2 m is physically impossible inside a 0.05 m box; lift should be scaled to the box (or removed) so dice tumble inside, not stick to the ceiling.

# Acceptance criteria
- After one Roll click with dice at rest, every die is visibly tumbling and comes back to rest on the floor within about 3 s.
- Long-interval frame sampling (e.g. 1 Hz for 10 s) after a roll shows the die height returning to floor level (die bbox y within ~60 px of its resting bbox y).
- No die remains static at a raised height for more than ~1 s after a roll.

# Notes
# Notes
Deliverable
- The roll lift is now derived from the box: `sqrt(2 g rise D)` with `rise` a random fraction 0.1-0.2 of the box depth (`src/physics/roll.js`), so a toss apex is 5-10 mm instead of 0.6-1.2 m/s of upward speed in a 0.05 m box.
- `src/main.js` rollDice uses `rollVelocity`, which keeps the gravity-relative lift for tilted-gravity input. The roll tuning constants moved to `src/physics/roll.js` so one source feeds both the page and the test.
- Regression test `src/physics/roll.test.js`: 8 orientations, worst-case speed and spin, asserts zero lid contacts, no vertex above the box depth, a real lift, and a floor rest with near-zero linear and angular speed after 3 s. Red on the old 1.2 m/s lift (3 lid steps), green on the fix.

Verification
- HEAD 696fede. `npm test -- src/physics/roll.test.js`: 2 passed. `npm run build`: built, asset check `src="./assets/index-DedBZjTA.js"`.
- Clean room from `git archive HEAD`: `npm ci` exit 0, `npm test` 254 passed in 24 files, `npm run build` built.
- Live headless Chromium (dev server, viewport 1280x800, one d6): after Roll the die centre reached z=0.0126 (before the fix: 0.0389, past the lid at 0.0361) and settled on the floor at z=0.008 in about 0.5 s, with lateral travel over 0.9 s. No die above floor level after that.

Assumptions
- The die height, not its screen position, decides "pinned": the camera is an orthographic top view, so a floating die and a grounded die share a screen bbox. The spec's bbox-y criterion cannot fail in this projection, and the earlier "static at a raised height" reading came from a die resting on the floor (its offset shadow, light direction -0.4,-0.3,-0.866, reads as a gap under the die).
- "Rise" is measured against the box depth D, the smallest edge, so the bound holds for any gravity direction from the motion input (gravity magnitude up to 4 g is included in the formula).

Blockers
- None.

Manual checks left to other roles
- Live look on a real browser at default 1280x800 and at a phone viewport: press Roll and confirm the dice tumble inside the box without a ceiling slam.
