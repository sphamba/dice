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
**Live test in progress: full driver run 1 — d4 phase 6/6 PASS; d6 grab failure + run crash root-caused as harness panel-occlusion bug; patching and re-running.**

**Run 1 evidence (/tmp/dice-lt45/driver-run1.log, results-driver-error.json):**
- d4 hang phase 6/6 PASS: grab holds (err 0.62 mm at +100 ms, lever 9.7 mm); CoM hangs below grab (xy 0.03 mm, rest theta 0.15 deg); one visible swing (maxDev 58.8 deg, 1 crossing); calm |w|<0.1 rad/s at 0.83 s (spec ~1.5 s); release drops (vz −0.026); settles contained and finite. The pendulum behavior itself matches the spec.
- d6 grab FAIL: err 19.79 mm = hold z 35.79 − top face 16 exactly → the die never moved. Immediately after, the d8 phase crashed: `Remove d6` click timed out with "element is not visible" — the panel had collapsed.

**Root cause (batch audit of all three same-signature grab failures: probe touch id 21, debug-pick mouse, this d6):** the grab screen point can land on the bottom-center panel (toggle/rows) when the die rests there. mouse.down then presses the PANEL, not the canvas: the canvas logger shows no pointerdown → the app's pick never runs → the die never moves (err exactly holdZ − face z). The stray press also toggles the panel collapsed, which killed the next phase's Remove-click. Classification: harness bug (missing occlusion guard), not a product defect. The one non-occlusion failure (debug-touch, candidate 5 µm from the face edge) predates the margin filter and is a boundary coin flip the app rightly rejects.

**Fix (in progress):** grabAndHold gains (1) elementFromPoint === 'view' check before every down, (2) canvas-pointerdown verification after a no-converge (respawn if the canvas saw nothing or the die never moved), (3) mouse-up + re-spawn retry (3 attempts, re-randomizes the rest position); clickStep self-heals a collapsed panel; the swing/fling/cancel/shallow/multi regrabs get the same guard. Then a full re-run of the driver.

**Progress:** probe 26/26; run 1: 7/8 checks passed before the crash, d4 pendulum fully validated; no product defects found so far; no kanban cards filed. Next: patch, full re-run, results table + wrap-up (defect cards if any, kill servers, unique result ids).
