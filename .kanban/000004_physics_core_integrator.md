---
name: "feat: physics core, rigid bodies, symplectic Euler, box world with device gravity"
priority: "high"
state: "done"
worktree: "feat/4-physics-core-integrator"
issuer: "user"
complexity: "moderate"
shortName: "physics-core-integrator"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":507,\"del\":0,\"files\":9}"
commits: "[{\"hash\":\"5ce4524\",\"subject\":\"feat(physics): add rigid bodies, symplectic Euler integrator and fixed-step box world\",\"when\":\"2026-11-15T18:53:08+01:00\"}]"
map: "{\"files\":[{\"path\":\"src/physics/body.js\",\"symbols\":[{\"name\":\"scaleTensor\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"createBody\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true},{\"name\":\"updateDerived\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"applyImpulse\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/body.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"nearRel\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"tensor\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"makeShape\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"massOf\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"createBody\",\"kind\":\"fn\",\"ins\":33,\"del\":0,\"isNew\":true},{\"name\":\"updateDerived\",\"kind\":\"fn\",\"ins\":19,\"del\":0,\"isNew\":true},{\"name\":\"applyImpulse\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/box.js\",\"symbols\":[{\"name\":\"boxFromViewport\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/box.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"boxFromViewport\",\"kind\":\"fn\",\"ins\":29,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/contacts.js\",\"symbols\":[{\"name\":\"solveContacts\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/integrator.js\",\"symbols\":[{\"name\":\"integrateVelocities\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"integratePositions\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/integrator.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"nearRel\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"makeBody\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"run\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"integrateVelocities\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"integratePositions\",\"kind\":\"fn\",\"ins\":27,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/world.js\",\"symbols\":[{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"clampIntoBox\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"createWorld\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"addBody\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"removeBody\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"setGravity\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"setBox\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"step\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"update\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/world.test.js\",\"symbols\":[{\"name\":\"nearRel\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"makeBody\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"countSteps\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"createWorld\",\"kind\":\"fn\",\"ins\":31,\"del\":0,\"isNew\":true},{\"name\":\"step\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"update\",\"kind\":\"fn\",\"ins\":27,\"del\":0,\"isNew\":true},{\"name\":\"setBox\",\"kind\":\"fn\",\"ins\":29,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T17:57:34.261Z\",\"head\":\"5ce4524\"}"
---

# Summary
Write the rigid body state, the semi-implicit (symplectic) Euler integrator, the fixed-timestep world and the closed box that maps to the screen. Gravity is a settable vector so device motion can drive it. Collisions come in a separate task.

# Specs
## World conventions (all tasks use these)
- Units: meters, seconds, kilograms. Axes: x right, y up on the screen, z out of the screen.
- The box is closed. Its footprint is the screen rectangle, centered on the origin: `x ∈ [-W/2, W/2]`, `y ∈ [-H/2, H/2]`. Floor at `z = 0`, lid (the phone glass) at `z = D`.
- Real-life size: the box has the physical size of the screen. Use a fixed length per DEVICE pixel and the device pixel ratio:
  - `export const METERS_PER_DEVICE_PIXEL = 0.0254 / 440` (about 440 ppi, typical of modern phones: iPhone 15 460 ppi, Pixel 8 428 ppi, Galaxy S24 416 ppi).
  - `export function boxFromViewport(cssW, cssH, dpr)` returns `{ W, H, D, metersPerPixel }` with `metersPerPixel = dpr · METERS_PER_DEVICE_PIXEL` (meters per CSS pixel), `W = cssW · metersPerPixel`, `H = cssH · metersPerPixel`, `D = min(W, H)` (depth = smallest screen edge).
  - Use the real `devicePixelRatio`, not a capped value. Browser zoom changes CSS size and DPR in opposite directions, so the box keeps its physical size.
  - Same rule on all devices (a desktop box is also small). Only guard: if `min(W, H) < MIN_BOX_EDGE = 0.05` m, raise `metersPerPixel` so that `min(W, H) = MIN_BOX_EDGE` (a smaller box cannot hold the dice). Write a one-line comment that names this guard.
- Die size: real standard size, the same for all devices. A d6 has a 16 mm edge, and every dice type uses the same circumscribed-sphere radius as that d6: `export const DIE_RADIUS = 0.016 · Math.sqrt(3) / 2` (≈ 13.9 mm).
- Default gravity (no device motion, desktop): `(0, 0, -9.81)`.

## Files
- `src/physics/body.js`: `createBody(shape, { density, position, orientation })` with fields `shape, position (vec3), orientation (quat), linearVelocity, angularVelocity (world frame), invMass, invInertiaBody (mat3), invInertiaWorld (mat3), radius (= shape.radius)`, and `updateDerived(body)` that recomputes `invInertiaWorld = R · invInertiaBody · R^T`. Density constant `DIE_DENSITY = 1200` (kg/m³, acrylic). Also `applyImpulse(body, impulse, worldPoint)`. Shapes come from `src/dice/shapes.js` (task #3) but `body.js` must only need `shape.radius`, `shape.volume`, `shape.inertia` so tests can pass a stub shape.
- `src/physics/integrator.js`: semi-implicit (symplectic) Euler:
  - `integrateVelocities(bodies, gravity, dt)`: `v += g·dt`, then linear and angular damping (`LINEAR_DAMPING`, `ANGULAR_DAMPING` constants, exponential `v *= 1/(1 + c·dt)`). No gyroscopic term (dice inertia is close to isotropic); write a one-line comment that names this limit.
  - `integratePositions(bodies, dt)`: `x += v·dt` with the NEW velocity, `q = quat.integrate(q, ω, dt)`, then `updateDerived`.
- `src/physics/world.js`: `createWorld({ W, H, D })` returns `{ bodies, gravity, box, events, addBody, removeBody, setGravity(vec3), setBox({W,H,D}), step(dt), update(frameDt) }`.
  - `step(dt)` order: `integrateVelocities` → `solveContacts(world, dt)` → `integratePositions`. In this task `solveContacts` is a no-op function exported from `src/physics/contacts.js` (the collision task replaces its body). Clear `world.events` at the start of `update`, not in each step.
  - `update(frameDt)`: fixed-step accumulator, `FIXED_DT = 1/480` (small dice in a small box: at 3 m/s a die moves about 6 mm per step, less than half its radius), clamp `frameDt` to 0.1 s, max 16 steps per call (drop the remainder), so a hidden tab does not cause a spiral.
  - `setBox` keeps all bodies inside the new box: clamp each center to `[-W/2 + r, W/2 - r] × [-H/2 + r, H/2 - r] × [r, D - r]` and zero the velocity of moved bodies (rotation/resize case).
  - Constants live at the top of the module that uses them and are exported (no shared config file).

## Tests
- Free fall from rest for 1 s with `FIXED_DT` and no damping: velocity equals `g·t` exactly (float tolerance) and position matches the symplectic Euler sum `g·dt²·n(n+1)/2`, which proves velocity-then-position order.
- Constant angular velocity of a stub body for 1 s: orientation matches `quat.setAxisAngle` within 1e-3, quaternion stays unit length.
- `update(1.0)` runs at most 16 steps.
- `boxFromViewport(393, 852, 3)` (iPhone 15) gives `W ≈ 0.0681`, `H ≈ 0.1476`, `D = W` (1e-4 tolerance).
- `boxFromViewport(393, 852, 3)` and `boxFromViewport(786, 1704, 1.5)` give the same box (zoom does not change the size).
- `boxFromViewport(200, 300, 1)` gives `min(W, H) = 0.05` (guard).
- `setBox` with a smaller box moves an outside body back inside.

## Acceptance criteria
- `npx vitest run src/physics` exits 0.
- `npm run build` exits 0.

# Notes
Live test result: PASS. Exercised the physics API in headless Chromium (Playwright) against the served project, the way the future UI will import it. 51/51 checks passed across three emulated contexts: desktop 1280x720 dpr 1, phone 393x852 dpr 3 (mobile emulation), fractional-DPR 786x1704 dpr 1.5. Pages loaded with zero console/page errors. All numeric expectations came from an independent plain-JS reference implementation (no repo imports); initial harness expectation bugs were audited numerically and fixed before drawing conclusions - the final run matched the product to ~1e-9.

Verified flows:
- Box sizing: boxFromViewport(393,852,3) gives W=0.068060, H=0.147551, D=W (within 1e-4 of spec's 0.0681/0.1476); zoom invariance holds exactly (393x852@dpr3 and 786x1704@dpr1.5 give a bitwise-identical box); live window values match in all three contexts; min-edge guard fires on small viewports (200x300@dpr1 and any desktop-height window at dpr1 give min(W,H)=0.05); resizing the viewport (393x852 then back) recomputes the box correctly with the guard.
- World: default gravity (0,0,-9.81), box stored as given, addBody returns the body, removeBody removes exactly once.
- Integration: 480 direct steps (=1 s) of damped free fall match the independent symplectic Euler reference (velocity-then-position order) to 1e-9; constant spin of an anisotropic rotated body for 1 s matches the first-order quaternion reference to 1e-9 and the exact exponential map within 7e-6 (spec tolerance 1e-3); quaternion stays unit length.
- Gravity as device input: setGravity([9.81,0,0]) redirects motion (matches chained reference), setGravity back to default resumes downward fall; values exact.
- Fixed-step accumulator: update(1.0) and update(0.1) both advance exactly 16 steps (cap + remainder drop); sub-step carry works (three update(0.6*FIXED_DT) calls produce 0, 1, 0 steps); 60 frames of update(1/60) produce exactly 480 steps = 1 s, identical to direct stepping.
- Events: cleared at the start of update, not by step.
- setBox: shrinking clamps an outside body to the boundary, zeroes its linear and angular velocity, leaves an inside body (position and velocities) untouched; growing back keeps positions; box values update.
- applyImpulse: linear Delta-v = J/m; angular Delta-omega = invInertiaWorld * (r x J) verified for an identity cube and a rotated anisotropic body, confirming R * invInertiaBody * R^T and the column-major mat3 conventions; invInertiaWorld equals invInertiaBody for identity orientation.
- Constants exported as specified: METERS_PER_DEVICE_PIXEL = 0.0254/440, MIN_BOX_EDGE = 0.05, DIE_DENSITY = 1200, DIE_RADIUS = 0.016*sqrt(3)/2, FIXED_DT = 1/480, MAX_STEPS = 16, MAX_FRAME_DT = 0.1, LINEAR_DAMPING = 0.1, ANGULAR_DAMPING = 0.2.

Assumptions made while designing the usage tests:
- src/dice/shapes.js does not exist yet (task #3), so bodies used stub shapes: a 16 mm cube die (volume a^3, mass-normalized inertia diag(2a^2/12)) plus one anisotropic box to exercise the rotated inertia tensor. This matches the spec's design note that body.js only needs shape.radius/volume/inertia.
- Contacts are a later task, so bodies free-fall through the floor and walls under gravity; no resting behavior was expected or observed. Trajectories were verified against the independent reference instead.
- Physics is not wired into main.js yet (per task Notes), so the module API imported from the served page is the change's real interface; browser contexts provided real devicePixelRatio values for the box flows.
- Test tolerances: 1e-9 against first-order references (same double arithmetic), 1e-3 for spin against the exact exponential map (per spec).

Observation (not a defect, spec-compliant and unreachable via the public box path): setBox with a depth smaller than 2*DIE_RADIUS (e.g. manual setBox({D:0.01})) inverts the clamp range and pins bodies at z = D - r. The viewport guard (MIN_BOX_EDGE 0.05 > 2 * 0.0139 m) prevents this for screen-derived boxes.
