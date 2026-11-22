---
name: "feat: let a held die hang from the grabbed point under gravity"
priority: "medium"
state: "live-testing"
worktree: "feat/45-held-die-hangs-from-point"
issuer: "user"
complexity: "moderate"
shortName: "held-die-hangs-from-point"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":171,\"del\":100,\"files\":2}"
commits: "[{\"hash\":\"b1d53ed\",\"subject\":\"feat(input): hang a held die from the grabbed point under gravity\",\"when\":\"2026-11-22T11:52:33+01:00\"}]"
---

# Summary
Drive only the grabbed material point toward the pointer, so gravity swings the die below that point like a pendulum. Damp the swing so it calms in about 1 s, and keep the fling, release and multi-pointer contracts.

# Specs
# User-visible behavior
- When you grab a die, the grabbed point on its surface follows the finger. Gravity acts on the rest of the die, so it turns until its centre of mass hangs below the grabbed point, like a pendulum. Moving the finger makes the die swing.
- When the finger stops, the swing calms in about 1 s: at least one visible swing, then the die hangs still (|w| < 0.1 rad/s within about 1.5 s).
- The grabbed point is held at the current hold height, `D - 2*DIE_RADIUS` above the floor. The user accepts that a hanging die can touch the floor and other dice in a shallow box. Contacts with the floor, walls, lid and other dice stay active while held.

# Facts (main at the time of filing, `src/input/pointer.js`)
- The drive runs in `world.beforeStep` (`:207`). It keeps the body-local grab offset from the pick (`:114-120`).
- It sets the centre-of-mass velocity directly (`vec3.copy(body.linearVelocity, target)`, `:154`), with a gain `(1 - exp(-120 dt))/dt` (`HOLD_DAMPING = 120`), an xy speed clamp `MAX_DRAG_SPEED = 2` m/s, an ω×r compensation, and a z target of the centre at `D - 2R`.
- It damps spin with `HOLD_ANGULAR_DAMPING = 8` 1/s. Overwriting the centre velocity cancels the gravity torque about the grab point, so the die cannot hang.
- Gravity already acts on held dice (`integrateVelocities` in `world.step` has no held-body skip). The world (#42) wakes on a held die because the drive runs while asleep.

# Change
- Replace the centre-velocity overwrite with a point constraint at the grabbed point: compute the target velocity of the grab point, `(target - p) * gain` (xy clamped to `MAX_DRAG_SPEED`, z toward `D - 2*DIE_RADIUS`), and apply the impulse at that point that gives it this velocity, `J = K^-1 (vTarget - vPoint)` with `K = (1/m) I - [r]x invInertiaWorld [r]x`. The body then rotates freely about the grabbed point, and gravity makes it hang.
- Replace the strong spin damping with a light frame-rate-independent swing damping, tuned so the swing calms in about 1 s (start near 3 1/s, tune with the test). Do not force any orientation.
- Keep the release and fling contract: pointer velocity gives the centre xy velocity, vz = 0, residual spin stays, and the existing speed-based random fling spin is added. Keep the 3 m/s release clamp and pointercancel behavior.
- Keep the multi-pointer contract (#18): duplicate holds allowed, every entry drives in insertion order (the last entry dominates), releasing one pointer removes only its entry.
- Keep exact face picking (#33) and the roll exclusion of held dice.

# Tests (`src/input/pointer.test.js`, no collisions unless stated)
- Hanging: grab a d6 at a top-face corner and hold the pointer still. Within 1.5 s of simulated time the centre of mass is directly below the grabbed point (horizontal offset < 1 mm), the grabbed point stays within 1 mm of the target (xy and z), and |w| < 0.1 rad/s. Repeat for every die type.
- Swing: after a sudden pointer move of 20 mm, the die swings (the angle between the grab-to-centre vector and gravity passes its rest value at least once) and calms within 1.5 s.
- Frame rate: the result at 30, 60 and 144 fps agrees within the tolerances above.
- Release and fling, pointercancel, roll exclusion and the multi-pointer tests stay green. Remove or rewrite tests that assume the centre is driven or that held spin decays at the old rate.

# Acceptance criteria
- `npx vitest run src/input src/physics`
- `npm test`
- `npm run build`

# Notes
## PM hint
- The world can also fall asleep WHILE a die is held still (the drive output is near zero after the swing calms). A sleeping world freezes the pendulum at its current angle. Before you blame a wall lean for the d10/d20 angles (23.7/12.3 deg), log `asleep` during the hold. If the world was asleep, add this case to the same defect card: the world must never sleep while any die is held, and a release must wake it.
- After the final re-run, file the one card and finish. Do not add new scenarios.

**Run 3: 69/74 PASS** (/tmp/dice-lt45/driver-run3.log, results-driver2.json). Multi-pointer 7/7 including single-entry release. Shallow box 12/12 (hanging die touches the floor while held, grab point stays at hold height while leaning, held die follows moves, held die contacts the other die with no penetration). Pointercancel 2/2. Console clean in both viewports. d4 pendulum: CoM 0.03 mm under the grab point, one 58.8 deg swing, calm at 0.83 s.

**Confirmed product defect (source-verified): releasing a calm-held die can leave it frozen in mid-air.**
- The world sleeps after 0.5 s of stillness (SLEEP_TIME 0.5 s, SLEEP_SPEED 0.01, world.js:18-20). step() returns early while asleep unless a body has a nonzero velocity (world.js:141-149, moving() at world.js:30). onRelease (src/input/pointer.js:240-256) writes the velocities with no wake call. A calm release sets v=0 and randomSpin(0)=0, so the die stays at the hold height.
- Evidence: d8 release poll showed vz 0.000 m/s for 0.8 s after mouse.up (run 3). User scenario: grab a die, hold it still about 1 s, let go: it floats.
- Fix direction: no sleep while any die is held, and wake the world on release.

**Harness issues (not product defects), being patched:**
- Fling stimulus: moves must be well inside the 80 ms FLING_WINDOW_MS, with a violent sweep for a raw velocity above 3 m/s.
- Swing check: with HOLD_SWING_DAMPING 12 the second excursion is about 1.3 deg, so use "one visible excursion (out >= 5 deg, back within 1.5 mm)".
- d10/d20 CoM angle: see PM hint.
