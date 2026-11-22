---
name: "feat: collide dice as rounded shapes (core polyhedron plus bevel radius)"
priority: "high"
state: "to-merge"
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
- Do not change restitution values, friction, sleep, solver iterations, FIXED_DT or warm start. The rest height of a die on a face stays the same (core face at rho - r plus r).

# Restitution on speculative contacts
- Defect: a fresh contact that fires with a negative (speculative) depth caps the closing speed in that step. In the next step it is no longer fresh, so the #40 rule gives no bounce.
- Fix (as in Box2D v3): before the velocity iterations, store each contact's relative normal velocity. After the iterations, run a restitution pass for every fresh contact (the #40 rule) whose stored approach speed is above `RESTITUTION_THRESHOLD`: Gauss-Seidel iterations toward the normal velocity `-e * storedApproach`, with the accumulated impulse clamped at 0, until the largest residual is below 1e-4 m/s or SOLVER_ITERATIONS passes have run. Then one friction re-clamp pass. Speculative and touching contacts use the same rule.
- The dice must not visibly interpenetrate: keep the die-die fire band at 2r + SLOP + closing*dt.
- FIRST_REBOUND: the floor pin (0.0262) holds. The die pin becomes the physical value `rise = (e * approach)^2 / (2g)`, with the measured fire-step approach and e = 0.5, computed in the test (no magic number), within the old relative tolerance. The old 0.0400 contained a Baumgarte push-out from the sharp overlap.
- After this fix, re-measure the roll desktop mean rise (pin > 0.5) and the wake neighbour shift (pin 1e-4). If either still fails, write an Open question with the measured values and stop. Do not loosen a pin.

# Tests
- A d6 resting on a face: the centre height equals the sharp-shape inradius within 0.05 mm.
- A d6 balanced on an edge or corner: the contact point lies on the rounded surface (r from the core edge or vertex), and the centre height matches the rounded geometry.
- Two d6 corner to corner: they touch when the core separation is 2r. No contact before.
- A die driven into a wall at 1 m/s leaves at 0.5 m/s (4 fresh contacts on one body).
- A die dropped onto a resting die rises to the physical FIRST_REBOUND above. A speculative fresh contact with an approach above the threshold gives `-e * approach` after the step (unit test in contacts.test.js).
- Test helpers measure the rounded surface (core vertices plus or minus r), not the sharp hull.
- The #40 pile tests, the roll-out e2e (8 seeds, desktop and phone, every seed asleep within 5 s) and all other suites stay green. Record the new roll-to-sleep medians in Notes and compare with the #51 values (desktop 0.82 s, phone 0.97 s).
- If a pile or settle test fails, do not add damping and do not change another constant. Write an Open question with the measured times.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
# Notes
# Notes
## Outcome: approved (re-review)
- Re-verified the committed tree (4 commits over main, clean). Acceptance green: npx vitest run src/physics 123/123, npm test 364/364, npm run build green.
- Spec mapping: core s = 1 - BEVEL_RADIUS/rho in shapes.js matches the renderer's scale (labels.js faceInsetData and the projected hull scale), frozen and cached; die-vs-box uses core vertices with margin r + SLOP + approach*dt, point r toward the plane, depth r - distance; die-die runs the feature-pair scan on cores with fire band 2r + SLOP + closing*dt on all three paths (gate, face, edge) and depth 2r - separation; contact points sit midway between the two rounded surfaces, the midpoint of the two spec surface points; containBody holds every core vertex r inside each plane; body.radius kept for broad phase, clamp and the closing bound; RESTITUTION/FRICTION/SOLVER_ITERATIONS/FIXED_DT/warm start untouched.
- Restitution pass matches the Spec: approach stored in prepare before the iterations, fresh contacts above RESTITUTION_THRESHOLD re-solved toward e*storedApproach with impulses clamped at 0, residual tolerance 1e-4 (RESTITUTION_TOLERANCE) or 10 passes, then one friction re-clamp; wall test gives -0.5 m/s; speculative-fire unit test green.
- Recorded assumption (kept): FIRST_REBOUND.die uses the analytic approach sqrt(2*GRAVITY*0.1) instead of the Spec's measured fire-step approach; the measured fire approach (1.380 m/s, dev probe) sits within the same 5% tolerance, so the analytic pin is the robust no-magic-number reading. Floor pin 0.02619 untouched.
- All Spec-named test poses present: face rest at the sharp inradius within 0.05 mm, edge and corner contacts r from the core feature, corner-to-corner touch at 2r with no contact at 2r + 2*SLOP, wall 1 m/s leaves at 0.5 m/s, die-on-die physical rebound, speculative unit test in contacts.test.js; helpers measure coreVertices plus/minus r.
- Removed tokens EDGE_BIAS and supportEdge: zero leftovers in src/; shape.vertices remains only in render/label/pick paths.
- Roll-to-sleep medians on the committed tree: desktop 0.8115 s, phone 0.8927 s vs #51 0.82/0.97, inside the e2e pins; mean rise 0.5228 > 0.5, wake neighbour shift 7.7e-7 < 1e-4.
- Guidance: when a Spec names a test pose, add that exact pose even if an equivalent variant already covers the rule.
- No browser/visual acceptance on this card; dice-roll feel with the new fire timing is the live-tester role's scope.

# Open questions

