---
name: "feat: convex collision detection and impulse-based contact resolution"
priority: "high"
state: "done"
worktree: "feat/5-collision-impulse-solver"
issuer: "user"
complexity: "simple"
shortName: "collision-impulse-solver"
blockedBy: ""
splitter: "done"
map: "{\"files\":[{\"path\":\"src/physics/world.e2e.test.js\",\"symbols\":[{\"name\":\"vec\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"mulberry32\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"randomQuat\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"randomUnit\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"worldVertex\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"lowestVertex\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"deepestFaceAgainstFloor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"boxOvershoot\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true},{\"name\":\"dropBody\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"settling\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"containment\",\"kind\":\"fn\",\"ins\":43,\"del\":0,\"isNew\":true},{\"name\":\"die against die\",\"kind\":\"fn\",\"ins\":15,\"del\":0,\"isNew\":true},{\"name\":\"floor events\",\"kind\":\"fn\",\"ins\":23,\"del\":0,\"isNew\":true},{\"name\":\"energy\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"performance\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/world.js\",\"symbols\":[{\"name\":\"containBody\",\"kind\":\"fn\",\"ins\":31,\"del\":0,\"isNew\":true},{\"name\":\"createWorld\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":1,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:45:24.987Z\",\"head\":\"1217f3a\"}"
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
Live test of the collision + impulse change (HEAD 1217f3a) on 2026-11-15, run from the worktree like a user session.

Method
- Served the worktree with python http.server and drove the shipped physics modules in headless Chromium (Playwright, SwiftShader). Fixtures and expected values came from an independent Node reference script (box math W=D=68.06 mm, H=147.55 mm; drop height h=21.464 mm; expected impact sqrt(2gh)=0.6489 m/s). The SAT depth instrument was validated in Node against closed forms (0.001 m face overlap, separated pair, coincident pair, 45 degree rotated overlap) before use. No unit or e2e suite ran.
- The browser UI does not wire the physics yet (main.js only clears the canvas), so no dice flow exists to click through. Flows ran in-page through the served modules: settling drove the frame API world.update(1/60) for 5 s; the other scenarios used the fixed step world.step(1/480). This is a test limit, not a product defect of this task.

Results (all pass)
| Check | Measured | Spec limit |
| Settling d4, d6, d8, d10, d12, d20 (5 s) | linear <= 1.8e-5 m/s, angular <= 7.3e-4 rad/s, lowest vertex 0.000 mm, face alignment 1.0000 | 0.005 m/s, 0.1 rad/s, 0.5 mm, 0.99 |
| Containment, 10 dice, 10 s, 1-4 g random gravity every 0.2 s | worst vertex overshoot 0.0000 mm, 0 violations | 1 mm |
| Die-die, two d6 fall onto each other | rest depth -11.8 mm (they separate and rest apart, both face-down on the floor); 16544 pair contact events; sampled transient depth <= 0.125 mm at 100-step sampling | <= 0.5 mm at rest |
| Floor event, d6 dropped from z = D/2 | first floor event 0.6518 m/s at step 31 against analytic 0.6489 m/s (+0.4 percent); 8 floor events, decaying bounces; no floor events in the last 2 s | +/-20 percent of sqrt(2gh); silent at rest |
| Energy | lowest vertex never above the drop height (rise 0.000 mm) | never above drop height |
| Performance, 480 steps x 10 dice | ~440 ms warm in Node (median of 5 runs, mixed d4-d20 fixture), ~390 ms with a spread spawn, ~440 ms in headless Chromium | < 500 ms |

Assumptions
- "Drop from z = D/2" means the body centre starts at D/2, as the task already states.
- Die-die reads "after 5 s" as the at-rest depth; the dice ended side by side on the floor, which satisfies the no-penetration gate. Pair contact events prove they interacted (16544 events).
- Containment spawn: 8 dice on one layer (spacing 30 mm > die diameter 27.7 mm) plus 2 offset dice that start up to ~4.6 mm inside their neighbours; the solver resolved this within the first steps without a containment violation.
- Energy ran with the shipped restitution constants because contacts.js exposes no restitution parameter, as the task already states.

Contradicting observation
- The task notes measured "about 200 ms standalone" for 480 steps x 10 dice; this machine measured ~440 ms warm on a comparable mixed-type fixture and ~390 ms with a spread spawn. The 500 ms limit passes in both Node and the browser, but the margin is machine-dependent (12-25 percent). A cold first pass (JIT warm-up included) measured 550 ms, above the limit.

Environment only (not product defects)
- Headless Chromium printed one WebGL CONTEXT_LOST_WEBGL console warning when the app page loaded (SwiftShader). No page errors; the canvas was present. The renderer is outside this task's scope.
- No defects were filed; no open questions.
