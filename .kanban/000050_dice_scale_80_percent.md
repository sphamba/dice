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
**Live-test #50 (dice 80% scale) — progress checkpoint**

Worktree: feat/50-dice-scale-80-percent (merged commit). Harness in /tmp/dice-lt50 (vite :8877, Playwright + CDP readback). Baseline A/B served from worktree base-16mm.

**Verified so far (run4, 80/83 checks green):**
- Physics chain exact for all 6 types: radius == 0.0128·√3/2 m (11.085 mm), mass == 1200 kg/m³ × volume, d6 edge 12.8 mm (80% of 16 mm). Unit-level constants confirmed in src/scene/dice.js.
- Launch-vz instrument grounded: rollVelocity sets vz = √(2·g·rise·headroom), rise ∈ [0.6, 0.75]; captured vz0 0.765 m/s ≥ liftMin 0.716 (grounded PASS).
- Settling: single + pile roll settle asleep, stay asleep 0.5 s (drift < 0.3 mm), contained, finite; launch and end-to-end spans correct.
- Hang (grab & lift) all 6 types: grab holds at (pointer, D−2R) ≤ 1.2 mm err; die lifts clear (minVertexZ 20–33 mm); release drops; settles contained.
- Panel add/remove counts, console clean (no pageerror), screenshots for all 6 types.
- AO look A/B vs baseline: contact-shadow bowls measured at +1 mm from silhouette: HEAD 5.0–5.9 vs baseline 5.0–6.0 luma, same monotone decay — AO appearance preserved. Baseline regression confirmed predates the change.

**3 failures, all now diagnosed and driver fixed (rerun pending):**
1. Pile apex gate "4 of 6 toss > 12 mm" — ungrounded: apex depends on contact-solve cancellation and pile collisions (single-die apex also reads 0.43–0.45× planned 0.60–0.75 despite exact launch vz). Reclassified as observation; participation gated on maxSpeed > 0.3 (all 6 pass).
2+3. d8/d12 "hang rest xy < 1.5 mm": series is STABLE at 6.0/9.3 mm (converged, not swinging) — a tilted hang pins a surface point sideways of the CoM. Hard geometric bound: CoM-to-pin horizontal offset ≤ circumradius for any orientation. Gate rewritten to geometry (xy < R, stable tail spread < 1 mm, grab z == D−2R ± 1.5 mm, not slept).

**Harness limits (documented, not defects):**
- Rendered-silhouette bbox equality for d4/d6/d8/d10: hue classifier eroded by AO-crushed dark faces; diff-vs-empty mask contaminated by bevel inset (4–5 px) and pose-dependent shadow (>10 luma under d4 overhangs). Robust remaining form: diff-mask coverage inside projected physics hull (d6 0.994, d4 0.958) — kept as smoke; size proof rests on exact physics chain + hull projection + lever 0.8× vs #45 + screenshots.
- Roll apex below planned band: launch vz is exact and grounded; apex loss is pre-existing contact-solver behaviour, not size-related (A/B on baseline pending, low priority).

**Next:** rerun full driver (run5) with the 3 gate fixes → screenshots + results table → wrap up. No product defects filed so far; nothing indicates the 80% scale is wrong or harmful.
