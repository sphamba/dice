---
name: "fix: dice pinned mid-air after Roll, never settle"
priority: "high"
state: "backlog"
worktree: ""
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
