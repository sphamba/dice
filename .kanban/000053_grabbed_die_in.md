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
- `|w| = 0.000` with a constant offset: the hint was that the step does not integrate the body. Wrong: the step does integrate and the wall contact solver pins it. Evidence below.

## State
- Root cause found: a **side-wall contact**, not sleep, not the drive, not the sleep gate. No code changed yet.
- Per-step trace of a failing case (d10, seed 1011): after the drive v = (-0.0146, 0.0007, 0.0188), w = (0.33, -2.75, 0.42); after gravity v_z = -0.0017; `detectContacts` reports 2 wall contacts (depth 8.4e-15 and 0); `solveContacts` returns v = 0, w = 0 exactly and the position does not move. A jammed lean, stable across steps.
- Geometry of the same case: the pointer at (-13.03, -17.35) mm, the CoM at (-22.39, -17.64) mm (offset 9.37 mm), and the die's min-x vertex at exactly -31.750 mm, the side wall. The free-hang clearance at that pointer is 7.6 mm, but swinging the CoM under the pointer pushes that vertex through the wall, so the die is geometrically jammed and cannot reach the free hang.
- Cause of the trigger: every failing case starts on an **asleep** die resting near a wall (lever 10.0-10.8 mm), which is then lifted up the wall and jams against it. All 31/120 failing cases in the 63.5 mm box are wall cases.
- Same sweep in a wide box (W = H = 0.2 m, same seeds, same 3 s hold, 24.2 and 60 fps): 0/120 fail, worst offset 0.00 mm. Grab at hold height in free hang: 0/120 fail. So the free-hang path on main is correct and needs no change.
- Repro (deterministic, per-case seeds): `/tmp/run53.mjs` (63.5 mm box, 31/120 fail), `/tmp/run53w.mjs` (wide box, 0/120), per-step diag `/tmp/diag53d.mjs`.

## Next action
- Write the card's regression test (`src/input/pointer.test.js`, no contacts, 20 seeded grab points and orientations per die type, 3 s hold, CoM xy < 1 mm, |w| < 0.1). It is green on main and locks the invariant.
- Then decide the wall case: it is physically correct (a real pendulum leaning on a wall while the pointer holds the grab point jams there), so no production change is in scope without forcing an orientation (#45 rule). Ask the PM in Open questions whether a held die leaning on a side wall is acceptable, or should be a separate task (for example wall friction for held bodies).
- No blockers.

# Open questions
- The 6-9 mm rests from live run 4 are a die jammed against a side wall while held (contact depth ~0, wall at 31.75 mm, spin exactly zero). That is physically correct for a point-constrained die that cannot swing under the pointer without its vertex crossing the wall. Is this behaviour acceptable, or do you want the held die to be kept clear of walls (a separate change, for example wall friction or hold-target clamping for held bodies)?
