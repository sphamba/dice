---
name: "feat: device motion gravity, iOS permission and portrait lock"
priority: "high"
state: "live-testing"
worktree: "feat/12-motion-pointer-input-gravity"
issuer: "#7"
complexity: "simple"
shortName: "motion-pointer-input-gravity"
map: "{\"files\":[{\"path\":\"src/input/motion.js\",\"symbols\":[{\"name\":\"MAX_GRAVITY\",\"kind\":\"class\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"DEFAULT_GRAVITY\",\"kind\":\"class\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"IOS\",\"kind\":\"class\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"clampMagnitude\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"deviceToWorldGravity\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"screenAngle\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"createMotion\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"firstGestureCallbacks\",\"kind\":\"class\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"onFirstGesture\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"requestMotionPermission\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"lockPortrait\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"unlockOnFirstGesture\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true}]},{\"path\":\"src/input/motion.test.js\",\"symbols\":[{\"name\":\"G\",\"kind\":\"class\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"expectVec\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"flat phone gives downward gravity for every screen angle\",\"kind\":\"case\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"upright portrait phone gives gravity along -y\",\"kind\":\"case\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"tilt in the screen plane rotates with the screen angle\",\"kind\":\"case\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"negative angle maps to its positive equivalent\",\"kind\":\"case\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"sideways shake moves the dice against the acceleration\",\"kind\":\"case\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"inverted iOS sign restores the spec convention\",\"kind\":\"case\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"magnitude clamped to MAX_GRAVITY without changing direction\",\"kind\":\"case\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"device at rest in free fall gives zero gravity\",\"kind\":\"case\",\"ins\":2,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:02:43.359Z\",\"head\":\"c51919e\"}"
changes: "{\"base\":\"main\",\"ins\":148,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"c51919e\",\"subject\":\"feat(input): map device motion to world gravity with iOS permission and portrait lock\",\"when\":\"2026-11-15T19:00:36+01:00\"}]"
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
- Added `src/input/motion.js`: `deviceToWorldGravity(accel, angle, sign=1)`, `MAX_GRAVITY`, `DEFAULT_GRAVITY`, `createMotion({onGravity})`, `onFirstGesture(fn)`, `unlockOnFirstGesture()`. Added `src/input/motion.test.js` (8 tests, all pass); `npm run build` passes and `dist/index.html` uses relative asset paths; clean-room `git archive` copy passes `npm ci && npm test && npm run build` (80 tests).
- Assumption: iOS Safari reports `accelerationIncludingGravity` negated relative to the W3C/Android convention (confirmed by W3C list and Stack Overflow reports; no real device available here), so the module applies `sign = -1` on iOS (user agent iPhone/iPad/iPod, or Macintosh with touch points) and `+1` elsewhere.
- Assumption: device-to-screen mapping is a rotation of the vector by `screen.orientation.angle` (90 -> `(-ay, ax, az)`, 180 -> negated x/y, 270 -> `(ay, -ax, az)`), falling back to `window.orientation` and then 0 for non-multiples of 90.
- Assumption: `createMotion` calls `onGravity(DEFAULT_GRAVITY)` at creation, so the 1 s no-data fallback needs no timer; only events with non-null `accelerationIncludingGravity` replace it. Clamping scales the vector to `MAX_GRAVITY = 4 * 9.81` and keeps its direction.
- Assumption: `onFirstGesture` callbacks run synchronously inside the first `pointerdown`/`keydown` before motion permission and portrait lock are requested; a callback registered after unlock runs immediately. Wiring into `src/main.js` stays with task #8.
