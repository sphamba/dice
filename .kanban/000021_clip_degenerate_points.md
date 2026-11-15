---
name: "fix: face clipping emits up to 6 degenerate contact points under near-flush alignment"
priority: "low"
state: "to-do"
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
