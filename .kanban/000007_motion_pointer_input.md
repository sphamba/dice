---
name: "feat: input, device motion gravity with shake, portrait lock, pointer drag and fling"
priority: "high"
state: "to-do"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "motion-pointer-input"
blockedBy: ""
---

# Summary
Drive the world gravity from the real device acceleration (tilt and shake), ask for motion permission on iOS, try to lock portrait, and let the user grab a die and fling it with a finger or a mouse.

# Specs
## Context
World API from task #4 (`src/physics/world.js`): `world.setGravity(vec3)`, `world.bodies`, `world.box {W,H,D}`, body fields `position, linearVelocity, angularVelocity, radius`, `FIXED_DT`. Axes: x right, y up on screen, z out of the screen. Box floor `z = 0`, lid `z = D`. The box has the real physical size of the screen (about 6.8 × 14.8 cm on a phone, `metersPerPixel = devicePixelRatio · METERS_PER_DEVICE_PIXEL`), dice have a real 16 mm size. The view is orthographic top-down: CSS pixel `(px, py)` maps to world `x = (px - cssW/2) · metersPerPixel`, `y = (cssH/2 - py) · metersPerPixel`, with `metersPerPixel` from `boxFromViewport`.
These modules only export functions. The wiring in `src/main.js` is done by the integration task.

## `src/input/motion.js`
- `createMotion({ onGravity })` listens to `devicemotion` and calls `onGravity(vec3)` with the world gravity:
  - Use `accelerationIncludingGravity` (tilt and real shake both move the dice). World gravity = `-accelerationIncludingGravity` mapped from device axes to screen axes with `screen.orientation.angle` (0, 90, 180, 270; use `window.orientation` as a fallback). W3C: a phone at rest face-up reports `z ≈ +9.81`, so gravity is `(0, 0, -9.81)`. Verify the sign on iOS Safari and Android Chrome and normalize it if a platform differs.
  - Clamp the magnitude to `MAX_GRAVITY = 4 · 9.81` (stability).
  - If no event with non-null data arrives within 1 s, or the API is missing (desktop), keep the default `(0, 0, -9.81)`.
- `unlockOnFirstGesture()`: on the first `pointerdown` or `keydown` anywhere (one shared handler, removed after use):
  - iOS: call `DeviceMotionEvent.requestPermission()` if it exists; if denied, keep the default gravity.
  - Portrait lock: if `document.fullscreenEnabled` and `screen.orientation?.lock` exist, `requestFullscreen()` on `document.documentElement` then `screen.orientation.lock('portrait')`. Catch every rejection silently. When the lock fails (iOS Safari, desktop), the app follows rotation: the mapping above uses the current angle, and the integration task resizes the box.
  - Return a promise or callback hook so the audio task can resume its `AudioContext` in the same gesture (export `onFirstGesture(fn)`).

## `src/input/pointer.js`
- `createPointer(canvas, { world, toWorld(px, py) })` with Pointer Events (`touch-action: none` is already on the canvas). Multi-touch: each pointer holds at most one die.
- `pointerdown`: pick the die whose projected circle (`radius`) contains the point; with several, the highest `z`. `setPointerCapture`.
- Drag: the held die follows the pointer at hold height `z = D - 2·radius`. Drive it with velocity (`v = (target - position) / FIXED_DT`, clamped to `MAX_DRAG_SPEED = 2 m/s`) so collisions with other dice and walls stay physical; do not teleport. Keep its spin.
- `pointerup`/`pointercancel`: release with linear velocity = pointer velocity in world units from the samples of the last 80 ms, clamped to `MAX_FLING_SPEED = 3 m/s`, plus a random angular velocity proportional to the fling speed (up to 60 rad/s at max speed).

- Export `heldBodies()` so other code knows which dice are held.

## Tests
- `src/input/motion.test.js`: the pure mapping function `deviceToWorldGravity(accelIncludingGravity, angle)` for angles 0, 90, 180, 270 (phone flat gives `(0,0,-9.81)` for all angles; phone upright portrait at angle 0 gives `(0, -9.81, 0)`), and the clamp.
- `src/input/pointer.test.js`: the pure fling velocity function from timed samples (constant motion gives its speed, clamp applies, samples older than 80 ms are ignored).

## Acceptance criteria
- `npx vitest run src/input` exits 0.
- `npm run build` exits 0.

# Notes
