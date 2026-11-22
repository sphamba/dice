---
name: "fix: grabbed die in free hang can rest with CoM ~9 mm sideways of the grab point"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "#50"
complexity: "simple"
---

# Summary
When a grabbed die is held in the air with no contact (clearance > 0), the physics constraint can hold a tilted orientation in which the CoM rests 6-9.3 mm horizontally off the grab point instead of swinging directly below it. Intermittent: depends on the die's orientation at grab.

# Specs
Evidence (live-test #50, run4, harness /tmp/dice-lt50): while held at (pointer, D-2R) with lowest vertex 24-33 mm clear of the floor, the d8 rested with CoM xy 5.96 mm from the pointer (sample series stable: 5.6, 6.0, 6.0, 6.0, ... over 1.6 s, not swinging) and the d12 with 9.28 mm (9.2, 9.3, 9.3, ...). A free-hanging rigid body pinned at one surface point must put its CoM directly below the pin (pendulum rest). Same run, d4/d6/d10/d20 converged to 0.0-0.95 mm. Rerun (run5) passed 83/83 with d8 at 0.17 mm and d12 at 1.29 mm, so the defect is orientation-dependent and intermittent.

Root cause direction: the pointer constraint in src/physics/body.js (constraint creation around the grab/lift path, see src/input/pointer.js hold logic) does not resolve the rotation DOF of the held body to the pendulum rest; the solver keeps the tilted quasi-equilibrium it was in when the swing damped. Fix direction: add rotational righting torque while held (proportional to the horizontal offset between the grabbed point's vertical axis and the CoM), or pin the grab point to a point directly above the CoM once the body is slow, letting the orientation settle.

Reproduction: grab any die during its initial damped swing, hold 2 s, read body p vs pointer xy via the state sample; a stable xy offset near the circumradius with clearance > 0 is the defect.

# Notes
