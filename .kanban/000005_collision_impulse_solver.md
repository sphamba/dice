---
name: "feat: convex collision detection and impulse-based contact resolution"
priority: "high"
state: "to-do"
worktree: ""
issuer: "user"
complexity: "complex"
shortName: "collision-impulse-solver"
blockedBy: ""
---

# Summary
Detect contacts between dice (convex polyhedra) and the six box planes, and between dice, then resolve them with sequential impulses (restitution and Coulomb friction). Emit impact events for sound and haptics. Dice must never leave the closed box.

# Specs
## Context
World conventions, bodies, integrator and `world.step` come from task #4 (`src/physics/`). The box has real phone size (about 6.8 × 14.8 cm, depth 6.8 cm on an iPhone 15), dice have a real 16 mm size (`DIE_RADIUS ≈ 13.9 mm`), `FIXED_DT = 1/480`. Shapes come from task #3 (`src/dice/shapes.js`: `vertices`, `faces[].indices/normal`, `edges`, `edgeDirs`). `world.step` order is `integrateVelocities → solveContacts → integratePositions` (symplectic Euler with velocity-level impulses).

## Files
- `src/physics/collision.js`: contact generation. A contact is `{ a, b (body or null for box), surface: 'floor' | 'lid' | 'wall' | 'die', point (world vec3), normal (unit, from b toward a; for box contacts the inward plane normal), depth (positive = penetration, negative = gap) }`.
  - Die vs box: the 6 planes (floor z=0, lid z=D, 4 walls). One contact per vertex whose signed distance is below a speculative margin (`|v_rel_n|·dt + SLOP`), so fast dice cannot tunnel through a wall or the lid.
  - Die vs die: bounding-sphere broadphase (n ≤ 10, O(n²) is fine). Narrowphase SAT on face normals of both shapes and cross products of their `edgeDirs`. Face contact: clip the incident face against the reference face side planes (Sutherland-Hodgman), keep points below the reference face. Edge contact: closest points between the two edges. Use a small bias to prefer face axes over edge axes (stable resting contacts).
- `src/physics/contacts.js`: replace the no-op `solveContacts(world, dt)` from #4 with a sequential impulse solver:
  - Precompute per contact effective mass for normal and two tangents, using `invMass` and `invInertiaWorld`.
  - Restitution: target `-e · v_n` only when approach speed > `RESTITUTION_THRESHOLD` (0.1 m/s). `RESTITUTION_BOX = 0.3`, `RESTITUTION_DIE = 0.4`.
  - Coulomb friction, two tangent directions, clamped by `μ · accumulated normal impulse`. `FRICTION_BOX = 0.4`, `FRICTION_DIE = 0.3`.
  - Accumulated impulse clamping (normal ≥ 0), `SOLVER_ITERATIONS = 10`.
  - Penetration correction: Baumgarte bias `β = 0.2`, `SLOP = 0.0002` m, or split impulses. Speculative contacts (negative depth) allow `v_n` up to `-depth/dt` and get no bias.
  - Rolling resistance or an equivalent so dice settle instead of rocking forever: a small angular damping while in contact is fine.
  - Impact events: for each body pair (or body/surface) whose approach speed is above `EVENT_MIN_SPEED` (0.05 m/s) in this step, push ONE event per pair and step to `world.events`: `{ a, b, surface, point, speed (approach normal speed, m/s), impulse (summed normal impulse, N·s) }`. The sound and haptics task reads these events after each frame.
- Constants are exported from the module that uses them.

## Tests (`src/physics/collision.test.js`, `src/physics/contacts.test.js`)
All world tests use the iPhone 15 box `boxFromViewport(393, 852, 3)` and `DIE_RADIUS`.
- For each of d4, d6, d8, d10, d12, d20: drop one die from `z = D/2` with a random orientation (seeded RNG) and zero gravity sideways. After 5 s simulated, linear speed < 0.005 m/s, angular speed < 0.1 rad/s, lowest vertex `z` within 0.5 mm of 0, and the die rests on a face (the face whose normal is closest to `-z` has normal·(-z) > 0.99).
- Containment: 10 dice with random 3 m/s velocities and 60 rad/s spin, gravity rotated in random directions every 0.2 s with magnitude up to 4 g, 10 s simulated: every vertex of every die stays inside the box within 1 mm at every step.
- Die-die: two d6 fall onto each other; after 5 s neither penetrates the other by more than 0.5 mm (SAT depth).
- SAT unit tests: two separated cubes give no contact; face-face overlapping cubes give 4 contact points; edge-edge crossing cubes give 1 contact.
- Events: a die dropped from `z = D/2` emits at least one `floor` event with speed close to `sqrt(2·g·h)` (± 20 %, `h` = drop height of the lowest vertex) and none while it rests.
- Energy: with `e = 0` restitution forced, a dropped die never bounces higher than its drop height.
- Performance: 10 dice for 1 s simulated (480 steps) runs in < 500 ms in Node.

## Acceptance criteria
- `npx vitest run src/physics` exits 0.
- `npm run build` exits 0.

# Notes
