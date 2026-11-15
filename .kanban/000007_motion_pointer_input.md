---
name: "feat: input, device motion gravity with shake, portrait lock, pointer drag and fling"
priority: "high"
state: "live-testing"
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
- Verified both landed halves against the Specs; no code changes were needed, working tree stays clean at HEAD 8725309.
- `src/input/motion.js`: exports `createMotion`, `unlockOnFirstGesture`, `onFirstGesture`; negated `accelerationIncludingGravity` rotated by `Math.round(angle/90) mod 4`, iOS sign flip, clamped to `MAX_GRAVITY = 39.24`, pushes `(0, 0, -9.81)` at create; permission and portrait-lock rejections are caught.
- `src/input/pointer.js`: exports `createPointer(canvas, { world, toWorld })` and `heldBodies()`; drag writes velocity `(target - position) / FIXED_DT` clamped to `MAX_DRAG_SPEED = 2`, release flings from the last `FLING_WINDOW_MS = 80` ms clamped to `MAX_FLING_SPEED = 3`.
- `npx vitest run src/input`: 2 files, 14 tests passed. `npm run build`: exit 0, `dist/index.html` references `./assets/...` relative paths.
- `src/main.js` still has no input wiring, as the Specs require (that is #8).
- Assumption: #8 and #9 consume `createMotion`, `unlockOnFirstGesture`, `createPointer` and `heldBodies` exactly as exported now; any extra contract they need is their own card's work.
