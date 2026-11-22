---
name: "feat: shrink every die to 80% of its current size"
priority: "medium"
state: "to-review"
worktree: "feat/50-dice-scale-80-percent"
issuer: "user"
complexity: "complex"
shortName: "dice-scale-80-percent"
splitter: "done"
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
## Review outcome: fixed

- Core change verified: `DIE_RADIUS = 0.0128*sqrt(3)/2` (d6 edge 12.8 mm, circumradius 11.085 mm) in `src/physics/body.js`; `BEVEL_RADIUS = DIE_RADIUS/(8*sqrt(3))` = 0.8 mm exactly, as a fraction of DIE_RADIUS. New `shapes.test.js` tests assert the 12.8 mm edge and per-type circumradius = DIE_RADIUS.
- All size-dependent consumers derive from the constant, no new hard-coded mm: hold height `box.D - 2*body.radius` (pointer.js:191), roll headroom (roll.js:39), AO `1.2*DIE_RADIUS` (renderer.js:47), mass/inertia via density formula, label layout face-relative. Sound passes `shape.radius`; `DIE_REFERENCE_RADIUS = 0.0139` in modes.js confirmed as calibration reference only (scale ≈ 1.25, the spec's +25%). Physics thresholds untouched.
- Finding (fixed in a6d9e2e): `integrator.test.js` still hard-coded the old `radius: 0.0139` fixture, missed by the developer's fixture sweep; replaced with the imported DIE_RADIUS.
- Accepted documented adaptations: stacked-d6 fixture gap made die-relative (2.5 edge heights), swing test moved to the tall box axis, liftSpeed zero-headroom tolerance 5e-13 → 5e-7 (FP residual ~7e-9 m/s vs physical ~1 m/s). None weaken what the tests assert.
- Evidence: scoped suites (dice, physics, input, audio, render) 259/259 green in 15.7 s; `npm run build` green. Live browser check deferred to the live-tester role (developer reports a prior live PASS; re-verify 80% on-screen size, bevel/labels/AO, grab/hang, no console or GL errors).
