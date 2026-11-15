---
name: "fix: face clipping emits up to 6 degenerate contact points under near-flush alignment"
priority: "low"
state: "to-review"
worktree: "fix/21-clip-degenerate-points"
issuer: "#14"
complexity: "simple"
shortName: "clip-degenerate-points"
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
