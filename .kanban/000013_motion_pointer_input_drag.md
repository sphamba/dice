---
name: "feat: pointer drag and fling of dice"
priority: "high"
state: "done"
worktree: "feat/13-motion-pointer-input-drag"
issuer: "#7"
complexity: "simple"
shortName: "motion-pointer-input-drag"
map: "{\"files\":[{\"path\":\"src/input/pointer.js\",\"symbols\":[{\"name\":\"clampSpeed\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"flingVelocity\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true},{\"name\":\"randomSpin\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"createPointer\",\"kind\":\"fn\",\"ins\":99,\"del\":0,\"isNew\":true},{\"name\":\"worldXY\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"pickBody\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"drive\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"pump\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"addSample\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"onDown\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"onMove\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"onRelease\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"destroy\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"heldBodies\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true}]},{\"path\":\"src/input/pointer.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"flingVelocity\",\"kind\":\"case\",\"ins\":36,\"del\":0,\"isNew\":true},{\"name\":\"fakeCanvas\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"fakeBody\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"createPointer\",\"kind\":\"case\",\"ins\":55,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:07:37.587Z\",\"head\":\"db548ef\"}"
changes: "{\"base\":\"main\",\"ins\":270,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"8725309\",\"subject\":\"feat(input): drag and fling dice with pointer events\",\"when\":\"2026-11-15T19:05:50+01:00\"}]"
---

# Summary
Let the user grab a die with a finger or a mouse, drag it physically through the box, and fling it on release with the pointer velocity. Pointer half of #7, developed in parallel with the device motion half.

# Specs
# Specs
## Context
World API from task #4 (`src/physics/world.js`): `world.setGravity(vec3)`, `world.bodies`, `world.box {W,H,D}`, body fields `position, linearVelocity, angularVelocity, radius`, `FIXED_DT`. Axes: x right, y up on screen, z out of the screen. Box floor `z = 0`, lid `z = D`. The box has the real physical size of the screen (about 6.8 × 14.8 cm on a phone, `metersPerPixel = devicePixelRatio · METERS_PER_DEVICE_PIXEL`), dice have a real 16 mm size. The view is orthographic top-down: CSS pixel `(px, py)` maps to world `x = (px - cssW/2) · metersPerPixel`, `y = (cssH/2 - py) · metersPerPixel`, with `metersPerPixel` from `boxFromViewport`.
These modules only export functions. The wiring in `src/main.js` is done by the integration task (#8).

## `src/input/pointer.js`
- `createPointer(canvas, { world, toWorld(px, py) })` with Pointer Events (`touch-action: none` is already on the canvas). Multi-touch: each pointer holds at most one die.
- `pointerdown`: pick the die whose projected circle (`radius`) contains the point; with several, the highest `z`. `setPointerCapture`.
- Drag: the held die follows the pointer at hold height `z = D - 2·radius`. Drive it with velocity (`v = (target - position) / FIXED_DT`, clamped to `MAX_DRAG_SPEED = 2 m/s`) so collisions with other dice and walls stay physical; do not teleport. Keep its spin.
- `pointerup`/`pointercancel`: release with linear velocity = pointer velocity in world units from the samples of the last 80 ms, clamped to `MAX_FLING_SPEED = 3 m/s`, plus a random angular velocity proportional to the fling speed (up to 60 rad/s at max speed).
- Export `heldBodies()` so other code knows which dice are held.

## Tests
- `src/input/pointer.test.js`: the pure fling velocity function from timed samples (constant motion gives its speed, clamp applies, samples older than 80 ms are ignored).

## Acceptance criteria
- `npx vitest run src/input/pointer.test.js` exits 0.
- `npm run build` exits 0.

# Notes
Live test done. The module passed all pick, hold, fling, cancel, multi-touch, and clamp checks (74/79 assertions). One defect found and filed: the held die oscillates around the pointer instead of following at hold height (#17). One spec-silent behavior needs a product decision (#18).

## How it was tested
- main.js does not wire the module yet (integration is task #8), so no drag flow exists in the served app. I tested the module through its real interface: an untracked harness page (live-harness/, deleted after the test) that wires createPointer to createWorld/createBody with the exact mapping from the Specs, and runs world.update in a rAF loop. Chromium via Playwright.
- Contexts: desktop 1280x800 dpr 1 (mouse), phone 390x844 dpr 3 hasTouch (multi-touch through two CDP touch points), small 100x200 dpr 1 (boxFromViewport guard path, mpp raised to 5e-4, for fling speeds above 3 m/s). rAF frame dt measured 15.9-16.7 ms in all contexts.
- Expected values came from an independent Node reference (re-implemented metersPerPixel, box guard, px->world mapping, hold height, fling window math) and a closed-loop simulation of world.js + pointer.js; never from the module under test.

## Results
- Geometry: mpp, box W/H/D, hold z = D - 2*radius, and px->world mapping match the reference to 1e-15 in all three contexts. Guard-boosted small box works.
- Pick: die under the point is picked; press on empty space holds nothing; press just outside the pick circle holds nothing; with two overlapping dice the highest z wins.
- Hold: pointer capture taken (mouse and touch) and released on pointerup; heldBodies() correct in all states; spin is kept while held (damped by the world's angular damping only).
- Drag: drive speed clamped to exactly 2 m/s on a large pointer jump. xy follows exactly (0.0 mm error) when the finger is still. FAILS after pointer motion and in z: see #17.
- Fling: release velocity equals the reference computed from the recorded 80 ms sample window to 1e-9 (trusted and synthetic pointerup, mouse and touch); z velocity zeroed; slow release gives speed 0.0375 m/s, fast synthetic fling clamped to exactly 3 m/s with direction kept; samples older than 80 ms ignored (release ~1 s after the last move gives velocity 0); still release gives exactly zero velocity and zero spin change.
- Spin on release: added spin stayed within the 60 rad/s * min(speed/3, 1) bound in all 5 releases (measured 0 to 38.5 rad/s).
- pointercancel: releases like pointerup for mouse and touch, with the same fling math; a later trusted pointerup is a no-op.
- Multi-touch: two touch pointers hold two dice (pointerIds 2, 3), each follows its finger, lifting one finger releases only its die with the correct fling. See #18 for two pointers on one die.

## Assumptions
- The app's world loop, rendering, and toWorld wiring do not exist yet, so the harness stands in for task #8 wiring using the Spec formulas. A different integration (for example world.update run inside the same rAF callback as pump before or after it) does not change the #17 finding; the closed-loop simulation confirms the oscillation is order-independent.
- Dice modeled as spheres with the die bounding radius (0.016*sqrt(3)/2 m) and density 1200, since src/dice shapes do not exist yet; pick uses body.radius as the Specs say.
- The drive-vs-gravity sag behavior depends on frame rate; tests measured at ~60 fps headless.
- solveContacts is still a no-op (collision task pending), so unheld dice fall through the floor and walls. I placed dice at hold height and grabbed them fast; this did not affect any assertion. Not counted as a finding of this task.
- Precision fling samples were produced with synthetic PointerEvents dispatched on the canvas (event.timeStamp is real) because trusted input timing cannot be controlled; all other flows used trusted Playwright input.

## Environment
- No global playwright package; ran with NODE_PATH=/home/phamba/repos/tarot/app/node_modules. Page served with python3 http.server on port 8641 (stopped and verified after the test).
- CDP touch point ids are not pointerIds: touch ids 5, 7, 11, 13 arrived as pointerIds 2, 3, ... The module itself is unaffected (it keys by event.pointerId).
- Two earlier run crashes were driver bugs of mine (wrong helper signature, page-evaluate closure), not product issues; final run completed clean with no page errors or console errors.
