---
name: "feat: convex collision detection and impulse-based contact resolution"
priority: "high"
state: "live-testing"
worktree: "feat/5-collision-impulse-solver"
issuer: "user"
complexity: "simple"
shortName: "collision-impulse-solver"
blockedBy: ""
splitter: "done"
map: "{\"files\":[{\"path\":\"src/physics/body.js\",\"symbols\":[{\"name\":\"createBody\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/physics/body.test.js\",\"symbols\":[{\"name\":\"createBody\",\"kind\":\"fn\",\"ins\":4,\"del\":5,\"isNew\":false},{\"name\":\"updateDerived\",\"kind\":\"fn\",\"ins\":3,\"del\":4,\"isNew\":false},{\"name\":\"applyImpulse\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false}]},{\"path\":\"src/physics/world.e2e.test.js\",\"symbols\":[{\"name\":\"mulberry32\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"randomQuat\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"randomUnit\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"worldVertex\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"lowestVertex\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"deepestFaceAgainstFloor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"boxOvershoot\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"dropBody\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"settling\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"containment\",\"kind\":\"fn\",\"ins\":43,\"del\":0,\"isNew\":true},{\"name\":\"die against die\",\"kind\":\"fn\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"floor events\",\"kind\":\"fn\",\"ins\":23,\"del\":0,\"isNew\":true},{\"name\":\"energy\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"performance\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/world.js\",\"symbols\":[{\"name\":\"containBody\",\"kind\":\"fn\",\"ins\":36,\"del\":0,\"isNew\":true},{\"name\":\"step\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:38:00.186Z\",\"head\":\"b836a2a\"}"
changes: "{\"base\":\"main\",\"ins\":267,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"1217f3a\",\"subject\":\"fix(physics): scale inertia by density and keep dice inside the box\",\"when\":\"2026-11-15T20:35:00+01:00\"}]"
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
Verified the combined collision (#14) and impulse solver (#15) halves on top of `main` (fast-forwarded; `main` is an ancestor of HEAD).

- One defect fixed, commit 1217f3a: `world.step` now projects every body vertex into the box after `integratePositions`. The radius clamp only runs in `setBox`, so it would float a die whose face rests flush on a wall, and a die pushed by another die can exceed the speculative contact margin in one step. The inertia fix (density instead of mass in `createBody`) already landed on `main` as ef08eee.
- New `src/physics/world.e2e.test.js` covers all six spec checks: settling for d4/d6/d8/d10/d12/d20, containment of 10 dice under 4 g random gravity, die-die rest depth after 5 s, floor impact event speed with silence at rest, energy (no rise above drop height), and performance.
- Evidence: `npx vitest run src/physics` gives 7 files / 66 tests passing; `npm run build` exits 0 and `dist/index.html` uses relative `./assets/` paths; working tree clean.
- Measured values vs spec: settling linear speed <= 1.8e-5 m/s, angular <= 5.7e-4 rad/s, lowest vertex 0.0000 mm, face alignment 1.0000; containment worst overshoot 0.0000 mm; die-die rest depth 0.21 mm; first floor event 0.7126 m/s against analytic 0.7146 m/s; energy rise -0.04 mm; 480 steps for 10 dice about 200 ms standalone.

Assumptions:
- "Drop from z = D/2" means the body centre starts at `BOX.D / 2`; the drop height for the event check is the world z of the lowest vertex at that moment.
- The energy check runs with the shipped restitution constants because `contacts.js` exposes no restitution parameter; the assertion (never above the drop height) is the e=0 claim and holds a fortiori with e = 0.3.
- The die-die spec is read as the depth at rest after 5 s, not the transient impact depth (which peaks at about 1.4 mm during the first 40 steps).
- The containment test keeps a 30 s vitest timeout because 10 s of simulated time with 10 dice takes about 7 s under vitest.
- `SETTLING` and other random fixtures use a seeded mulberry32 RNG so the checks are deterministic.
- The clean-room copy check from the earlier run was not repeated because the working tree had no uncommitted changes; the in-place scoped suite and build were re-run instead.
