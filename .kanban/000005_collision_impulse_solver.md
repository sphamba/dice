---
name: "feat: convex collision detection and impulse-based contact resolution"
priority: "high"
state: "to-do"
worktree: "feat/5-collision-impulse-solver"
issuer: "user"
complexity: "simple"
shortName: "collision-impulse-solver"
blockedBy: ""
splitter: "done"
---

# Summary
Verify collision detection (#14) and the sequential impulse solver (#15) once both halves have landed: run the combined physics suite and build, and check the end-to-end world behavior (settling, containment, die-die penetration, events, energy, performance).

# Specs
## Verification scope
- `src/physics/collision.js` and `src/physics/contacts.js` exist with their test files; `src/physics/world.js` wires `detectContacts(world, dt)` between `integrateVelocities` and `solveContacts`, with `world.contacts` cleared each step; no dangling imports between the parallel halves; no new dependencies; constants exported from the module that uses them.
- `npx vitest run src/physics` exits 0.
- `npm run build` exits 0.

## End-to-end checks (the pieces were built in parallel)
All world tests use the iPhone 15 box `boxFromViewport(393, 852, 3)` and `DIE_RADIUS`.
- Settling: for each of d4, d6, d8, d10, d12, d20, drop one die from `z = D/2` with a random orientation (seeded RNG) and zero gravity sideways. After 5 s simulated, linear speed < 0.005 m/s, angular speed < 0.1 rad/s, lowest vertex `z` within 0.5 mm of 0, and the die rests on a face (the face whose normal is closest to `-z` has normal·(-z) > 0.99).
- Containment: 10 dice with random 3 m/s velocities and 60 rad/s spin, gravity rotated in random directions every 0.2 s with magnitude up to 4 g, 10 s simulated: every vertex of every die stays inside the box within 1 mm at every step.
- Die-die: two d6 fall onto each other; after 5 s neither penetrates the other by more than 0.5 mm (SAT depth).
- Events: a die dropped from `z = D/2` emits at least one `floor` event with speed close to `sqrt(2·g·h)` (± 20 %, `h` = drop height of the lowest vertex) and none while it rests.
- Energy: with `e = 0` restitution forced, a dropped die never bounces higher than its drop height.
- Performance: 10 dice for 1 s simulated (480 steps) runs in < 500 ms in Node.

# Notes
