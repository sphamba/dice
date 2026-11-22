---
name: "feat: collide dice as rounded shapes (core polyhedron plus bevel radius)"
priority: "high"
state: "live-testing"
worktree: "feat/56-rounded-dice-collision"
issuer: "user"
complexity: "complex"
shortName: "rounded-dice-collision"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":509,\"del\":121,\"files\":10}"
commits: "[{\"hash\":\"7a82756\",\"subject\":\"fix: apply restitution in a post-iteration pass and contain dice by their rounded cores\",\"when\":\"2026-11-22T20:05:24+01:00\"},{\"hash\":\"d76f8e8\",\"subject\":\"fix: fire die-die face contacts speculatively and orient edge normals along the gap\",\"when\":\"2026-11-22T19:50:19+01:00\"},{\"hash\":\"7f11089\",\"subject\":\"feat: detect rounded die-die contacts with an exhaustive feature-pair scan\",\"when\":\"2026-11-22T18:46:44+01:00\"},{\"hash\":\"634c2e3\",\"subject\":\"feat: add the rounded core polyhedron to dice shapes\",\"when\":\"2026-11-22T17:30:39+01:00\"}]"
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
## Live test in progress (watch checkpoint write 2)

Scope: browser live test of the rounded-collision change and the speculative-contact restitution fix, desktop only. Real UI flows only (panel Add/Remove/Roll, grab-drag-fling pointer).

### Results
- smoke/rest: PASS - 2 d6 sleep in 0.76 s, rest at z=6.40 mm = d6 inradius exactly.
- roll (3x Roll button): PASS - settle 0.85-0.93 s (inside 5 s), containment <= 0.51 mm mid-tumble, rest heights 6.40 mm after every roll, real tumbling (spin 59 rad/s), no NaN.
- pile (10 d6 violent roll, 20 samples): PASS - min rounded-core pair distance +2.287 mm while sharp hulls overlapped to -0.971 mm at the same instants (the expected rounded-vs-sharp signature); asleep 2.62 s; screenshots confirm no visible overlap.
- wall fling (fresh-contact restitution e=0.5): PASS - 4/5 gated flings, spin-corrected contact-normal ratios 0.40-0.46, median 0.44 (approach 0.75-0.84 m/s, exit 0.31-0.36 m/s). No tunneling (maxX <= 25.1 mm = at-wall position for the rounded shape).
- drop (die-on-die rebound): FAIL on first run - rise 0.15 mm vs 2.34 mm predicted (approach 0.43 m/s). No app verdict yet; staging under inspection (next: print trace + pair distance at impact to identify what the falling die actually hit - target top face vs floor beside it; the 12 mm horizontal tolerance may be too loose).

### Injection mechanics learned (harness side, needed for the wall/drop phases)
- Playwright mouse dispatch is slow/coalescing here: flingVelocity's 80 ms window often catches one sample -> ~0 release velocity. CDP mouse stream also coalesces on the busy main thread.
- Working mechanism: synthetic in-page PointerEvent dispatch with faked evenly-spaced timestamps (real construction dt ~0.2 ms, so the die never physically chases between samples); pointer path must be monotonically increasing to the screen edge (a fold-back wrecks the window average); deterministic fling 1.08 m/s every attempt.
- App facts: drag z-target pulls the die up toward the lid while held (pointer.js:196); the view is top-down (screen y = world -y, z not in the projection, pointer.js worldXY); onRelease adds randomSpin(|v|) by design (pointer.js:253); restitution applies to the CONTACT-POINT normal velocity, so single-attempt center-vx ratios scatter around e until spin-corrected (v_n = vx + (w x r)_x at the x-most core vertex, quaternion now recorded in the trace).

### Assumptions/gates (unchanged)
- Desktop viewport, default d6 set; BEVEL_RADIUS 1.6 mm, d6 rho 6.4 mm, SLOP 1e-4, RESTITUTION 0.5/THRESHOLD 0.1 from source.
- Gates: settle <= 5 s, rest height 6.4 +/- 0.5 mm, core pair distance >= -0.5 mm sustained, wall e median in [0.3, 0.7] over >= 3 gated flings, drop rebound rise >= 0.4x (0.5*approach)^2/2g.

Still to run: drop-phase verdict (staging inspection first), final console-error sweep, full clean re-run, results table. No product defects filed so far.

# Open questions

