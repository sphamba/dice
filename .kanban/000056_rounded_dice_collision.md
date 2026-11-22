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
- Commit 59898a2: the die-die scan rewrite (step 2 committed as ordered).
- Containment 30 s timeout fixed with three result-identical optimizations in the scan: dirGroups (parallel edge dirs deduped, 900 -> 225 axis combos for a d20), a 3D midpoint/halfLen prune before closestPoints, and a SAT band gate that skips the exact feature scan when the hull distance exceeds 2r + SLOP + closing*dt (the closing bound is conservative, so the gate never eats a contact addEdgeContact would fire). collision.test.js + world.test.js 47/47; the pinned oracle depth still matches to 1e-12. world.e2e runs ~52 s wall, no timeout.
- Helper re-pin done per plan: boxOvershoot and lowest/highestVertex measure the rounded surface (coreVertices +- BEVEL_RADIUS) in world.e2e.test.js and roll.test.js. Per-type bound check verified: worst surface overshoot ~1e-17 in the containment fixture, the sharp hull pokes 3.11e-3 there, under the d4 bound 2r = 3.2e-3 (signs consistent for all six types).
- Piles: all 25 cases (level/x15/x30/y15/y30 x 5 seeds) settle in <= 3.5 s on the current build. Earlier boundary readings (y15 5.68 s, one null) were tie-break chaos between builds, not a physics property.
- Rebound A/B (instrumented per-step, current vs 7d79485 sharp physics on a /tmp copy):
  - Floor bounce unchanged: rise 0.02620 vs pin 0.02619.
  - Die-on-die: sharp fires at step 69 with 4 contacts, depths +2.32e-3 (raw core overlap), bounce speed 0.9035, rise 0.039974 (the pin). Rounded fires at step 68 with depth -5.95e-4 (speculative), the depth turns positive only at step 69, bounce speed 0.0989, rise 0.01465.
  - Mechanism: the rounded depth (2r - core separation) makes the contact fire one step earlier with a negative depth; the solver's speculative branch lets the closing continue at the remaining-gap rate, so when the depth turns positive the approach is below the restitution threshold and the 0.5*approach bounce never engages. The fire-step target should have been bounce = 0.285, but the measured post-step vz is 0.099, so the solver also under-converges on this two-dynamic-body pair.
- Open questions (need PM decision): (1) fix the die-die bounce loss (probe the contact-cache freshness and solver convergence at the fire step) or accept the softer rounded bounce and re-pin FIRST_REBOUND.die to 0.01465; (2) roll desktop mean rise 0.498 vs the > 0.5 pin (per-toss rises 0.011..1.069, the wall-facing tosses die at the wall - likely the same speculative loss); (3) wake neighbor shift 2.2e-4..8.2e-4 across runs vs the 1e-4 pin (re-settle itself is fast, 0.027 s).
- Next: decide the rebound fix vs re-pin, then the roll mean, then the sleep pin, full suite, commit.

# Open questions

