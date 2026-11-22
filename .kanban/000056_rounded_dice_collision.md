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
# Notes
## PM hint
- The helper plan is right: measure the rounded surface (core vertices plus r along the wall normal), not the sharp hull. Then assert the surface overshoot with the old tolerance. Do not loosen tolerances on the sharp hull instead.
- Check: when the rounded surface touches a wall, the sharp hull can stick out by at most r*(R/rho - 1) for that die type (d4 2r, d6 about 0.73r). An overshoot of 2r is only correct for a d4. If a non-d4 shows more than its bound, the contact depth or point has a sign error.
- Then probe the pile settle times. If a pile test still fails, stop and write an Open question with the measured times. Do not change constants.
- Commit step 2 (collision.js plus its tests) now, before the helper work.

## Progress
- Commit 7d79485: core polyhedron on the shape.
- Die-die: full feature-pair scan (edge-edge, vertex-edge, vertex-face) matches an exhaustive oracle. The contact set is the union of the clipped face polygon and the closest-feature contact. collision.test.js 15/15, world.test.js 32/32.
- Full suite: 10 failures (roll x2, world.e2e x8). They come from helpers that measure the sharp hull. Probe /tmp/probe56e2e.mjs needs a quat.set fix.

# Open questions

