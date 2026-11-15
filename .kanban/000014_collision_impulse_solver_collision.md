---
name: "feat: collision detection for dice vs box planes and dice vs dice"
priority: "high"
state: "doing"
worktree: "feat/14-collision-impulse-solver-collision"
issuer: "#5"
complexity: "moderate"
shortName: "collision-impulse-solver-collision"
splitter: "done"
---

# Summary
Generate contacts in `src/physics/collision.js`: die vertices vs the six box planes (with speculative margins) and die vs die via bounding-sphere broadphase plus SAT narrowphase with face clipping and edge-edge closest points. Detection half of #5, developed in parallel with the impulse solver half (#15).

# Specs
## Context
World, bodies and the fixed-timestep loop come from task #4 (`src/physics/`: `body.js` with `createBody`/`updateDerived`, `integrator.js`, `world.js` with `createWorld`, `FIXED_DT = 1/480`). Shapes come from task #3 (`src/dice/shapes.js`: `createShape(type, radius)` → `{ vertices, faces[].indices/normal, edges, edgeDirs, volume, inertia, radius }`, all in local space; transform to world space with `body.position` and `body.orientation`). The box spans x ∈ [-W/2, W/2], y ∈ [-H/2, H/2], z ∈ [0, D] and has real phone size (`boxFromViewport(393, 852, 3)` → about 6.8 × 14.8 cm, depth 6.8 cm); dice have a real 16 mm size (`DIE_RADIUS ≈ 13.9 mm` from `body.js`). `world.step` order is `integrateVelocities → solveContacts → integratePositions` (symplectic Euler with velocity-level impulses).

`src/physics/contacts.js` is a no-op until the solver half (#15) lands: detection must not depend on it, and the existing `src/physics/world.test.js` must keep passing.

## Files
- `src/physics/collision.js`: contact generation. A contact is `{ a, b (body or null for box), surface: 'floor' | 'lid' | 'wall' | 'die', point (world vec3), normal (unit, from b toward a; for box contacts the inward plane normal), depth (positive = penetration, negative = gap) }`.
  - Die vs box: the 6 planes (floor z=0 → 'floor', lid z=D → 'lid', 4 walls → 'wall'). One contact per vertex whose signed distance is below a speculative margin (`|v_rel_n|·dt + SLOP`), so fast dice cannot tunnel through a wall or the lid. Velocities are already gravity-integrated when detection runs.
  - Die vs die: bounding-sphere broadphase (n ≤ 10, O(n²) is fine). Narrowphase SAT on face normals of both shapes and cross products of their `edgeDirs`. Face contact: clip the incident face against the reference face side planes (Sutherland-Hodgman), keep points below the reference face. Edge contact: closest points between the two edges. Use a small bias to prefer face axes over edge axes (stable resting contacts).
  - Constants are exported from the module that uses them (e.g. the speculative SLOP).
- `src/physics/world.js` (minimal wiring only, nothing else in #4's files): add `contacts: []` to the world object, and in `step` call `detectContacts(world, dt)` between `integrateVelocities` and `solveContacts`, clearing `world.contacts` at the start of each step.

## Tests (`src/physics/collision.test.js`)
- SAT unit tests (two d6 bodies or hand-built cube shapes): two separated cubes give no contact; face-face overlapping cubes give 4 contact points; edge-edge crossing cubes give 1 contact.
- Die vs box: a penetrating vertex gives a contact with the inward plane normal and positive depth; a vertex inside the speculative margin gives a contact with negative depth; a fast approach generates the speculative contact that prevents tunneling.
- A resting die on the floor produces vertex contacts on the lowest face only.
- Die vs die: two well-separated dice give no contact; overlapping dice give contacts with the expected axis and orientation (normal from b toward a).

## Acceptance criteria
- `npx vitest run src/physics` exits 0 (with `contacts.js` still a no-op).
- `npm run build` exits 0.

# Notes
