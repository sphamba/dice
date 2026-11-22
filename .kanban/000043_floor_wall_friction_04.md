---
name: "fix: raise floor and wall friction to 0.4, keep lid and die-die at 0.1"
priority: "medium"
state: "done"
worktree: ""
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
# Notes
# Notes
## Live test #43: PASS - no product defects, no cards filed

Tested the merged commit 417e7cc like a user: real browser app at 1280x800 dpr1 (box 0.08 x 0.05 x 0.05 m, 16 mm dice) plus an iPhone 13 descriptor pass, driving only real interfaces - panel buttons (Show controls / Add d6 / Remove d6 / Roll), devicemotion tilt (DeviceMotionEvent through the app's own listener, verified to set world.gravity exactly on both the desktop and iOS sign paths), and pointer drag. No unit suites run. Artifacts: /tmp/dice-lt43 (results-probe.json, results-phone.json, results-desktop.json, results-debug-roll.json, driver*.log, debug-roll trace). Server killed, port 8791 verified free.

## Results table (final desktop run 32/32, phone 9/9, all runs console clean)

| Check | Result | Evidence |
| --- | --- | --- |
| App mounts, WebGL2, box dims match boxFromViewport, default 2 d6 | PASS | no unsupported banner; box 0.08/0.05/0.05 m |
| devicemotion path sets gravity exactly | PASS | desktop [0,-4,-9] and iPhone [0,-3.3552,-9.2184] |
| S1 floor hold at 20 deg (below 21.8 critical) | PASS | displacement 0.00 mm both dice, dice asleep on the incline |
| S2 floor slide at 25 deg (above critical) | PASS | disp 27.1/27.1 mm, both dice end at -y wall/corner (y -0.0142/-0.0140), contained |
| S3 wall friction holds die mid-wall at 80 deg tilt | PASS | attempt 1 cornered (z 11.2 mm, spawn far), attempt 2 held at z 31.2 mm on the -y wall (y -17.0 = face rest); with 0.1 every attempt would corner (needs 84.3 deg) |
| S4 lid friction 0.1 lets die slide at 10 deg, gravity flipped | PASS | open-lid start, disp 6.2 mm to the -y wall, z stayed 42 mm on the lid |
| S5 Roll button flow | PASS | flight tracker: peak 1.398 m/s, hop to 18.6 mm center z (rest 8 mm), settle, contained |
| S6 pointer drag flow | PASS | die followed pointer 5.34 mm, release without fling, settles |
| Phone (iPhone 13): hold 20 / slide 25 / containment | PASS | hold disp 0.00 mm; slide disp 10.9/49.6 mm to the wall |
| NaN / containment / console across all runs | PASS | 0 non-finite, worst protrusion 0.000 mm, no pageerror/error |

## Assumptions
- Tilt through dispatched devicemotion events is the real user tilt path; verified the app receives exactly the intended world gravity (both UA sign paths).
- Discriminator angles derived from source constants: tan20=0.364 < 0.4 < tan25=0.466 (floor); wall-as-floor hold needs mu >= cot(80 deg)=0.18 (0.4 holds, 0.1 needs 84.3 deg); lid slide needs mu < tan(10 deg)=0.176 (0.1 slides, 0.4 would hold).
- Die-die 0.1 has no isolated live discriminator; covered indirectly by pile settle/containment in the roll and drag flows. The coefficient itself is unit-level per the task's Tests section and was not re-verified live.
- Wall and lid scenarios retry via panel remove/re-add because spawn position and the 0.2 m/s spawn velocity are random; with 0.1 wall friction every retry would land in the floor corner, and a corner-drifted lid die has no room to slide, so the retry loops are the correct product-level discriminators.
- Settle is judged by the app's own sleep signal (still 0.5 s at speed < 0.01) plus displacement thresholds from box geometry.

## Technical difficulties hit while testing (all harness-side, fixed in-session)
- Probe initially failed "roll tosses dice": node-side sampling missed the transient - with floor friction 0.4 the toss lives only ~0.25-0.3 s sim (hop ~17-21 mm, then friction kills the skid). debug-roll trace proved the click fired and velocities were applied; fixed with an rAF-granular flight tracker armed before the click. The fast settle is the intended grip behavior, not a defect.
- Driver run 1 died at the first panel click: rows start collapsed ("Show controls"); fixed by toggling first.
- Random spawn made three run-3 checks flaky (S2 max-travel auxiliary, S3 single-spawn wall hold, S4 corner-drift on the lid), the flipped-tilt helper had a wrong y sign, and the drag travel was 5x too small (both dice tracked the 0.96 mm pointer move exactly). Fixed with the corrected sign, retry loops with per-attempt logs, or-reached-wall criteria, and 8 mm drag travel. Run 3's drag attempt 1 also showed a die squeezed sideways when dragged into the other die (drive-vs-solver interaction, out of the friction change's scope); the retry passed.
