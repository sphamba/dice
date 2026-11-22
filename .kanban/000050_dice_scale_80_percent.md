---
name: "feat: shrink every die to 80% of its current size"
priority: "medium"
state: "to-merge"
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
## Review outcome: approved (re-review)

- Core change verified in the diff: `DIE_RADIUS = 0.0128*sqrt(3)/2` (d6 edge 12.8 mm, circumradius 11.085 mm) in `src/physics/body.js:7`; `BEVEL_RADIUS = DIE_RADIUS/(8*sqrt(3))` in `labels.js:127` is exactly 0.8 mm (was 1 mm). New `shapes.test.js` block asserts the 12.8 mm edge and per-type circumradius = DIE_RADIUS.
- All size-dependent consumers read the constant, no new hard-coded mm: hold height `box.D - 2*body.radius` (pointer.js:191), roll headroom (roll.js:39), AO `AO_RADIUS_SCALE(1.2) * DIE_RADIUS` (renderer.js:40,47), spawn bounds (main.js), mass/inertia via the density formula. Label layout untouched, face-relative.
- Sound: `dieModes` scales by `DIE_REFERENCE_RADIUS / size` (modes.js:73-76) → 0.0139/0.011085 = 1.254, the spec's ~+25% pitch rise; the 0.0139 constant is the calibration reference the spec design keeps. Physics thresholds (sleep, restitution, slop, warm start) untouched.
- Test fixture sweep complete: every former hard-coded die size in tests now imports DIE_RADIUS (pointer, body, contacts, integrator, world, world.e2e, sound, modes). Accepted prior adaptations stand: die-relative stacked-d6 gap (2.5 edge heights), swing test on the tall box axis, liftSpeed zero-headroom tolerance 5e-13 → 5e-7.
- Evidence: scoped suites (10 changed files) 183/183 exit 0 in 26.7 s; full `npm test` 27 files, 316/316 exit 0; `npm run build` exit 0. Live browser check (80% on-screen size, bevel/labels/AO look, grab/hang, no console or GL errors) deferred to the live-tester role.
