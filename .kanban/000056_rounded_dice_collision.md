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
## PM steer (read first)
- Stop the wall fling phase now. The problem is in the pointer harness, and no app defect is shown. Record the wall phase as "not measured in the browser, covered by the unit test (die into wall at 1 m/s leaves at 0.5 m/s)". Record the one gated attempt (ratio 0.61) as indicative only.
- Do the die-dropped-on-die phase with one attempt only, if the current harness can set it up in less than 5 minutes. If it cannot, record it as "not measured in the browser, covered by the FIRST_REBOUND unit test".
- Run the final console-error sweep, write the results table, and finish the live test. Total time budget from now: 10 minutes.
- File a finding only for a real app defect.

## Live test in progress (watch checkpoint write)

Scope: browser live test of the rounded-collision change and the speculative-contact restitution fix, desktop only (phone e2e belongs to the suites). Real UI flows only: panel Add/Remove/Roll, grab-drag-fling pointer.

### Environment
- Vite on :8856, Chromium + swiftshader, viewport 1100x1100 dpr1, box W=H=D=0.0635 m, gravity (0,0,-9.81), render fps 38, sim rate 0.567x wall (MAX_STEPS cap under swiftshader).
- Harness in /tmp/dice-lt56 (harness.mjs + driver.mjs, phase-filtered, results-r1-*.json), trace spy on beforeStep at 480 Hz for impact phases.

### Results so far
- smoke/rest: 2 d6 spawn and sleep in 0.76 s; both rest at z=6.40 mm = d6 inradius exactly (rest height unchanged, Spec pin) - PASS.
- roll (3x Roll button): settle 0.85/0.83/0.93 s (inside 5 s; consistent with #51 desktop 0.82 s median); mid-roll sharp containment <= 0.51 mm; rest heights 6.40 mm after every roll; trace shows real tumbling (max spin 59 rad/s, max speed 1.7 m/s); no NaN - PASS. Note: rolls decay in ~0.5 sim s, so mid-roll samples must land within ~0.15 sim s (harness timing, fixed).
- pile (10 d6, violent Roll, 20 state samples over the motion): min rounded-core pair distance +2.287 mm (never interpenetrating; gate -0.5 mm), while the sharp hulls overlapped to -0.971 mm at the same instants - exactly the expected rounded-vs-sharp signature. Asleep 2.62 s, no NaN, screenshots confirm no visible overlap - PASS.
- wall fling (fresh-contact restitution e=0.5): IN PROGRESS, no verdict yet. Injection findings so far (all harness-side): Playwright mouse dispatch is too slow/coalescing here so flingVelocity samples fall outside the 80 ms window (release velocity ~0); switched to a CDP mouse stream with 42/8 ms move spacing and a pointer-implied fling cross-check from the event log. One gated attempt showed exit 0.378 m/s against pointer fling 0.62 m/s (ratio 0.61, in band) but the trace's max-vx was polluted by the drag-chase tail (die driven into wall at up to 2 m/s while held). After re-arming the trace post-release the die is already at/pressed into the wall at release (chase covers 25 mm in ~13 ms), so the flight is shorter than my arm latency; plan: record release sim time and analyze only post-release rows, and start the fling farther from the wall. No app defect established in this phase yet.

### Assumptions
- Desktop viewport only; default set d6; RESTITUTION_DIE/_BOX 0.5, RESTITUTION_THRESHOLD 0.1, SLOP 1e-4, BEVEL_RADIUS 1.6 mm, d6 rho 6.4 mm from source.
- Gates: settle <= 5 s (Spec), rest height 6.4 +/- 0.5 mm, core pair distance >= -0.5 mm (5x SLOP, sustained watch), wall exit/approach in [0.3, 0.7] gated on pointer-implied fling >= 0.3 m/s, drop rebound >= 0.4x (0.5*approach)^2/2g.
- Pairwise rounded separation measured as exact convex feature distance (VF/FV/EE) on core vertices; verified against synthetic cube poses (touch=0, gap exact, interior overlap -depth).

Still to run: die-dropped-on-die rebound phase (one attempt), final console-error sweep, results table. No defects filed so far.

# Open questions

