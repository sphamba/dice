---
name: "feat: pointer drag and fling of dice"
priority: "high"
state: "merging"
worktree: "feat/13-motion-pointer-input-drag"
issuer: "#7"
complexity: "simple"
shortName: "motion-pointer-input-drag"
---

# Summary
Let the user grab a die with a finger or a mouse, drag it physically through the box, and fling it on release with the pointer velocity. Pointer half of #7, developed in parallel with the device motion half.

# Specs
# Specs
## Context
World API from task #4 (`src/physics/world.js`): `world.setGravity(vec3)`, `world.bodies`, `world.box {W,H,D}`, body fields `position, linearVelocity, angularVelocity, radius`, `FIXED_DT`. Axes: x right, y up on screen, z out of the screen. Box floor `z = 0`, lid `z = D`. The box has the real physical size of the screen (about 6.8 × 14.8 cm on a phone, `metersPerPixel = devicePixelRatio · METERS_PER_DEVICE_PIXEL`), dice have a real 16 mm size. The view is orthographic top-down: CSS pixel `(px, py)` maps to world `x = (px - cssW/2) · metersPerPixel`, `y = (cssH/2 - py) · metersPerPixel`, with `metersPerPixel` from `boxFromViewport`.
These modules only export functions. The wiring in `src/main.js` is done by the integration task (#8).

## `src/input/pointer.js`
- `createPointer(canvas, { world, toWorld(px, py) })` with Pointer Events (`touch-action: none` is already on the canvas). Multi-touch: each pointer holds at most one die.
- `pointerdown`: pick the die whose projected circle (`radius`) contains the point; with several, the highest `z`. `setPointerCapture`.
- Drag: the held die follows the pointer at hold height `z = D - 2·radius`. Drive it with velocity (`v = (target - position) / FIXED_DT`, clamped to `MAX_DRAG_SPEED = 2 m/s`) so collisions with other dice and walls stay physical; do not teleport. Keep its spin.
- `pointerup`/`pointercancel`: release with linear velocity = pointer velocity in world units from the samples of the last 80 ms, clamped to `MAX_FLING_SPEED = 3 m/s`, plus a random angular velocity proportional to the fling speed (up to 60 rad/s at max speed).
- Export `heldBodies()` so other code knows which dice are held.

## Tests
- `src/input/pointer.test.js`: the pure fling velocity function from timed samples (constant motion gives its speed, clamp applies, samples older than 80 ms are ignored).

## Acceptance criteria
- `npx vitest run src/input/pointer.test.js` exits 0.
- `npm run build` exits 0.

# Notes
- Added `src/input/pointer.js`: `createPointer(canvas, { world, toWorld })` (Pointer Events, per-pointer capture, one die per pointer), `heldBodies()`, `destroy()`, and pure `flingVelocity(samples, maxSpeed)`; constants `MAX_DRAG_SPEED = 2`, `MAX_FLING_SPEED = 3`, `MAX_FLING_SPIN = 60`, `FLING_WINDOW_MS = 80`.
- Drag drives velocity from the stored target each animation frame (`(target - position) / FIXED_DT`, clamped), so a still finger keeps the die up and the die still collides; the rAF loop runs only while a pointer is held. Hold height `z = D - 2·radius`.
- ondown keeps the current spin; onup/oncancel set linear velocity to the 80 ms pointer velocity (z zeroed, clamped) and add a random spin up to 60 rad/s scaled by fling speed.
- Tests in `src/input/pointer.test.js` cover the pure fling function (constant motion, clamp, stale samples, degenerate input) and, with a fake canvas and stub rAF, picking the highest die, the clamped drag drive, and release.
- Assumption: `toWorld(px, py)` returns a 2- or 3-element array or an `{x, y}` object in world units; the module accepts both.
- Assumption: fling samples use `event.timeStamp` in milliseconds, newest sample included on pointerup.
- Verification: `npx vitest run src/input/pointer.test.js` 6 passed, `npx vitest run src/physics` 27 passed, `npm run build` OK; clean-room `npm ci && npm test && npm run build` on the committed tree OK with relative asset paths. Commit `db548ef`.
