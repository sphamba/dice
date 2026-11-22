---
name: "feat: shrink every die to 80% of its current size"
priority: "medium"
state: "live-testing"
worktree: "feat/50-dice-scale-80-percent"
issuer: "user"
complexity: "complex"
shortName: "dice-scale-80-percent"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":59,\"del\":37,\"files\":12}"
commits: "[{\"hash\":\"ce0e5bd\",\"subject\":\"test: use the imported die radius in the integrator fixture\",\"when\":\"2026-11-22T13:33:33+01:00\"},{\"hash\":\"b6e5e2e\",\"subject\":\"feat: shrink every die to 80% of its size\",\"when\":\"2026-11-22T13:24:46+01:00\"}]"
---

# Summary
Scale all six die types to 80% of their current size (d6 edge 16 mm to 12.8 mm, DIE_RADIUS 13.86 mm to 11.09 mm). Every size-dependent value follows from DIE_RADIUS, so the dice look and behave the same, only smaller.

# Specs
# Need
- Every die type (d4, d6, d8, d10, d12, d20) becomes 80% of its current size. `DIE_RADIUS` (`src/physics/body.js`, now `0.016*sqrt(3)/2`) becomes `0.0128*sqrt(3)/2` (about 11.09 mm). The shapes in `src/dice/shapes.js` keep their relative proportions.

# Values that must follow the size (derive them from `DIE_RADIUS`, no new hard-coded millimetres)
- Mass and inertia: from the existing density formula.
- Grab hold height `D - 2*DIE_RADIUS`, roll headroom (#37), AO radius `1.2*DIE_RADIUS` (#38): check that each one reads `DIE_RADIUS`.
- Bevel radius (#39): 1 mm becomes 0.8 mm, written as a fraction of `DIE_RADIUS`.
- Label layout: numbers and pips stay relative to the face, as now.
- Die impact sound: the die modes follow the size (smaller dice click higher, about +25%), as the physics gives.
- Physics thresholds stay absolute (SLEEP_SPEED, restitution threshold, contact slop, warm-start match distance).

# Tests
- A test that the d6 edge is 12.8 mm and that every shape's circumradius equals `DIE_RADIUS`.
- Replace every hard-coded die size in tests (for example `DIE_RADIUS = 0.0139` in `src/input/pointer.test.js`) with the imported constant.
- All existing suites stay green: settle, pile (#40, 3 s at 15 and 30 degrees), roll headroom (#37), grab and hang (#45), bevel (#39), AO (#38), audio (#44).

# Acceptance criteria
- `npm test`
- `npm run build`
- Live check (browser): all six die types render at 80% of their previous on-screen size with the same look (bevel, labels, AO), roll, settle, can be grabbed and hang, with no console or GL errors.

# Notes
## PM hint
- Finish now. Run run5 once, then write the results table and finish. Do not add new checks and do not run the baseline A/B for the roll apex.
- A free hang (no contact) must put the CoM below the grab point. Use the #45 contact-aware verdict: free hang means xy < 1.5 mm; in contact means grab point held < 2 mm. If the d8/d12 6-9 mm offsets come with no contact (clearance > 0), file one card. Otherwise they pass.

## Progress (run4, 80/83 green)
- Physics chain exact: radius 11.085 mm, d6 edge 12.8 mm, mass from density.
- Settling, containment, hang/lift/release for all 6 types, panel, console clean, AO look matches baseline.
- 3 fails diagnosed as harness gates: pile apex (now an observation), d8/d12 hang rest xy (see hint above).
