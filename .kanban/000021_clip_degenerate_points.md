---
name: "fix: face clipping emits up to 6 degenerate contact points under near-flush alignment"
priority: "low"
state: "done"
worktree: ""
issuer: "#14"
complexity: "simple"
shortName: "clip-degenerate-points"
map: "{\"files\":[{\"path\":\"src/physics/collision.js\",\"symbols\":[{\"name\":\"CLIP_WELD\",\"kind\":\"class\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"snapWeld\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"clipPolygon\",\"kind\":\"fn\",\"ins\":4,\"del\":2,\"isNew\":false}]},{\"path\":\"src/physics/collision.test.js\",\"symbols\":[{\"name\":\"keeps four clipped points for two flush cubes with a micro twist\",\"kind\":\"case\",\"ins\":8,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:43:28.187Z\",\"head\":\"d3e0c9d\"}"
changes: "{\"base\":\"main\",\"ins\":16,\"del\":2,\"files\":2}"
commits: "[{\"hash\":\"83422b1\",\"subject\":\"fix: weld near-zero clip plane distances to stop degenerate contact points\",\"when\":\"2026-11-15T20:42:06+01:00\"}]"
---

# Summary
Sutherland-Hodgman face clipping produces 6 near-duplicate contact points instead of 4 when incident and reference faces are near-coplanar with micro-tilts; transient, no functional impact observed.

# Specs
Found during live testing of #14 (S5 head-on flush face-face run). When the two dice are near-perfectly face aligned (orientation noise ~1e-4 rad from solver steps), the clipped incident quad can come out with 6 points instead of 4: lerp crossing points land up to ~2 mm inside an incident edge because plane distances dc/dn are ~1e-6 with opposite signs, so t = dc/(dc-dn) lands far from the corner. Captured at the first contact step: 6 contacts, all normal [-1,0,0], all depth 2.796e-4, points [y=-0.006032 alongside y=-0.008 corners on both z rows] at x=-0.01628. Isolated ideal pose (identity orientations) gives exactly 4. Transient (next steps back to 4), no visible behavioral effect: bounce, separation, containment all pass. Suggested fix: drop clip output points closer than ~1 mm to each other, or clamp t and dedupe near-coincident corners.

# Notes
- Fixed in `src/physics/collision.js`: `clipPolygon` now snaps plane distances with `|d| <= CLIP_WELD (1e-5 m)` to zero, so a micro-tilted edge that grazes a side plane produces no crossing point instead of a spurious vertex up to several mm inside the edge.
- Regression test added in `src/physics/collision.test.js`: two flush equal d6 cubes, top one twisted 1e-4 rad about the contact normal, overlap 1e-5 m. It yielded 8 points before the fix, 4 after.
- Assumption: root cause is the crossing test, not the dedupe suggested in the Specs. A 1 mm output-point dedupe does not fix the reported pose (the spurious point sits ~5 mm from the corner); the weld does.
- Assumption: the weld is set to 1e-5 m (10 µm), two orders below `SLOP` (1e-4 m), so it stays far below any physically meaningful clip offset and leaves genuine partial-overlap polygons (1 mm to 6 mm offsets probed) unchanged.
- Verification: 14400 randomized near-flush poses (radii 8, 10, 12, 16 mm, tilts up to 1e-3 rad, lateral noise up to 2e-4 m) all give exactly 4 die contacts; `collision`, `world`, `contacts` suites 38 tests pass; clean-room `npm test` 174 tests and `npm run build` pass with relative asset paths.
- Committed as `d3e0c9d` on branch `fix/21-clip-degenerate-points`.
- Live test: 62 of 62 checks pass at head d3e0c9d. No defects filed. Harness and records in `/tmp/dice-lt21/` (`reference.mjs`, `live.test.mjs`, `expected.json`, `live-results.json`).
- Live test, statics: 7 near-flush poses (flush-tilt 1e-4 rad, lateral offsets 1 mm to 5 mm, offset+tilt). The fixed module gives 4 contacts in every pose, depths 1e-5 m, normal [0,0,-1]. A verbatim port of the pre-fix pipeline on the same poses gives 8, 4, 8, 4, 4, 4, 6 points. This reproduces the reported 6+ point behavior and confirms the fix. Expected points come from an independent analytic corner truth (max deviation 3.6e-11 m), not from the port.
- Live test, S3 head-on slide (the reported scenario class, 2 s, 960 steps): first die-die contact step gives 4 contacts, depth spread 1.8e-8 m, points equal the touching face corners (dev <= 1e-9 m). The normal deviates 9.6e-7 rad from [-1,0,0] because solver transients tilt the dice about 1e-4 rad before impact. Count stays 4 in all 431 die-die steps. Min point pair distance 0.0160 m.
- Live test, S2 stack drop (3 s, 1440 steps): 1413 die-die steps, count history {4: 1410, 3: 3}, no step above 4. Min pair distance 0.0160 m. Final stack: bottom die z 0.008000, top die z 0.016000, speeds below 1e-5 m/s.
- Live test, S2 three 3-contact steps explained: during settling the top die tilt grows to 4.8e-3 rad, one corner lifts more than SLOP (1e-4 m) above the reference plane, and the separation filter drops it. At these steps the SAT reference face becomes the top die bottom face, and the points are the lower die top-face corners clipped into the top die footprint. All points lie on a face plane and inside the other footprint (dev <= 1e-9 m). This is pre-existing separation-filter behavior, not a weld artifact.
- Live test, S4 landing with 2 mm lateral offset (3 s): first die-die step 4 contacts, max count 4 over the run, min pair distance 0.0139 m, settled at 0.018 m/s. S6 pose sweep: 24 near-flush poses, all give 4 contacts, min pair distance 0.0159 m.
- Live test limits: contacts are detected before `integratePositions` inside `world.step`, so pose-dependent expectations use a `beforeStep` snapshot. Dynamic tolerances account for solver tilt (normal dot >= 1-1e-10, depth spread <= 1e-6 m). Physics modules only, no rendering paths.
