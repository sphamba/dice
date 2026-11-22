---
name: "fix: raise floor and wall friction to 0.4, keep lid and die-die at 0.1"
priority: "medium"
state: "to-review"
worktree: "fix/43-floor-wall-friction-04"
issuer: "user"
complexity: "simple"
shortName: "floor-wall-friction-04"
---

# Summary
Give die-floor and die-wall contacts a Coulomb friction of 0.4 and keep the glass lid and die-die contacts at 0.10, so dice grip the box bottom and sides but still slide on the glass and on each other.

# Specs
# Need
- Die-floor and die-wall friction: 0.4 (critical tilt angle about 21.8 degrees).
- Die-lid (glass) friction: stays 0.10. Die-die friction: stays 0.10.

# Facts (main at the time of filing)
- `src/physics/contacts.js:89` chooses `friction: b ? FRICTION_DIE : FRICTION_BOX`. `FRICTION_BOX` (0.1) covers floor, walls and lid together. `src/physics/collision.js:25-30` already tags every box contact with its surface: `'floor'`, `'wall'` or `'lid'`.
- The 2D Coulomb friction disk (`solveFriction`) and the warm-start clamp (`friction * normalImpulse`) read the per-contact `friction` value.

# Change
- In `src/physics/contacts.js`, pick the coefficient from the contact surface: `FRICTION_FLOOR = 0.4` for `'floor'`, `FRICTION_WALL = 0.4` for `'wall'`, `FRICTION_LID = 0.1` for `'lid'`, and `FRICTION_DIE = 0.1` for die-die. Remove `FRICTION_BOX` or keep it only if a caller still needs it.
- Do not change restitution, Baumgarte, iterations, FIXED_DT, warm starting, sleep or the friction disk.

# Tests
- Update `src/physics/contacts.test.js`: the friction and friction-disk tests use the surface coefficient. Add a check per surface (floor 0.4, wall 0.4, lid 0.1, die 0.1).
- Incline tests: a die on the floor holds at 20 degrees (below about 21.8) and slides at 25 degrees. A die on the lid (gravity flipped, tilted 10 degrees) still slides.
- `src/physics/world.e2e.test.js` 'tilted gravity': change the tilt to an angle above the new critical angle (for example 30 degrees) so that the settled d6 still slides and stays contained.
- The #40 pile tests (10 mixed dice, 15 and 30 degrees, both axes, 5 seeds, settle within 3 s) stay green.

# Acceptance criteria
- `npx vitest run src/physics`
- `npm test`
- `npm run build`

# Notes
# Notes
- Deliverable: `src/physics/contacts.js` picks friction per contact surface: `FRICTION_FLOOR = 0.4`, `FRICTION_WALL = 0.4`, `FRICTION_LID = 0.1`, `FRICTION_DIE = 0.1`. `FRICTION_BOX` removed (no other caller). Restitution, Baumgarte, iterations, FIXED_DT, warm start, sleep and the friction disk unchanged.
- Verification at HEAD 417e7cc: `npx vitest run src/physics` 105 passed, `npm test` 293 passed, `npm run build` green with `dist/index.html` linking the hashed js and css assets.
- Tests: `contacts.test.js` checks the coefficient per surface (floor, wall, lid, die), a floor contact holds at 20 degrees and slides at 25 degrees, a lid contact slides at 10 degrees. `world.e2e.test.js` tilted-gravity case uses 30 degrees. The #40 pile cases stay green.
- Assumption: `roll.test.js` now counts a lid contact only when its depth is positive. With floor friction 0.4 the tossed die enters the 1e-4 m speculative skin near the lid (gaps of 0.15 to 0.5 mm, no penetration) and the old check counted those as touches. `highest < box.D` still guards a real touch.
- Blockers: none.
- Manual checks left to other roles: none.
