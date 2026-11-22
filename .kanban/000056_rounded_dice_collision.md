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

## Deliverable (in progress)
Rounded-contact detection for dice. Committed so far: 7d79485 (rounded core polyhedron in shapes). Current work: collision.js edge/corner contact path + test fixtures.

## State
- collision.js `separatingAxis` rewritten twice; current design: classic min-overlap SAT for face axes; edge-pair scan computes exact core segment-segment distances; selection = edge wins only when its distance beats the face axis separation; empty-clip fallback for offset poses kept.
- NEW this round: added vertex-vertex (64 pairs) and vertex-edge (192 pairs) candidates to the scan — oracle showed closest core features at generic crossing poses are corner-involving; edge×edge-only scan overstated core distance (3.1075e-3 vs true 2.654e-3 at probe pose).
- collision.test.js now 14/15 pass; only failing = 'gives one edge contact for two crossing cubes' (obsolete pose: was analytic for sharp dice; rounded cores at that pose are >RECESS+SLOP apart, correctly no contact).
- Suite dice are R=0.01 d6 (file-level const), H=R/sqrt(3); earlier probe confusion resolved: I had probed with DIE_RADIUS dice, different geometry. Fixed earlier: flush-twist, stacked, overlap depth expectations (0.16H coincides exactly with RECESS-coreGap), floor corner contact, containment.
- Remaining defect found by oracle probe: code reports dist 3.1075e-3 at crossing pose shift 1.5e-3 while analytic-direction support separation = 2.654e-3; missing candidate type = vertex-face (separated corner against other core's face with interior foot). Face path cannot own this case: its findFace(incident) picks a face far from the contact when cores are separated (clip empty). Fix: add vertex-face candidates to corner scan (8×6×2 point-in-polygon, dist>0 only; penetrating corners stay with face path). Then re-pin crossing test pose+expectations by probe (shift along analytic normal, assert depth vs measured, normal within ~0.6 rad tie arc or per-measured, faceAligned false, exactly 1 contact).

## Verification
- npx vitest run src/physics/collision.test.js: 14 passed | 1 failed.
- Full suite still red from earlier triage: world.e2e (pile settle timeouts 5.99s, mixed/toss/containment/rebound/sleep-wake) — not yet re-run after scan rewrite; next after crossing test green.

## Assumptions
- Depth semantics for corner path: RECESS − coreDistance, gate RECESS+SLOP+closing·dt, contact point = midpoint of closest core points, normal oriented b→a — same contract as edge path (contacts.js treats depth<0 as speculative cap).
- Normal direction at degenerate (tied) closest features is arbitrary within tie arc; tests must not pin 1e-12 on analytic normal for rounded cores.

## Blockers
- None technical; run order: add vertex-face candidates → re-pin crossing test → full suite triage → commit.

## Manual checks left to other roles
- Browser pile-drop visual sanity after merge (rounding visible, no interpenetration flicker).

# Open questions

