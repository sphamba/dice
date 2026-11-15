---
name: "feat: input, device motion gravity with shake, portrait lock, pointer drag and fling"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "simple"
shortName: "motion-pointer-input"
blockedBy: "#12, #13"
splitter: "done"
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
