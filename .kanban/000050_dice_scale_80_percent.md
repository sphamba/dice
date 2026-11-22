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
## Deliverable
- All six dice at 80%: `DIE_RADIUS = 0.0128*sqrt(3)/2` (d6 edge 12.8 mm, circumradius 11.085 mm) in `src/physics/body.js`; `BEVEL_RADIUS = DIE_RADIUS/(8*sqrt(3))` = 0.8 mm in `src/dice/labels.js` (was 0.001 m). Mass/inertia, hold height, roll headroom, AO radius, label layout and die impact modes needed no code change: each already derives from `DIE_RADIUS`/`shape.radius`.
- New tests in `src/dice/shapes.test.js`: d6 edge = 12.8 mm at DIE_RADIUS; every type's circumradius equals DIE_RADIUS. Hard-coded 13.9 mm fixtures in pointer/body/contacts/world/sound/modes tests replaced with the imported constant.

## Verification
- HEAD ce32812. Scoped suites (dice, physics incl. 3 s pile e2e, input, audio, render): 259/259 green. `npm run build` green; both hashed assets referenced in dist/index.html.
- Live check PASS on all criteria: page loads with zero console/page/GL errors (webgl2, no context loss); served-module constants exact (DIE_RADIUS, bevel 0.8 mm, AO 1.2*R, d6 edge 12.8 mm, all six circumradii); all six types added via panel and rendering; synthetic grab-drag-hold-fling with the held die hanging motionless; clean settle. Dev server (port 4607, PIDs 466758/466774) killed, repo tree clean.

## Assumptions
- `DIE_REFERENCE_RADIUS = 0.0139` in modes.js is the sound model's calibration reference, not an app size, so it stays; the app dice click ~+25% higher because sound passes `shape.radius`.
- Physics thresholds and speed caps (SLEEP_SPEED, restitution threshold, contact slop, warm-start distance, drag/fling caps) stay absolute per spec.
- Two test fixtures were scale-adapted after probe evidence, not tuned to pass: the stacked-d6 fixture now drops the upper die 2.5 edge heights above the lower (the old 0.04 m gap, die-relative; at the old absolute gap the smaller stack legitimately topples apart), and the pointer swing test moves along the tall box axis (the old x target left 14 mm to the wall while the die reaches 22.2 mm, so the die legitimately wedged on the wall; probes confirmed both mechanisms).
- The zero-headroom liftSpeed assertion tolerance went from 5e-13 to 5e-7: headroom retains a ~3.5e-18 m floating-point residual at the exact-lid position and sqrt amplifies it to ~7e-9 m/s (physical lifts are ~1 m/s).

## Blockers
- None.
