---
name: "fix: double roll translation speed and lift without increasing spin"
priority: "high"
state: "to-do"
worktree: ""
issuer: "#8"
complexity: "simple"
shortName: "stronger-roll-translation"
---

# Summary
Double Roll/Space horizontal speed to 0.8-1.6 m/s and lift to 0.6-1.2 m/s. Keep spin at 15-40 rad/s, replace free-die velocities as before, and leave held dice unchanged.

# Specs
# Required tuning
In `src/main.js`, change only the roll translation ranges:
- `ROLL_SPEED_MIN/MAX`: 0.8-1.6 m/s (currently 0.4-0.8).
- `ROLL_LIFT_MIN/MAX`: 0.6-1.2 m/s (currently 0.3-0.6).
- Keep `ROLL_SPIN_MIN/MAX` at 15-40 rad/s.

# Preserved behavior
- Roll button and Space continue through the same `rollDice` path, including while controls are collapsed.
- For each free die, replace its previous linear/angular velocities with a random XY direction in the approved speed range, lift opposite normalized gravity in the approved lift range, and spin in the unchanged range.
- Keep held dice completely unchanged during rolls. Do not change drag/fling, contact, damping or audio parameters in this task.
- Zero dice remains a no-op. No main-loop or module-structure rewrite is needed.

# Verification
- Use controlled randomness or an instrumented browser check to confirm every free die's horizontal speed and opposite-gravity lift are inside the new ranges and angular speed remains inside 15-40 rad/s for both input routes.
- Live-test up to ten mixed dice on phone and desktop sizes: throws are visibly stronger, stay contained, settle without tunneling or console errors, and held dice do not move.
- Add a focused regression check if it can be done without exporting test-only production helpers or making `main.js` DOM/WebGL setup test-hostile.

# Acceptance commands
- `npm test`
- `npm run build`

# Notes
