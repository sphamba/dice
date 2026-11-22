---
name: "feat: collide dice as rounded shapes (core polyhedron plus bevel radius)"
priority: "high"
state: "doing"
worktree: "feat/56-rounded-dice-collision"
issuer: "user"
complexity: "complex"
shortName: "rounded-dice-collision"
blockedBy: ""
splitter: "done"
---

# Summary
Collision uses the sharp vertices today. Collide each die as its rounded shape s·P ⊕ ball(r), the same shape the renderer draws, so the edges and corners roll and bounce as round.

# Specs
# Facts (main)
- `src/physics/collision.js`:
  - Die vs box: every sharp vertex is tested against the 6 box planes, with a contact when `distance < SLOP + approach*dt` (:72-93).
  - Die vs die: a bounding-sphere check, then SAT over face normals and edge x edge axes (EDGE_BIAS 1.05), with Sutherland-Hodgman clipping for face contacts and closest points for edge contacts (:105-306).
- `world.js containBody` (:56-89) pushes every sharp vertex back into the box. `clampIntoBox` uses `body.radius`.
- No radius or margin exists for rounded corners. #55 moves `BEVEL_RADIUS` (1.6 mm) next to `DIE_RADIUS` in `src/physics/body.js`.

# Change (Minkowski sum: rounded shape = core ⊕ ball(r))
- Core polyhedron: the die vertices scaled by the per-type inset s = 1 - r/rho (the same s as the renderer). Build it once per shape.
- Die vs box: use the core vertices. Contact when `distance < r + SLOP + approach*dt`. The contact point is the core vertex moved by r toward the plane, and the depth is `r - distance`.
- Die vs die: run the SAT on the two cores. Contact when the core separation is less than 2r (plus SLOP). The contact normal is the SAT axis. Move the contact points by r along the normal onto each rounded surface, and the depth is `2r - separation`.
- `containBody`: use the core vertices and keep each one at least r inside every box plane.
- Keep `body.radius` (circumradius of the sharp shape) for broad phase, clamp and hold height.
- Do not change restitution, friction, sleep, solver iterations, FIXED_DT or warm start. The rest height of a die on a face stays the same (core face at rho - r plus r).

# Tests
- A d6 resting on a face: the centre height equals the sharp-shape inradius within 0.05 mm.
- A d6 balanced on an edge or corner: the contact point lies on the rounded surface (r from the core edge or vertex), and the centre height matches the rounded geometry.
- Two d6 corner to corner: they touch when the core separation is 2r. No contact before.
- The #40 pile tests, the roll-out e2e (8 seeds, desktop and phone, every seed asleep within 5 s) and all other suites stay green. Record the new roll-to-sleep medians in Notes and compare with the #51 values (desktop 0.82 s, phone 0.97 s).
- If a pile or settle test fails, do not add damping and do not change another constant. Write an Open question with the measured times.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
## Progress (checkpoint)
- Done: card read, full batched source read of the touch set (collision.js, world.js, body.js, contacts.js, shapes.js, bevel.test.js, existing suites). No code written yet, nothing committed, tests not yet run.
- Plan (tests first, per PM hint one commit per working step):
  1. `collision.js` die vs box on core vertices (threshold r + SLOP + approach*dt, point = core vertex + r toward plane, depth = r - distance).
  2. `world.js` containBody on core vertices, keep each at least r inside every plane.
  3. `collision.js` die vs die SAT on cores (contact when core separation < 2r + SLOP, points moved r along the normal, depth = 2r - separation).
- Key facts settled from the read: BEVEL_RADIUS already exists in body.js (DIE_RADIUS / (4*sqrt(3))); renderer inset scale s = 1 - r/rho with rho = dot(vertex, face.normal) per type (pinned in bevel.test.js); shape cache in shapes.js is keyed by type|radius, so core vertices will be derived per body at createBody (cheap map over shape.vertices) or as a cached shape-derived map in collision.js.
- Tests planned: red tests in src/physics/collision.test.js and world.test.js (d6 face rest height, edge/corner rounded contact, two dice corner-to-corner at core separation 2r), then implementation until green, then scoped suites, then `npm test` + `npm run build`, then roll-out e2e medians recorded here vs #51 (desktop 0.82 s, phone 0.97 s).
- No blockers. Install was started at run begin (npm ci in background); deps assumed present by the time tests run.
