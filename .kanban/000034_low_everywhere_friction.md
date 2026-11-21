---
name: "fix: reduce box and die friction and clamp diagonal friction correctly"
priority: "high"
state: "live-testing"
worktree: "fix/34-low-everywhere-friction"
issuer: "#8"
complexity: "simple"
shortName: "low-everywhere-friction"
changes: "{\"base\":\"main\",\"ins\":124,\"del\":15,\"files\":4}"
commits: "[{\"hash\":\"0553e31\",\"subject\":\"fix(physics): use a 2D Coulomb friction disk at mu 0.1\",\"when\":\"2026-11-18T22:58:49+01:00\"}]"
---

# Summary
Lower box and die-die Coulomb friction to 0.10 and use a true 2D friction disk so diagonal contacts cannot exceed the selected coefficient. Preserve unrelated restitution and damping.

# Specs
# Required tuning
- Set both `FRICTION_BOX` and `FRICTION_DIE` in `src/physics/contacts.js` to 0.10 (currently 0.4 and 0.3).
- Treat each contact's two tangent impulses as one 2D Coulomb friction vector. Clamp its combined magnitude to at most `mu * normalImpulse`; do not retain two independent caps that permit sqrt(2) times the requested friction on diagonal motion.

# Physics scope
- Fix the shared contact solver path used by all callers. Do not compensate with stronger world or held-body damping.
- Preserve solver iterations, restitution, Baumgarte correction, event thresholds, free-body damping and contact angular damping. Held-drag damping is handled by its separate task.
- Dice must reliably slide/tumble away from slanted walls rather than remain friction-stuck, while still settling on a level floor and remaining contained.

# Regression coverage
- Retain and adapt one-axis friction tests. Add a diagonal-tangent test proving the combined tangent impulse never exceeds 0.10 times the accumulated normal impulse.
- Add a flat sliding-contact/incline regression: friction 0.10 resists sliding below its critical angle (about 5.7 degrees) and permits sliding above it; include a case such as 10 degrees that cannot remain stuck.
- Run end-to-end world checks with mixed dice to confirm level-floor settling within the existing limit, no tunneling, no NaN state and no dice escaping the box.
- Browser live-test tilted-device or equivalent gravity on walls and die-die contacts on phone and desktop sizes.

# Acceptance commands
- `npx vitest run src/physics/contacts.test.js src/physics/world.e2e.test.js`
- `npm run build`

# Notes
## Live test in progress (held at watch checkpoint)

Harness (committed choice): Playwright from /home/phamba/repos/tarot/app/node_modules/playwright, `npx vite --port 8731` from the worktree (vite 8 binds IPv6 localhost, harness uses http://localhost). Tilt via synthetic `devicemotion` dispatch with the motion.js sign mapping; observation via test-only route rewrite of `/src/main.js` that rebinds `createWorld` to record the live world (no app behavior change, repo untouched). Sim-time clock via `world.beforeStep`. Repo code not modified.

Probe run PASSED (10/11, the one failure was the console-gate check itself, too strict):
- WebGL2 renders (no #unsupported), world spy works, 2 default d6, desktop box W=80.0 H=50.0 D=50.0 mm.
- rAF ~33-37 fps, sim speed ~0.94x real time.
- Tilt plumbing exact: 10 deg tilt gives world.gravity = [1.703, 0, -9.661].
- 10 deg tilt: dice slide to the +x wall (centroid 0 -> 30.7 mm of 40 mm half-width), settle to 0.000 m/s, contained (0.000 mm protrusion), no NaN.
- Level again: dice settle (max speed 0.0002 m/s), contained, no NaN.
- Console: only known environment artifacts (SwiftShader CONTEXT_LOST at load, ReadPixels GPU-stall warnings, vite dev-server debug chatter); zero product errors. Whitelist adjusted.

Remaining scenarios written in /tmp/dice-lt/driver.mjs (env-parameterized), not yet run:
- flip-desktop: +10 deg then -10 deg, dice must leave the wall and cross the floor both ways (the core "not friction-stuck on slanted walls" check).
- hold-desktop / hold-phone: 4 deg tilt (below atan(0.1) ~ 5.7 deg critical angle), dice must not drift.
- slide-phone: 10 deg along the short and long axis, dice reach the far wall.
- pile-phone: 6 dice, 12 deg tilt, corner pile, then flip -12 deg (die-die un-stick), interpenetration sanity.
- settle-desktop: Roll at level gravity, settle, rest on floor, lift/bounce evidence.
- roll-tilt-phone: Roll under 10 deg tilt, settle on the downhill side.

No product findings so far. No defect cards filed yet.
