---
name: "feat: device motion gravity, iOS permission and portrait lock"
priority: "high"
state: "done"
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
# Notes

## Live test result: pass (39/39 checks, no defects filed)

Setup: headless Chromium (Playwright) against the app served statically from the worktree root (python http.server, port 8642). The module is not wired into main.js (that is task #8), so I drove it on the real app origin by dynamic import plus real browser input: real mouse click, real keypress, real fullscreen/orientation APIs, and synthetic DeviceMotionEvent dispatch. Expected vectors came from an independent reference implementation of the documented rule (g = -R(screenAngle) * (sign * accel), clamped to 4 * 9.81), not from the module source.

- App page loads with no console errors and the canvas renders; module exports are sane (MAX_GRAVITY 39.24, DEFAULT_GRAVITY (0,0,-9.81), all four functions).
- deviceToWorldGravity matches the reference within 1e-6: flat phone gives (0,0,-9.81) at angles 0/90/180/270; upright portrait at 0 gives (0,-9.81,0); tilt vectors rotate correctly at all four angles; magnitude above 4*9.81 clamps to 39.24 with direction kept; free fall gives (0,0,0).
- createMotion on desktop: onGravity(DEFAULT_GRAVITY) fires once at creation; no further calls within 1.2 s without events (the 1 s no-data fallback holds); events with null or partially null accelerationIncludingGravity are ignored; screen.orientation.angle is read live per event (changed to 90 mid-session, next event rotated correctly).
- iOS sign normalization (iPhone 13 emulation, UA matches /iPhone/): iOS-convention flat (0,0,-9.81) gives gravity (0,0,-9.81), upright (0,-9.81,0) gives (0,-9.81,0), angle 90 with (1,-2,9.81) gives (2,1,9.81). Feeding W3C-convention values on the iOS-emulated page flips gravity to +z, consistent with the platform-normalization assumption.
- Macintosh branch (Macintosh UA, maxTouchPoints 5): sign -1 applied, as assumed.
- First gesture: a real click and a real keypress each run queued onFirstGesture callbacks exactly once, synchronously inside the event and before the permission and lock requests run (callback observed permission counter still 0). The shared handler is removed after first use (second click, and a click after keydown, do nothing). Calling unlockOnFirstGesture() twice is a no-op. onFirstGesture registered after unlock runs immediately.
- requestPermission: called exactly once when present; resolve('granted') and reject() are both swallowed with no unhandled rejections and callbacks still run. With the API absent (real desktop Chromium, and Chromium with iPhone UA) unlock still works.
- Portrait lock: headless Chromium granted requestFullscreen (fullscreenElement set) on desktop and mobile-emulated contexts; screen.orientation.lock exists but never applies (orientation stayed landscape-primary on desktop, portrait-primary on phone emulation) and its rejection is caught silently, so the app follows rotation. This matches the spec.

## Test assumptions
- Real sensor hardware was not available, so real devicemotion data, the real iOS permission dialog, and real lock success or failure could not be observed. These paths were exercised with UA and touch emulation, a maxTouchPoints spoof, a patched DeviceMotionEvent.requestPermission, and synthetic devicemotion events.
- Desktop Chromium emits no devicemotion events, which doubles as the desktop and no-data fallback test.
- The screenAngle fallback to window.orientation was not testable: Chromium always provides screen.orientation.angle.

## Assumption contradictions observed
- The Notes assume non-multiples of 90 fall back to angle 0; the code instead rounds to the nearest multiple (45 behaves as 90, 135 as 180). Real sensors report only multiples of 90, so there is no user impact, but the assumption text does not match the implementation.
- Desktop Chrome also has document.fullscreenEnabled true and screen.orientation.lock defined, so per the spec a first click puts a desktop user into fullscreen before the silently failing portrait lock. Observed, follows the spec literally.

## Environment notes
- No global playwright on this machine; used the package from another repo via NODE_PATH. Headless Chromium caps navigator.maxTouchPoints at 1, so the Macintosh branch needed a page-side spoof to reach its > 1 condition.
