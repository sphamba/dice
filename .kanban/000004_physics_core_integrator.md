---
name: "feat: physics core, rigid bodies, symplectic Euler, box world with device gravity"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "physics-core-integrator"
blockedBy: "#2"
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
