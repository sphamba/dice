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
**Live test in progress: probe phase done (25/26), grab-targeting harness bug root-caused, fixing before the full driver.**

**Environment answers (front-loaded probe, /tmp/dice-lt45/results-probe.json):**
- rAF 30 fps under SwiftShader → sim runs at the 16-substep cap = ~1.0 sim-s per wall-s; sim-clock waits behave like wall waits.
- WebGL2 OK; viewport 1100x1100 exact: mpp 57.73 µm/px, box 63.5 mm cube, hold z 35.79 mm > 2R 27.71 mm → free hang fits in the tall viewport (D−4R = 8.07 mm clearance).
- Quat convention: my quatRotate == repo rotateVec3 AND vec3.transformQuat (max diff 0).
- Mouse grab HOLDS: state-based check (grabbed material point converges to pointer xy at hold z, err < 2 mm) — passes; pointerdown logged with pointerId 1, pt=mouse.
- Synthetic PointerEvent('pointercancel') releases the held die (falls, vz −0.33 m/s) and is observed by the capture logger → usable for the pointercancel contract check.
- Touch via CDP: two fingers → pointerdown ids 2,3 distinct; per-finger touchEnd releases only that pointer (ups [3,2] in order); pointermove fires only for fingers that actually moved (CDP semantic — probe expectation fixed).
- Console clean (no pageerror/error) throughout.

**Grab-miss investigation (probe's one FAIL: touch grab did not hold):**
- My in-page pick probe had a scratch-clobbering bug (worldVertex writes into the same array twice → edge vector zero → insideFace always true) → its verdicts discarded. The app's real insideFace uses separate scratch arrays and is correct.
- Node-side candidate analysis: chooseGrab's "65% toward highest vertex" candidates can land within micrometers of the face edge when a flat die is rotated in-plane (rotated-square footprint). Measured case: candidate 5 µm from the edge → app justifiably rejects boundary picks (FACE_EPS = 1e-9) → no hold. A second miss was 0.7-1 mm from the edge in a frame-dependent estimate (unresolved, same class).
- Classification: harness targeting bug (edge-fragile grab points), not a product defect. Fix: grab only high-margin points (top-face centroid: 8 mm margin, lever 8 mm — sufficient for pendulum visibility), re-sample the die pose immediately before every grab, never reuse a stale grab.

**Progress:** source inspection done; probe done (25/26, the one FAIL is the harness targeting bug above); no product defects found yet; no kanban cards filed yet. Next: add a margin filter to chooseGrab + re-run the probe (expect 26/26), then write the full driver: hang per die type, CoM-below-grab, swing after 20 mm move with calm ≤ 1.5 s, hold height D−2R, floor/other-die contact while held (1280x800 shallow viewport), fling + 3 m/s clamp (exact replica of flingVelocity from logged pointer samples), multi-pointer dominance + single-entry release, pointercancel, roll exclusion, NaN/containment guards.
