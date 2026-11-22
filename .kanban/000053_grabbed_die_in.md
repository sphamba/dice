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
## PM hint
- `|w| = 0.000` exactly with a constant offset means the step does not integrate that body, not a counter-torque. Check first: after a press on a sleeping world, does `world.asleep` go false and stay false? Does `step()` return early, or zero velocities, in the step of the press or the steps that follow? Compare with the #52 wake path in `onRelease` and the held check in the sleep gate.
- Add the red test for "grab on an asleep world, far-vertex point, hold 3 s", then the smallest fix.

## State
- Reproduced on main 6a22be8 (includes #52). Fails for d6/d8/d10/d12/d20, up to 10 mm, only when the grab starts on an asleep world at a far-vertex point (lever 10-10.8 mm). |w| = 0.000 after about 200 ms.
- Grabs on an awake die or at hold height converge to 0.00 mm (120 cases).
- Probes: /tmp/live53.mjs, /tmp/hold53.mjs. No code changed yet.
