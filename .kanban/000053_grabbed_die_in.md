---
name: "fix: grabbed die in free hang can rest with its centre of mass up to 9 mm to the side of the grab point"
priority: "medium"
state: "doing"
worktree: "fix/53-grabbed-die-in"
issuer: "#50"
complexity: "simple"
---

# Summary
When a grabbed die is held in the air with no contact (clearance > 0), the physics constraint can hold a tilted orientation in which the CoM rests 6-9.3 mm horizontally off the grab point instead of swinging directly below it. Intermittent: depends on the die's orientation at grab.

# Specs
# Evidence (live test #50, run 4, harness /tmp/dice-lt50)
- Held at (pointer, D - 2R), lowest vertex 24-33 mm above the floor, no contact: the d8 rested with its CoM 5.96 mm in xy from the pointer, and the d12 with 9.28 mm. The series stayed constant for 1.6 s (no swing).
- d4, d6, d10, d20 converged to 0.0-0.95 mm. Run 5 passed (d8 0.17 mm, d12 1.29 mm). The defect is intermittent and depends on the orientation at grab.

# Analysis
- With a point constraint at the grab point and no contact, gravity gives a torque about the grab point while the CoM is off the vertical. Swing damping opposes only motion, so it cannot hold a static offset. A constant tilted rest needs a second cause. Find it before you change code. Candidates:
  1. The world was asleep during the hold. Check that the run-4 build included #52 (no sleep while held). If it did not, reproduce on main. If main does not reproduce, close the task with that evidence and change no code.
  2. The point-constraint drive in `src/input/pointer.js` gives a torque about the grab point (for example a target velocity computed at the CoM, a gain on the grab-point offset that is not rotated by the body quat, or an angular term).
  3. A sleep or speed gate that zeroes a slow angular velocity.

# Change
- Fix the root cause found above with the smallest change. Do not add a righting torque and do not force any orientation (the #45 rule). Gravity alone must bring the CoM below the grab point.

# Tests (`src/input/pointer.test.js`, no contacts)
- For each die type, grab at 20 or more different surface points and initial orientations (fixed seed). Hold the pointer still for 3 s of simulated time. Then the CoM xy is within 1 mm of the grab point and |w| < 0.1 rad/s for every case.
- The #45 and #52 hold tests stay green.

# Acceptance criteria
- `npx vitest run src/input src/physics`
- `npm test`
- `npm run build`

# Notes
- State: root cause reproduced in a node fixture on main (HEAD 6a22be8, includes #52 594b85d). No code changed yet.
- Premise probe (`/tmp/live53.mjs`, box 63.5 mm cube as in live run 4): die dropped and settled asleep, max-lever face grab per harness `chooseGrab`, then held 3 s at 24.2 and 60 fps. Symptom reproduces: d8 worst 9.33 mm (5/20 cases), d10 9.53 mm (7/20), d12 9.07 mm (7/20), d20 10.02 mm (7/20), d6 8.17 mm (7/20), d4 clean. The rest offset is constant after the first ~200 ms and `|w|` is exactly 0.000, matching the run-4 series.
- Key measurement: every failing case starts from a grab taken while the world was **asleep** (`asleepAtPress` true) and a press on the far-vertex 65% point (lever 10.0-10.8 mm). A grab taken on a die already at hold height in free hang (probe `/tmp/hold53.mjs`, 120 seeded cases) and a grab lifted from an awake die both converge to 0.00 mm.
- Next action: instrument the drive/sleep path at the failing case to see which term provides the counter-torque (sleep-time zeroed velocity in the same step as the drive, or the `applyImpulse`/swing-damping pair), then write the red test and the smallest fix.
- Assumption: the acceptance sweep uses the harness grab convention (max-lever face point), the 63.5 mm box, and 3 s of hold.
- No blockers.
