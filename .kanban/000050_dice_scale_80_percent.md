---
name: "feat: shrink every die to 80% of its current size"
priority: "medium"
state: "doing"
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
