---
name: "fix: raise floor and wall friction to 0.4, keep lid and die-die at 0.1"
priority: "medium"
state: "live-testing"
worktree: "fix/43-floor-wall-friction-04"
issuer: "user"
complexity: "simple"
shortName: "floor-wall-friction-04"
changes: "{\"base\":\"main\",\"ins\":69,\"del\":22,\"files\":4}"
commits: "[{\"hash\":\"417e7cc\",\"subject\":\"fix(physics): pick friction from the box surface\",\"when\":\"2026-11-22T11:02:20+01:00\"}]"
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
# Notes
# Notes
# Notes
## Live test #43 (in progress, held at watch checkpoint #2)

Scope: user-level test of the friction change only (floor 0.4, wall 0.4, lid 0.1, die-die 0.1) through the real browser app (panel UI, devicemotion tilt, pointer drag, Roll button). No unit suites run. Worktree merged commit 417e7cc, vite :8791 from the worktree. Harness /tmp/dice-lt43.

Probe run: 9/10 PASS. PASS: app mounts (WebGL2, no unsupported banner), box dims match boxFromViewport (0.08 x 0.05 x 0.05 m at 1280x800 dpr1), default 2 d6 with gravity (0,0,-9.81), devicemotion path sets world gravity exactly, panel toggle/roll/add present, settled state NaN-free and contained, console clean.

Probe FAIL classified: HARNESS BUG, not a product defect. debug-roll.mjs raw trace proves the Roll button click fired (page-side click counter = 1), velocities were applied (die spin 25.7 rad/s), and the dice were flat at rest again within ~0.15 s wall. With floor friction 0.4 the toss lives only ~0.25-0.3 s sim: dice hop ~17-21 mm, land, and the raised friction kills the residual skid almost immediately. The probe sampled at 0.25 s sim granularity after the click, so the transient was already over - the exact "sample after the action settled" trap. Fix applied: rAF-granular flight tracker armed before triggers (harness installFlightTracker, wraps world.update and records max speed pre-update and max z post-update).

Full driver written (/tmp/dice-lt43/driver.mjs), not yet run. Scenarios:
- S0 settle at flat gravity (NaN, containment, gravity exact).
- S1 floor hold at 20 deg: per-die displacement < 3 mm, settles.
- S2 floor slide at 25 deg: every die slides (> 3 mm, max > 10 mm), ends at the -y wall/corner, contained.
- S3 wall friction: empty box via panel, tilt 80 deg (wall acts as floor; 0.4 holds from 68 deg, 0.1 would need 84 deg), add one d6 via panel; die must rest on the -y wall at z >= 16 mm (floor-corner rest would be <= 14 mm).
- S4 lid friction: gravity flipped up, die settles on lid, tilt 10 deg (0.1 < tan10 = 0.176), die must slide (> 3 mm) toward -y and stay on the lid.
- S5 roll flow via real Roll button with flight tracker: peak speed > 0.4 m/s, hop peak center z > 15 mm, settle, contained, NaN-free.
- S6 pointer drag flow: drag a die toward box center, release without fling, die follows >= 5 mm (retry with second die allowed); beforeStep is wrapped, not overwritten, so the pointer drive stays alive.
- Phone pass (iPhone 13 descriptor): iOS devicemotion sign path verified against exact gravity target, then hold 20 / slide 25 / containment.
- Console audited for pageerror/error across both contexts.

Next on release: node --check the driver, short smoke, then one background full run with absolute paths; then file defects (if any) and write the final report into these Notes.
