---
name: "feat: input, device motion gravity with shake, portrait lock, pointer drag and fling"
priority: "high"
state: "done"
worktree: "feat/7-motion-pointer-input"
issuer: "user"
complexity: "simple"
shortName: "motion-pointer-input"
blockedBy: ""
splitter: "done"
map: "{\"files\":[],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:13:24.748Z\",\"head\":\"8725309\"}"
changes: "{\"base\":\"main\",\"ins\":0,\"del\":0,\"files\":0}"
commits: "[]"
---

# Summary
Verify the input task once both halves have landed: device motion gravity, iOS permission and portrait lock (#12), and pointer drag and fling (#13). Run the combined input test suite and the build, and check the exports consumed by the integration task (#8) and the audio task (#9).

# Specs
# Specs
## Verification (both halves are built by the subtasks)
- `src/input/motion.js` from #12: exports `createMotion({ onGravity })`, `unlockOnFirstGesture()`, `onFirstGesture(fn)`; mapping uses `-accelerationIncludingGravity` with `screen.orientation.angle`, clamped to `MAX_GRAVITY = 4 · 9.81`, default `(0, 0, -9.81)` fallback; portrait lock and permission requests catch every rejection.
- `src/input/pointer.js` from #13: exports `createPointer(canvas, { world, toWorld(px, py) })` and `heldBodies()`; drag driven by velocity (no teleport, `MAX_DRAG_SPEED = 2 m/s`), fling from the last 80 ms of samples clamped to `MAX_FLING_SPEED = 3 m/s`.
- `npx vitest run src/input` exits 0 with both `motion.test.js` and `pointer.test.js` present.
- `npm run build` exits 0.
- No wiring in `src/main.js`: that belongs to #8.

# Notes
Live test result: 107/107 browser checks pass. No defects found; no defect tasks filed.

## Scope and method
- Ran from the worktree. `npm run build` exits 0 (dist regenerated, relative asset paths). `src/main.js` has no input wiring (grep), as the Specs require for #8. The vitest suite was not run (live test runs real usage only).
- No input wiring exists yet (that is #8), so the real interface for these modules is the browser event system. Tested by loading `src/input/motion.js` and `src/input/pointer.js` in real headless Chromium pages (Playwright, page served from /tmp with a symlink into the worktree src; worktree untouched) and driving them with real trusted mouse drags plus synthetic `devicemotion`/PointerEvents. Every non-trivial expected value came from an independent Node reference script writing one `expected.json` used by the driver (single source of truth).
- Three contexts: desktop DPR 1 (1280x800), iPhone 13 emulation, Macintosh-UA + touch at fractional DPR 1.5 with a viewport resize mid-run.

## Motion (#12) results
- `createMotion` pushes `DEFAULT_GRAVITY (0,0,-9.81)` at create; `devicemotion` maps `-accelerationIncludingGravity` through `screen.orientation.angle` for 0/90/180/270/-90/45/450, all matching the reference exactly.
- iOS sign flip verified on iPhone emulation and on a simulated iPadOS page (Macintosh UA + maxTouchPoints 5); desktop sign verified as the fallback.
- Magnitude clamp at `MAX_GRAVITY = 39.24` verified (over-range accel scales onto the limit).
- Null/missing accel fields ignored; legacy `window.orientation` fallback works.
- Permission-request and portrait-lock rejections (stubbed to reject) and real-API unlock under iPhone emulation produce no page errors and no unhandled rejections; callbacks fire once on first gesture (pointerdown and keydown paths), `onFirstGesture` fires immediately after unlock.

## Pointer (#13) results
- Real mouse drag on a laid-out canvas: `heldBodies()` tracks pick/release; drag writes velocity `(target - position) / FIXED_DT` with 3D clamp to `MAX_DRAG_SPEED = 2` (exact clamped vectors match the reference); body position never changes during drag (no teleport).
- Multi-pointer: two simultaneous pointers hold two dice, independent release/cancel works.
- Slow release more than 80 ms after the last move flings exactly 0 - the 80 ms window drop works in a real flow.
- Fast fling (in-page event burst inside the window) clamps to `MAX_FLING_SPEED = 3`, velocity z forced to 0, random spin stays within `MAX_FLING_SPIN = 60 - min(speed/3, 1)`.
- `flingVelocity` unit cases match the reference exactly: 80 ms boundary is inclusive, older samples dropped, dt=0 and single-sample return zeros, custom max speed honored, negative directions preserved.
- `pointercancel` releases like pointerup; pointerdown on empty space holds nothing; `destroy()` detaches listeners.

## Exports for #8/#9
- motion: `createMotion`, `unlockOnFirstGesture`, `onFirstGesture`, `deviceToWorldGravity`, `MAX_GRAVITY`, `DEFAULT_GRAVITY`.
- pointer: `createPointer`, `flingVelocity`, `MAX_DRAG_SPEED`, `MAX_FLING_SPEED`, `MAX_FLING_SPIN`, `FLING_WINDOW_MS`; `createPointer` returns `{ heldBodies, destroy }`.
- No consumers exist in src yet (grep), so the contract check is presence of these names.

## Environment notes (not defects)
- Playwright `hasTouch` with a Macintosh UA reports `navigator.maxTouchPoints = 1` in this Chromium, so the `/Macintosh/ + maxTouchPoints > 1` iPadOS branch cannot fire under native emulation; it was exercised by overriding `navigator.maxTouchPoints` to 5 before the first module import. iPhone UA detection works natively.
- A real-mouse fast fling via CDP with 20 ms gaps spanned more than 80 ms and correctly produced zero fling (the window-drop path); the fast path was verified with in-page event bursts carrying real 10 ms gaps.
- Synthetic PointerEvents cannot drive `canvas.setPointerCapture` (no active pointer), so synthetic-event phases stub the three capture methods on the test canvas; real trusted mouse drags ran without stubs.
- `randomSpin` is random by design; verified by bound checks, not exact values.

## Assumptions made while designing the tests
- Since #8 owns the wiring, exercising the modules against browser events (real trusted mouse + synthetic devicemotion/pointer) is the correct real-usage surface for this task.
- The #8/#9 export contract is exactly the exported names/constants listed above; nothing extra is owed by this task (matches the task's own assumption note).
- Screen-angle rotation for angles other than 0 was tested by overriding the screen orientation angle; emulated devices here always report angle 0.
- Exact fling math was verified by calling the exported `flingVelocity` with fixed samples; event-path timing was verified with real timestamps and bounds.
