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
## PM hint
- Earlier live tests (#37, #42) measured that dice settle 0.2-0.5 s after a Roll, and the whole-world sleep then freezes them. Sample every frame from the Roll click for the first 0.5 s before you classify the roll check. The Roll flow is not in this task's scope: one passing roll is enough.

## Live test #43 (in progress)

Scope: user-level test of the friction change only (floor 0.4, wall 0.4, lid 0.1, die-die 0.1) through the real browser app: panel UI, devicemotion tilt, pointer drag, roll button. No unit suites run. Worktree merged commit 417e7cc, served with vite :8791 from the worktree.

Assumptions:
- Tilt is driven through the real `devicemotion` listener (`__tilt` dispatches DeviceMotionEvent; verified it sets `world.gravity` exactly on the desktop UA path).
- Friction 0.4 => incline hold threshold ~21.8 deg: expected floor hold at 20 deg, slide at 25 deg; wall-as-floor hold from ~68 deg (80 deg used as the wall check); lid slide at 10 deg with gravity flipped up.
- Die-die 0.1 has no isolated live discriminator; it is covered indirectly by settle/containment behavior.

Harness: /tmp/dice-lt43. Playwright via /home/phamba/repos/tarot/app. main.js spy built from the served response. Sim-time clock wraps `world.beforeStep` (the pointer drive owns it) instead of overwriting it.

Probe run (desktop 1280x800, dpr 1, box 0.08 x 0.05 x 0.05 m, default 2 d6): 9/10 checks passed.
- PASS: WebGL2 app mounted; box dims match boxFromViewport; default set 2 d6, gravity (0,0,-9.81); `__tilt` sets world gravity exactly; wrapped beforeStep callable; panel toggle reveals rows, Roll and Add d6 present; settled state NaN-free and contained; console clean.
- Under debug: "roll tosses dice (peak speed > 0.2 m/s) | peak=0.000 m/s" over 6 samples in 1.5 s sim time (see PM hint).

Planned scenarios: floor hold 20 deg (disp < 3 mm), floor slide 25 deg (disp > 3 mm, max > 10 mm, contained), wall hold at 80 deg tilt with one d6 (stops on the -y wall at z >= 16 mm), lid slide at 10 deg with gravity flipped (disp > 3 mm), roll flow, pointer drag flow, plus a short iPhone 13 run (settle, hold 20, slide 25, containment). Console audited throughout.
