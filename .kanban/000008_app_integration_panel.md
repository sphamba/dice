---
name: "feat: app integration, dice set panel, roll button and Space key"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "complex"
shortName: "app-integration-panel"
blockedBy: "#5, #6"
---

# Summary
Wire physics, renderer and input into the main loop, add a mobile-friendly panel to choose the dice counts per type (cap 10, kept in localStorage), and roll all dice with a Roll button or the Space key.

# Specs
## Context
- Physics: `src/physics/world.js` (#4, #5): `createWorld`, `boxFromViewport(cssW, cssH, dpr)`, `DIE_RADIUS`, `world.update(frameDt)`, `world.setBox`, `world.setGravity`, `world.events`. The box has the real physical size of the screen (about 6.8 × 14.8 cm, depth 6.8 cm on a phone) and dice have a real 16 mm size.
- Shapes: `src/dice/shapes.js` (#3): `DICE_TYPES`, `createShape(type, radius)`. Bodies: `src/physics/body.js`.
- Renderer: `src/render/renderer.js` (#6): `createRenderer(gl)`, `resize(pixelW, pixelH, box)`, `draw(bodies)`.
- Input: `src/input/motion.js`, `src/input/pointer.js` (#7).
- Result display: none. The user reads the top faces. Do not add a result overlay.

## `src/main.js`
- Keep the WebGL2 check from #1.
- Create the world from `boxFromViewport(innerWidth, innerHeight, devicePixelRatio)` (the real DPR, not capped), the renderer, motion (`onGravity` → `world.setGravity`), pointer, `unlockOnFirstGesture()`.
- Loop with `requestAnimationFrame`: `world.update(dt)` then `renderer.draw(world.bodies)`. Clamp `dt` (hidden tab).
- On `resize`, `screen.orientation` `change`, and DPR change (`matchMedia('(resolution: …dppx)')` change, for browser zoom and moving the window to another screen): recompute the box, `world.setBox`, `renderer.resize` (canvas backing store = CSS size × min(devicePixelRatio, 2); this cap is for rendering only, the physics scale uses the real DPR).
- Spawn a die: random free position (no overlap with other dice) in the upper half of the box depth, random orientation (`quat.random`), small random velocity (< 0.2 m/s). If no free position is found after 50 tries, spawn at a random position and let the solver separate the dice.

## `src/ui/panel.js` + styles in `src/style.css`
- Overlay in `#ui`, at the bottom of the screen, respects `env(safe-area-inset-*)`, semi-transparent so the box stays visible.
- One row item per type d4, d6, d8, d10, d12, d20: `−` button, count, `+` button. Total over all types is 0 to 10 (`MAX_DICE = 10`). Disable `+` when the total is 10 and `−` when the count is 0.
- Changing a count adds a die of that type (spawn as above) or removes the most recently added die of that type, immediately.
- A Roll button: every die gets a random horizontal velocity 0.4 to 0.8 m/s in a random direction, a velocity against the current gravity direction (toward the lid when the phone is flat) of 0.3 to 0.6 m/s, and a random angular velocity 15 to 40 rad/s. Held dice are not changed. (Speeds fit a 16 mm die in a phone-size box; they are exported constants for tuning.)
- Space key rolls too: one roll per key press (ignore `repeat`), `preventDefault`, no double roll when the Roll button has focus.
- Default set when nothing is stored: 2 × d6.
- `localStorage` key `dice.set`: JSON `{ d4: n, d6: n, ... }`, saved on each change. Validate on read (trust boundary): only known types, integers ≥ 0, total ≤ 10; on any invalid content use the default. Catch `localStorage` errors (private mode).
- Accessibility: real `<button>` elements, `aria-label` like "Add d20", "Remove d20", "Roll dice", count in an `aria-live="polite"` element, visible focus ring, touch targets ≥ 44 × 44 CSS px.
- Panel events must not start a die drag on the canvas behind it.

## Tests
- `src/ui/panel.test.js`: the pure functions `parseStoredSet(string)` (valid, invalid JSON, unknown type, negative, non-integer, total > 10, all fall back to default) and `canAdd(set, type)` / `canRemove(set, type)`.

## Acceptance criteria
- `npm test` exits 0.
- `npm run build` exits 0.
- Manual (live test with `npm run dev`, desktop and a phone-size viewport): dice fall onto the floor and settle with readable faces and visible shadows; on a phone (or DevTools device mode, iPhone 15 at DPR 3) a d6 looks about 16 mm wide and the box width is about 6.8 cm; the Roll button and Space roll all dice; a die can be dragged and flung; counts persist after reload; the panel is usable at 360 × 640 CSS px; rotating, resizing, or browser zoom keeps all dice inside the box and zoom does not change the physical box size.

# Notes
