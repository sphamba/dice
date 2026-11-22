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
## Live test in progress: setup phase complete

**Scope (from Summary/Specs):** hang a held die from the grabbed point under gravity (pendulum), swing calms in ~1 s, hold height D-2R, contacts active while held, fling/release/pointercancel/multi-pointer contracts kept. Unit-test suites and frame-rate matrix are excluded (not live-test scope).

**Constants table (printed from source, file:line, value, unit, consumer):**
- DIE_RADIUS = 0.016·√3/2 = 13.856 mm (src/physics/body.js:7) — every die's circumradius; hold height, lever bound.
- mpp = dpr·0.0254/440 = 57.73 µm/px → 17.32 px/mm at dpr 1 (src/physics/box.js:1); box D = min(W,H) (box.js:14).
- Hold z = D − 2·DIE_RADIUS (src/input/pointer.js drive, target[2]; z unclamped, xy clamped MAX_DRAG_SPEED = 2 m/s).
- HOLD_DAMPING = 120 1/s (pointer.js:20), HOLD_SWING_DAMPING = 12 1/s (pointer.js:24), MAX_FLING_SPEED = 3 m/s (:13), MAX_FLING_SPIN = 60 rad/s (:15), FLING_WINDOW_MS = 80 ms (:17).
- FIXED_DT = 1/480 (world.js:8), MAX_STEPS = 16 (:11), SLEEP_SPEED/SLEEP_TIME = 0.01/0.5 s (:14-15).
- world.step calls beforeStep (the drive) before the asleep check (world.js:139-144) → held die wakes a sleeping world; sim-clock wrapper advances even while asleep.
- DEFAULT_SET = {d6: 2} (ui/panel.js:5); ROLL_SPEED_MIN = 0.8 m/s (roll.js:4) for the roll-exclusion check; gravity [0,0,−9.81], no tilt in scope.

**Observation plan (committed):**
- Two viewports: 1100×1100 (box D = 63.5 mm, hold z = 35.8 mm > 27.7 mm full hang reach) for the strict pendulum checks with no floor interference; 1280×800 default desktop (box D = 46.2 mm, hold z = 18.5 mm < 27.7 mm) for the deferred shallow-box case: held die resting on the floor / touching another die.
- Sim clock + per-substep trace via a wrapped world.beforeStep (decimated rows: t, p, v, w of the held body), armed before each trigger.
- Grab validation: Node-side replica of pointer.js pickFace (topmost face through the click xy, boundary-inclusive insideFace) computes the expected body-local grab offset from the pre-grab sample; after settle, that material point's world position must be within 1 mm of (pointer xy, D−2R). CoM-below-grab via |p.xy − target| < 1 mm. Calm: last trace t with |w| ≥ 0.1 rad/s ≤ trigger + 1.5 s.
- Injections: CDP mouse, CDP touch (two fingers for #18 duplicate holds), synthetic PointerEvent('pointercancel') with pointerId observed from a capture-phase event logger; pointer-sample times from the logger give an exact flingVelocity replica for release checks.
- Preconditions from precedent harnesses (/tmp/dice-lt43): vite on an uncommon port, spy on createWorld via served-main.js route rewrite, panel rows revealed via .panel-toggle, software-GL launch args, waits keyed on sim time.

**Assumptions so far (will be restated in the final report):**
- The default 1280×800 box is "shallow": a near-vertex grab at hold height 18.5 mm cannot reach the full vertical hang (needs 27.7 mm), so a floor-propped lean there is user-accepted; strict pendulum numbers are verified in the tall viewport.
- Grabbing at a validated near-top-vertex surface point (max-lever valid pick) stands in for the unit tests' "top-face corner" grab.
- Pointer injection via CDP/synthetic events represents real user input.

**Progress:** source inspection and harness design done; no defects found yet; no kanban cards filed yet. Next: write shared harness + front-loaded probe (env unknowns: rAF fps under software GL, WebGL2, touch/synthetic event injection, helper shapes), smoke run, then the full check suite (hang per die type, swing after 20 mm move, wake-from-sleep, hold height, floor/other-die contact while held, fling + 3 m/s clamp, pointercancel, multi-pointer dominance and single-entry release, roll exclusion).
