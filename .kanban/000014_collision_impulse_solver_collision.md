---
name: "feat: collision detection for dice vs box planes and dice vs dice"
priority: "high"
state: "done"
worktree: "feat/14-collision-impulse-solver-collision"
issuer: "#5"
complexity: "moderate"
shortName: "collision-impulse-solver-collision"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/physics/collision.js\",\"symbols\":[{\"name\":\"SLOP\",\"kind\":\"case\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"EDGE_BIAS\",\"kind\":\"case\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"BROADPHASE_MARGIN\",\"kind\":\"case\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"vec\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"boxPlanes\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"buildFrame\",\"kind\":\"fn\",\"ins\":29,\"del\":0,\"isNew\":true},{\"name\":\"detectBox\",\"kind\":\"fn\",\"ins\":21,\"del\":0,\"isNew\":true},{\"name\":\"project\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"separatingAxis\",\"kind\":\"fn\",\"ins\":38,\"del\":0,\"isNew\":true},{\"name\":\"findFace\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"sidePlanes\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"clipPolygon\",\"kind\":\"fn\",\"ins\":20,\"del\":0,\"isNew\":true},{\"name\":\"addFaceContacts\",\"kind\":\"fn\",\"ins\":24,\"del\":0,\"isNew\":true},{\"name\":\"supportEdge\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"closestPoints\",\"kind\":\"fn\",\"ins\":38,\"del\":0,\"isNew\":true},{\"name\":\"addEdgeContact\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true},{\"name\":\"detectPair\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true},{\"name\":\"detectContacts\",\"kind\":\"fn\",\"ins\":28,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/collision.test.js\",\"symbols\":[{\"name\":\"near\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"nearRel\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"cube\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"worldWith\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"detect\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"die\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"unit\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"faceAligned\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"die vs die SAT\",\"kind\":\"class\",\"ins\":49,\"del\":0,\"isNew\":true},{\"name\":\"die vs box\",\"kind\":\"class\",\"ins\":40,\"del\":0,\"isNew\":true},{\"name\":\"world wiring\",\"kind\":\"class\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\"src/physics/world.js\",\"symbols\":[{\"name\":\"createWorld\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":false},{\"name\":\"step\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T18:53:39.164Z\",\"head\":\"528ca0a\"}"
changes: "{\"base\":\"main\",\"ins\":475,\"del\":0,\"files\":3}"
commits: "[{\"hash\":\"e13e6b3\",\"subject\":\"feat(physics): add contact generation for dice vs box and dice vs dice\",\"when\":\"2026-11-15T19:52:49+01:00\"}]"
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
Live test PASSED: 64/64 checks across 7 scenarios (headless Chromium + playwright against python http.server, module imports from /src). Driver: /tmp/livetest14/driver.mjs (+expected.json, run3.log).

Scenarios (all PASS):
- S1 resting die 3 s: z=0.007998, speed ~0, exactly 4 floor contacts at the 4 low vertices, depth <= 3 um, points on the low face, distinct.
- S2 drop 5 cm: speculative floor contact at gap 1.24 mm <= margin 1.97 mm; containment worst 4 um; bounce rise 3.3 mm, settles at rest.
- S3 wall runs 5 m/s (x+/x-/y+): speculative wall contacts at gaps 3.7-5.3 mm <= margin ~10.5 mm, correct wall normals, ends resting inside, worst containment 5 um.
- S4 lid hit 4 m/s up: speculative lid contact gap 5.3 mm <= margin 8.3 mm, lid normals [0,0,-1], ends resting on floor.
- S5 head-on die-die 2 m/s: 2 contact steps, normals a->b, min center dist 15.195 mm, max depth 0.81 mm (<= 5 mm tol), fully separated at end, both rest on floor.
- S6 melee 6 dice 7 s: 753 die-die contact steps, all normals unit (dev 4.4e-16), contact.b non-null on every die contact (0 violations), max depth 1.08 mm, max contact-point excess 0.0, all 6 dice settle to 0 speed, final resting contacts floor+wall, no wedged pairs.
- S7 direct-step contract probes (zero-g): SLOP boundary, margin on/off for floor/wall/lid, stale contacts cleared, body without vertices skipped safely.

Finding 1 (blocking, NOT this task's code - filed as defect card #17): shapes.js inertia is per unit density (edge^5/6, asserted by shapes.test.js) but body.js multiplies it by mass again, so invInertia is 2.44e5 times too small in 1/I terms and every solver impulse comes out ~1e-11; with the merged tree all dice free-fall through floor/walls/lid. Harness worked around it by rescaling invInertiaBody = invert(inertia * DIE_DENSITY) after createBody. Detection itself (this task) is unaffected and correct without the workaround.

Finding 2 (minor, in this task's clipPolygon - filed as defect card #18): under near-flush face alignment with micro-tilts (~1e-4 rad from solver noise), Sutherland-Hodgman clipping emits up to 6 contact points instead of 4 (lerp crossing points land up to ~2 mm inside an edge because dc/dn are ~1e-6 with opposite signs). Isolated ideal pose gives exactly 4. Transient (one step), same normal/depth, no visible behavioral effect.

Emulation limits: headless Chromium (SwiftShader), no WebGL used; physics is deterministic fixed-dt stepping, no hardware-only paths exercised.
