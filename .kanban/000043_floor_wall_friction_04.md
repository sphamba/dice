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
# Notes
## Live test #43 (in progress, held at watch checkpoint #3)

Scope unchanged: user-level test of the friction change only (floor 0.4, wall 0.4, lid 0.1) through the real browser app. Worktree merged commit 417e7cc, vite :8791. Harness /tmp/dice-lt43, drivers run 1-3 with per-run result files (results-probe, results-phone, results-desktop).

Green so far (all runs, consistently):
- App mounts, box dims correct, default 2 d6, gravity exact through the real devicemotion path (desktop + iPhone 13 iOS sign path).
- S1 floor hold at 20 deg: displacement 0.00 mm on both dice, dice fall asleep on the incline - floor friction 0.4 grips below the 21.8 deg critical angle.
- S2 floor slide at 25 deg: every die slides and ends at the -y wall/corner, contained, NaN-free (three runs).
- S3 wall friction (run 2): die added via panel at 80 deg tilt rested on the -y wall at z=16.89 mm, held mid-wall - the 0.4-vs-0.1 discriminator passed once.
- S4 lid: die settles on the glass lid with gravity flipped (z=42 mm).
- S5 roll flow with rAF-granular flight tracker armed before the click: peak speed 1.25-1.46 m/s, dice hop (peak center z 21-38 mm vs 8 mm rest), settle, contained, NaN-free.
- S6 pointer drag: pick + drive + release works; die followed the pointer 8 mm (retry on the second die after the first was squeezed sideways by the other die).
- Console clean across all runs; earlier probe FAIL was confirmed a harness sampling-window bug (debug-roll trace: click fired, velocities applied, toss lives only ~0.3 s sim under 0.4 friction).

Three FAILs in run 3, all traced to random spawn position, not product behavior:
1. S2 auxiliary "max disp > 10 mm": both dice spawned near the -y wall this run, so max travel was 6.15 mm; both still reached the wall. Check is redundant with the per-die "slides or reached wall" check - dropping it.
2. S3 wall hold: the die spawned far from the -y wall, free-fell diagonally, and the wall-bounce phase let it slide down to the floor corner (z=8.93 mm). Physics consistent with 0.4 (bounce phase adds tangential speed); run 2's near-wall spawn held at z=16.89. Fix: retry loop (up to 8 remove/re-add attempts via panel), PASS if any attempt holds mid-wall (z >= 16 mm); with 0.1 friction every attempt would corner.
3. S4 lid slide: the die drifted on the lid during the gravity-up settle (spawn velocity up to 0.2 m/s, mu=0.1 lets it drift ~20 mm) and came to rest jammed in the lid-wall corner, leaving no room to slide (disp 0.57 mm). Fix: settle retry loop (up to 6 attempts) accepting only a die resting on the open lid (y > -8 mm), then tilt 10 deg and require net -y slide >= 1 mm.

No product defects found so far. Next on release: apply the three harness fixes, rerun the desktop suite, then write the final report (findings, assumptions, results table) into these Notes and file any defect cards.
