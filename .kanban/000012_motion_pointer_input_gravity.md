---
name: "feat: device motion gravity, iOS permission and portrait lock"
priority: "high"
state: "to-do"
worktree: ""
issuer: "#7"
complexity: "simple"
shortName: "motion-pointer-input-gravity"
---

# Summary
Drive the world gravity from the real device acceleration (tilt and shake), ask for motion permission on iOS, try to lock portrait, and expose a first-gesture hook for audio. Motion half of #7, developed in parallel with the pointer drag half (#13/#14).

# Specs
# Specs
## Context
World API from task #4 (`src/physics/world.js`): `world.setGravity(vec3)`, `world.bodies`, `world.box {W,H,D}`, body fields `position, linearVelocity, angularVelocity, radius`, `FIXED_DT`. Axes: x right, y up on screen, z out of the screen. Box floor `z = 0`, lid `z = D`.
These modules only export functions. The wiring in `src/main.js` is done by the integration task (#8).

## `src/input/motion.js`
- `createMotion({ onGravity })` listens to `devicemotion` and calls `onGravity(vec3)` with the world gravity:
  - Use `accelerationIncludingGravity` (tilt and real shake both move the dice). World gravity = `-accelerationIncludingGravity` mapped from device axes to screen axes with `screen.orientation.angle` (0, 90, 180, 270; use `window.orientation` as a fallback). W3C: a phone at rest face-up reports `z ≈ +9.81`, so gravity is `(0, 0, -9.81)`. Verify the sign on iOS Safari and Android Chrome and normalize it if a platform differs.
  - Clamp the magnitude to `MAX_GRAVITY = 4 · 9.81` (stability).
  - If no event with non-null data arrives within 1 s, or the API is missing (desktop), keep the default `(0, 0, -9.81)`.
- `unlockOnFirstGesture()`: on the first `pointerdown` or `keydown` anywhere (one shared handler, removed after use):
  - iOS: call `DeviceMotionEvent.requestPermission()` if it exists; if denied, keep the default gravity.
  - Portrait lock: if `document.fullscreenEnabled` and `screen.orientation?.lock` exist, `requestFullscreen()` on `document.documentElement` then `screen.orientation.lock('portrait')`. Catch every rejection silently. When the lock fails (iOS Safari, desktop), the app follows rotation: the mapping above uses the current angle, and the integration task (#8) resizes the box.
  - Return a promise or callback hook so the audio task (#9) can resume its `AudioContext` in the same gesture (export `onFirstGesture(fn)`).

## Tests
- `src/input/motion.test.js`: the pure mapping function `deviceToWorldGravity(accelIncludingGravity, angle)` for angles 0, 90, 180, 270 (phone flat gives `(0,0,-9.81)` for all angles; phone upright portrait at angle 0 gives `(0, -9.81, 0)`), and the clamp.

## Acceptance criteria
- `npx vitest run src/input/motion.test.js` exits 0.
- `npm run build` exits 0.

# Notes
