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
- Do not change restitution values, friction, sleep, solver iterations, FIXED_DT or warm start. The rest height of a die on a face stays the same (core face at rho - r plus r).

# Restitution on speculative contacts (decision from the rebound probe)
- Defect: a fresh contact that fires with a negative (speculative) depth caps the closing speed in that step. In the next step it is no longer fresh, so the #40 rule gives no bounce. Measured die-on-die bounce 0.099 m/s against 0.285 m/s expected (rise 0.0147 against 0.0400).
- Fix (as in Box2D v3): before the velocity iterations, store each contact's relative normal velocity. After the iterations, run one restitution pass: for a fresh contact (the #40 rule) that carried a positive normal impulse in this step and whose stored approach speed is above `RESTITUTION_THRESHOLD`, solve the normal velocity toward `-e * storedApproach`, clamping the accumulated impulse at 0. Speculative and touching contacts use the same rule.
- Do not re-pin FIRST_REBOUND to the soft value. The pinned rebound (die 0.0400, floor 0.0262) must hold within the old tolerance.
- After this fix, re-measure the roll desktop mean rise (pin > 0.5) and the wake neighbour shift (pin 1e-4). If either still fails, write an Open question with the measured values and stop. Do not loosen a pin.

# Tests
- A d6 resting on a face: the centre height equals the sharp-shape inradius within 0.05 mm.
- A d6 balanced on an edge or corner: the contact point lies on the rounded surface (r from the core edge or vertex), and the centre height matches the rounded geometry.
- Two d6 corner to corner: they touch when the core separation is 2r. No contact before.
- A die dropped onto a resting die bounces with the pinned FIRST_REBOUND. A speculative fresh contact with an approach above the threshold gives `-e * approach` after the step (unit test in contacts.test.js).
- Test helpers measure the rounded surface (core vertices plus or minus r), not the sharp hull.
- The #40 pile tests, the roll-out e2e (8 seeds, desktop and phone, every seed asleep within 5 s) and all other suites stay green. Record the new roll-to-sleep medians in Notes and compare with the #51 values (desktop 0.82 s, phone 0.97 s).
- If a pile or settle test fails, do not add damping and do not change another constant. Write an Open question with the measured times.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
# Notes
## PM decisions
- (1) Fix the bounce loss. See the new Specs section "Restitution on speculative contacts". Do not re-pin FIRST_REBOUND.
- (2) and (3): re-measure after the fix. If they still fail, write an Open question with the values and stop.

## Progress
- Commit 59898a2: die-die scan rewrite with dirGroups, a midpoint prune and a SAT band gate. collision + world 47/47. world.e2e runs about 52 s.
- Helpers measure the rounded surface. Worst surface overshoot about 1e-17. The sharp hull pokes 3.11e-3, under the d4 bound 2r.
- Piles: 25/25 cases settle within 3.5 s.
- Rebound A/B: floor unchanged. Die-on-die bounce 0.099 m/s vs 0.9035 sharp (rise 0.0147 vs pin 0.0400), caused by the speculative fire step.

# Open questions

