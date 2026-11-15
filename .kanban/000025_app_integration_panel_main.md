---
name: "feat: main loop wiring, resize and DPR handling, die spawn and roll"
priority: "high"
state: "backlog"
worktree: ""
issuer: "#8"
complexity: "moderate"
shortName: "app-integration-panel-main"
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
