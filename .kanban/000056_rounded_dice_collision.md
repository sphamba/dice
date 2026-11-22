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
- Your feature-pair scan is a hand-made convex distance query. Keep it if it is close to green. If the vertex-face case adds another round of failures, replace the scan with GJK on the two core vertex sets (closest points and distance, about 80 lines, no dependency), and keep SAT plus clipping for the penetrating case.
- Cost: run the closest-feature query only when the core SAT separation lies between 0 and 2r + SLOP + closing*dt. A d20 pair has 12 vertices, 30 edges and 20 faces, and the step rate is 480 Hz.
- Next order stays: vertex-face candidates, re-pin the crossing test by probe, full suite, commit.

## Progress
- Commit 7d79485: core polyhedron on the shape. Die-die scan rewrite done, validated against an exhaustive feature-pair oracle:
  - The support-edge heuristic was unsound for finite segments (the closest segments along a cross axis are not the support extremes). Replaced by the full parallel-edge-pair enumeration per axis combo with a per-pair line-distance prune.
  - Added vertex-face candidates to the scan. detectPair now unions the clipped face polygon with the closest-feature-pair contact, deduped by normal (within 1e-6); the closest-pair contact supplies the true edge/vertex contact the clip misses once the cores separate.
  - Probe vs oracle: at the re-pinned crossing pose the deepest contact has the exact analytic normal (0, -0.611289, -0.791408) and depth 5.45699121659e-4 = 2r - core distance, matching the exhaustive oracle. collision.test.js 15/15 green. world.test.js 32/32 green.
- Full-suite triage (HEAD collision + HEAD world = 27/27 baseline; my collision + my world = 10 failures: roll x2, world.e2e x8):
  - The e2e/roll helpers measure the sharp hull, which is obsolete for rounded dice: the surface is the core dilated by r, the rotated sharp hull pokes up to r*(sqrt3-1) beyond it. Containment overshoot 0.00317 = 2r exactly: the solver holds the contact point (rounded surface) at the wall, so the sharp corner legitimately sits 2r beyond. Roll lid check: the surface stayed below the lid (lidSteps = 0 holds), only the sharp hull poked 1e-4.
  - Fix plan: give the helpers surface semantics (boxOvershoot / highestVertex / lowestVertex over coreVertices with the +-r support correction), re-pin FIRST_REBOUND by probe, probe the pile settle numbers.
  - Probe script /tmp/probe56e2e.mjs replicates the exact fixtures (containment seed 770311, pile y15 seed 20240601, rebound, roll); needs a quat.set API fix before running.
- Assumption: the union contact behavior is the intended manifold for rounded dice (the two overlapping regions of the rounded shells are both real contacts).
- Open question: whether any surface-vs-wall residual beyond the solver's speculative skin remains after the helper re-pin (the probe measures it).

# Open questions

