---
name: "fix: double roll translation speed and lift without increasing spin"
priority: "high"
state: "to-review"
worktree: "fix/32-stronger-roll-translation"
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
## Deliverable
- `src/main.js`: `ROLL_SPEED_MIN/MAX` 0.4-0.8 → 0.8-1.6 m/s, `ROLL_LIFT_MIN/MAX` 0.3-0.6 → 0.6-1.2 m/s. `ROLL_SPIN_MIN/MAX` stays 15-40 rad/s.
- `rollDice` body unchanged: same random XY direction, lift along negative normalized gravity, held dice skipped. Commit 10e3511.

## Verification
- `npm test`: 23 files, 228 tests passed.
- `npm run build`: green; `dist/index.html` references `./assets/index-COenA9U1.js` and `./assets/index-DasNQWd4.css`.
- No new test added: `main.js` has top-level DOM/WebGL setup and the Vitest environment is `node`, so a regression test would need a `main.js` restructure.

## Assumptions
- The roll translation contract (linear velocity magnitude = speed, lift opposite gravity) was already correct, so only the four range constants changed.
- Stronger throws stay contained through the existing box collision and damping; no other parameter touched.

## Blockers
- None.

## Manual checks left to other roles
- Live test up to ten mixed dice on phone and desktop: stronger throws, contained, settle without tunneling or console errors, held dice do not move.
