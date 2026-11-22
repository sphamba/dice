---
name: "feat: let a held die hang from the grabbed point under gravity"
priority: "medium"
state: "reviewing"
worktree: "feat/45-held-die-hangs-from-point"
issuer: "user"
complexity: "moderate"
shortName: "held-die-hangs-from-point"
splitter: "done"
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
## Deliverable
- `src/input/pointer.js`: the hold now drives only the grabbed material point, with the impulse `J = K^-1 (vTarget - vPoint)`, `K = (1/m) I - [r]x invInertiaWorld [r]x`, applied at that point. Gravity turns the rest of the die about it, so the centre hangs below the grabbed point.
- Grab-point target: pointer x/y (xy speed clamped to `MAX_DRAG_SPEED`) and z = `D - 2*body.radius`. The old centre-velocity overwrite and the `HOLD_ANGULAR_DAMPING` spin damping are gone.
- Swing damping: `HOLD_SWING_DAMPING = 12` 1/s, applied after the constraint solve, with a centre-velocity correction `(1 - decay) * w x r` so the point stays in place. Measured: |w| 0.13 rad/s at 0.85 s, 0.035 rad/s at 1.0 s for the worst die type (d4, vertex grab).
- Release, fling (3 m/s clamp, z = 0, residual spin, speed-based random spin), pointercancel, multi-pointer insertion order and exact face picking unchanged.
- `src/input/pointer.test.js` rewritten: hanging for every die type, swing plus settle, spun-die settle, 30/60/144 fps, pointer-jump tracking within the clamp. Tests that assumed a driven centre, or the old spin decay rate, are replaced.

## Verification
- HEAD b1d53ed. `npx vitest run src/input src/physics`: 128 passed. `npm test`: 300 passed. `npm run build`: green, asset check `src="./assets/index-BPDaA_rG.js"`, `href="./assets/index-DA_12YQk.css"`.

## Assumptions
- The hold height `D - 2*DIE_RADIUS` is read as the height of the grabbed point, not of the centre of mass.
- Swing damping tuned to 12 1/s: 3 and 8 1/s left |w| above 0.1 rad/s past 1.5 s on a vertex grab.
- Two holds on one die damp the swing once per held entry.

## Blockers
- None.

## Manual checks left to other roles
- Real-browser feel of the hang and the fling at 60 Hz, including a hanging die that touches the floor or another die in a shallow box.
