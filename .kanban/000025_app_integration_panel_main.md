---
name: "feat: main loop wiring, resize and DPR handling, die spawn and roll"
priority: "high"
state: "live-testing"
worktree: "feat/25-app-integration-panel-main"
issuer: "#8"
complexity: "moderate"
shortName: "app-integration-panel-main"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":162,\"del\":16,\"files\":1}"
commits: "[{\"hash\":\"4af8263\",\"subject\":\"feat: wire world, renderer, input and panel into the main loop\",\"when\":\"2026-11-15T21:01:40+01:00\"}]"
map: "{\"files\":[{\"path\":\"src/main.js\",\"symbols\":[{\"name\":\"resize\",\"kind\":\"fn\",\"ins\":0,\"del\":10,\"isNew\":false},{\"name\":\"randomRange\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"randomAxis\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"showUnsupported\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"freePosition\",\"kind\":\"fn\",\"ins\":26,\"del\":0,\"isNew\":true},{\"name\":\"spawnDie\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"removeDie\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"rollDice\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true},{\"name\":\"applySize\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"frame\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T20:07:29.497Z\",\"head\":\"4af8263\"}"
---

# Summary
Rewrite src/main.js to wire the physics world, renderer and input into a requestAnimationFrame loop, keep the box in sync with resize, orientation and DPR changes, implement die spawn/remove and the roll impulse, and connect the panel callbacks from #24.

# Specs
# Context
- You own `src/main.js` only (plus nothing else). The panel module `src/ui/panel.js` is delivered by task #24 and may not exist in your worktree yet: do not create, stub or modify it. Code against the pinned interface below; the merged tree is where `npm run build` and the live test go green.
- Available modules (all done): `src/physics/world.js` — `createWorld({W,H,D})` → `{ bodies, events, beforeStep, addBody, removeBody, setGravity, setBox, update(frameDt) }`, `MAX_FRAME_DT = 0.1`; `src/physics/box.js` — `boxFromViewport(cssW, cssH, dpr)`; `src/physics/body.js` — `DIE_RADIUS`, `createBody(shape, { density, position, orientation })`; `src/dice/shapes.js` — `DICE_TYPES`, `createShape(type, radius)`; `src/math/quat.js` — `random(out)`; `src/render/renderer.js` — `createRenderer(gl)` → `{ resize(pixelW, pixelH, box), draw(bodies), dispose() }`; `src/render/canvas-size.js` — `backingSize(cssW, cssH, dpr)` (caps dpr at 2); `src/input/motion.js` — `createMotion({ onGravity })`, `unlockOnFirstGesture()`; `src/input/pointer.js` — `createPointer(canvas, { world, toWorld })` → `{ heldBodies(), destroy() }`.

# Panel interface (pinned, delivered by #24)
```js
import { createPanel } from './ui/panel.js';
const panel = createPanel(ui, { onAdd, onRemove, onRoll }); // → { getSet() }
// onAdd(type), onRemove(type), onRoll() fire on user actions; getSet() returns current counts.
```

# src/main.js
- Keep the WebGL2 check from #1 (unsupported message in `#ui`).
- Create the world from `boxFromViewport(innerWidth, innerHeight, devicePixelRatio)` (the real DPR, not capped), the renderer on the existing `#view` canvas, motion (`onGravity` → `world.setGravity`), pointer (`toWorld` maps CSS px to world meters using the current box), and call `unlockOnFirstGesture()`.
- Loop with `requestAnimationFrame`: clamp `dt` at `MAX_FRAME_DT` (hidden tab), `world.update(dt)` then `renderer.draw(world.bodies)`.
- On `resize`, `screen.orientation` change, and DPR change (`matchMedia('(resolution: …dppx)')` change, re-registered after each change, for browser zoom and moving the window to another screen): recompute the box, `world.setBox`, `renderer.resize` with the canvas backing store = CSS size × min(devicePixelRatio, 2) (use `backingSize`; this cap is for rendering only, the physics scale uses the real DPR).
- Spawn a die (`spawnDie(type)`): random free position with no overlap with other dice (center distance > 2 × DIE_RADIUS) in the upper half of the box depth, random orientation (`quat.random`), small random velocity (< 0.2 m/s). If no free position is found after 50 tries, spawn at a random position and let the solver separate the dice. Create the body with `createShape(type, DIE_RADIUS)` + `createBody` and `world.addBody`.
- Remove die (`onRemove(type)`): remove the most recently added body of that type — keep a per-type insertion-ordered list of spawned bodies.
- Roll (`rollDice()`): every body not in `pointer.heldBodies()` gets a random horizontal velocity 0.4 to 0.8 m/s in a random direction, a velocity against the current gravity direction (toward the lid when the phone is flat) of 0.3 to 0.6 m/s, and a random angular velocity 15 to 40 rad/s about a random axis. Held dice are not changed. Export the six bounds as tuning constants (e.g. `ROLL_SPEED_MIN/MAX`, `ROLL_LIFT_MIN/MAX`, `ROLL_SPIN_MIN/MAX`).
- Wire the panel: `createPanel(ui, { onAdd: spawnDie, onRemove, onRoll: rollDice })`, then spawn the initial set from `panel.getSet()` (n dice per type).

# Acceptance criteria
- No new tests required (the parent live test covers behavior). `npm test` exits 0 in your worktree (no test imports main.js).
- Do not create or stub `src/ui/panel.js`; `npm run build` is expected to stay red in your worktree until #24 merges — that is fine.

# Notes
- `src/main.js` rewritten as the only changed file: WebGL2 check kept, world from `boxFromViewport(innerWidth, innerHeight, devicePixelRatio)`, renderer on `#view`, `createMotion` -> `world.setGravity`, `createPointer`, `unlockOnFirstGesture`, rAF loop (`dt` clamped at `MAX_FRAME_DT`, `world.update` then `renderer.draw(world.bodies)`).
- Resize, `screen.orientation` change and DPR change share one `applySize()`: new box -> `world.setBox`, canvas backing store from `backingSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio)` (dpr capped at 2 for rendering only), `renderer.resize`, then the `(resolution: Ndppx)` media query is re-registered so browser zoom and screen moves are caught again.
- `spawnDie(type)` keeps a per-type insertion-ordered list in a `Map`, so `removeDie(type)` removes the newest body of that type; spawn loop is 50 tries of a non-overlapping (center distance > 2 x `DIE_RADIUS`) position, then one forced random position for the solver to separate.
- `rollDice()` skips bodies in `pointer.heldBodies()`, sets a random horizontal 0.4-0.8 m/s, adds a lift of 0.3-0.6 m/s opposite the normalized gravity, and a 15-40 rad/s spin about a random axis. The six bounds are exported as `ROLL_SPEED_MIN/MAX`, `ROLL_LIFT_MIN/MAX`, `ROLL_SPIN_MIN/MAX`.
- Panel wired as `createPanel(ui, { onAdd: spawnDie, onRemove: removeDie, onRoll: rollDice })`, then the initial set is spawned from `panel.getSet()`.
- Assumptions: "upper half of the box depth" means z in [D/2, D - DIE_RADIUS]; `toWorld` maps CSS px with the live box (`x` right, `y` up, scale `box.W / innerWidth`) so pointer picking matches the ortho camera; held bodies keep all their velocities on roll.
- Verification: `npm test` 200/200 passed and `npm run build` is green in this worktree (main merged #24, so `src/ui/panel.js` exists); clean-room `git archive HEAD` + `npm ci` + test + build passes with relative asset paths in `dist/index.html`; a headless Chromium (SwiftShader) smoke run on the built app showed 0 console errors, the panel with its Roll button, rendered dice, and no errors after a Roll click and a Space press.
