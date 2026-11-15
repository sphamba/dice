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
- `export const BOX_MIN_EDGE = 0.30` (m). `export function boxFromViewport(cssW, cssH)` returns `{ W, H, D, metersPerPixel }` with `metersPerPixel = BOX_MIN_EDGE / min(cssW, cssH)`, `W = cssW · metersPerPixel`, `H = cssH · metersPerPixel`, `D = BOX_MIN_EDGE` (depth = smallest screen edge).
- Die size: circumscribed-sphere diameter = `BOX_MIN_EDGE / 8`, so `export const DIE_RADIUS = BOX_MIN_EDGE / 16`.
- Default gravity (no device motion, desktop): `(0, 0, -9.81)`.

## Files
- `src/physics/body.js`: `createBody(shape, { density, position, orientation })` with fields `shape, position (vec3), orientation (quat), linearVelocity, angularVelocity (world frame), invMass, invInertiaBody (mat3), invInertiaWorld (mat3), radius (= shape.radius)`, and `updateDerived(body)` that recomputes `invInertiaWorld = R · invInertiaBody · R^T`. Density constant `DIE_DENSITY = 1200` (kg/m³, acrylic). Also `applyImpulse(body, impulse, worldPoint)`. Shapes come from `src/dice/shapes.js` (task #3) but `body.js` must only need `shape.radius`, `shape.volume`, `shape.inertia` so tests can pass a stub shape.
- `src/physics/integrator.js`: semi-implicit (symplectic) Euler:
  - `integrateVelocities(bodies, gravity, dt)`: `v += g·dt`, then linear and angular damping (`LINEAR_DAMPING`, `ANGULAR_DAMPING` constants, exponential `v *= 1/(1 + c·dt)`). No gyroscopic term (dice inertia is close to isotropic); write a one-line comment that names this limit.
  - `integratePositions(bodies, dt)`: `x += v·dt` with the NEW velocity, `q = quat.integrate(q, ω, dt)`, then `updateDerived`.
- `src/physics/world.js`: `createWorld({ W, H, D })` returns `{ bodies, gravity, box, events, addBody, removeBody, setGravity(vec3), setBox({W,H,D}), step(dt) }`.
  - `step(dt)` order: `integrateVelocities` → `solveContacts(world, dt)` → `integratePositions`. In this task `solveContacts` is a no-op function exported from `src/physics/contacts.js` (the collision task replaces its body). Clear `world.events` at the start of `update` (see below), not in each step.
  - `update(frameDt)`: fixed-step accumulator, `FIXED_DT = 1/240`, clamp `frameDt` to 0.1 s, max 8 steps per call (drop the remainder), so a hidden tab does not cause a spiral.
  - `setBox` keeps all bodies inside the new box: clamp each center to `[-W/2 + r, W/2 - r] × [-H/2 + r, H/2 - r] × [r, D - r]` and zero the velocity of moved bodies (rotation/resize case).
  - Constants live at the top of the module that uses them and are exported (no shared config file).

## Tests
- Free fall from rest for 1 s with `FIXED_DT` and no damping: velocity equals `g·t` exactly (float tolerance) and position matches the symplectic Euler sum `g·dt²·n(n+1)/2`, which proves velocity-then-position order.
- Constant angular velocity of a stub body for 1 s: orientation matches `quat.setAxisAngle` within 1e-3, quaternion stays unit length.
- `update(1.0)` runs at most 8 steps.
- `boxFromViewport(390, 844)` gives `W = 0.30`, `D = 0.30`, `H ≈ 0.649`.
- `setBox` with a smaller box moves an outside body back inside.

## Acceptance criteria
- `npx vitest run src/physics` exits 0.
- `npm run build` exits 0.

# Notes
