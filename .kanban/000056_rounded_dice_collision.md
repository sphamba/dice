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
## Progress
- Commit 1 (7d79485) done: `coreVertices` on the shape, keyed by the existing cache; shapes suite 52/52 green.
- Commit 2 in progress, uncommitted: collision.js rework applied (frames on cores, box margin/depth/point on the rounded surface, SAT accept widened to −(2r+SLOP), face-contact threshold/depth/point rounded, edge depth from the SAT axis). Tests red, triage done, fixes designed, not yet applied.
- Full suite right now: 26 failed / 336 passed.

## Triage (measured, root causes)
1. My test fixture bug: rounded tests in collision.test.js build dice with `cube()` (R = 0.01) but position them from DIE_RADIUS-based constants; and the composed cornerDown quat has a 2.5e-9 residual. Production verified correct by probe on the fixed poses: edge rest 2 floor contacts depth ≈ 0, corner 1 contact depth ≈ 5e-18 with point at the origin, die-die touch depth 1e-6 normal −z, apart 0 contacts. Fix: DIE_RADIUS dice + direct half-angle quat (verified 1.1e-16).
2. SAT axis choice: with negative core overlaps now accepted, `1.05 × negative` edge score beats the face axis on the same geometry (4 clipped points → 1). Fix: score = max(overlap, 0) × EDGE_BIAS, legacy behaviour kept for real overlaps.
3. Edge-contact depth from the SAT axis overlap reports up to 2r penetration for dice that are merely close. Solver contract read (contacts.js:118-121): depth < 0 is a speculative velocity cap, depth > 0 is a Baumgarte push — so positive false depth = kicks. This explains the roll/e2e/sleep cascade. Fix: edge depth = 2r − |ca−cb| with a SLOP + closing·dt window, mirroring the box path.
4. world.test.js has the same composed cornerDown; same one-line fix.

## Verification
- Probe (instrumented copy, /tmp): corner/edge/die-die poses all match the card's acceptance values (depth 0 at true touch, contact point r from the core, 2r core-gap touch depth 1e-6).

## Assumptions
- Not tuning constants to mask e2e failures per the PM hint: the 26 failures are a wrong depth convention in the in-progress commit, with the root-cause fix queued; if any e2e still fails after that lands, I will stop and write an Open question with measured times.

## Blockers
- None. Next: apply fixes 1-4, probe the crossing-cubes pose for its new depth expectation, full suite, commit 2.

# Open questions

