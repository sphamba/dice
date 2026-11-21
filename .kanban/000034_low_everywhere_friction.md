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

Harness unchanged (Playwright via /home/phamba/repos/tarot/app, vite :8731 IPv6 localhost, devicemotion tilt, test-only createWorld spy route on /src/main.js, sim clock via world.beforeStep, frame-granular flight tracker wrapping world.update; repo code untouched). No defect cards filed so far.

Scenario results so far (behavior checks all PASS; two earlier FAILs were my own instrumentation bugs, fixed and rerun):
- probe (desktop): WebGL2 renders, tilt plumbing exact (10 deg -> gravity [1.703, 0, -9.661]), dice slide to +x wall at 10 deg (centroid 0 -> 30.7 of 40 mm half-width), settle, contained, no NaN.
- flip-desktop: +10 deg then -10 deg. Dice leave the +x wall, cross 48 mm of the 80 mm box and settle at the -x wall both ways (maxSpeed 0.0002-0.03 m/s). Core "not friction-stuck on slanted walls" check passes.
- hold-desktop and hold-phone: 4 deg tilt (below the atan(0.1) ~ 5.7 deg critical angle). Drift 0.0 mm over 6 sim-seconds on both sizes; friction still holds below the critical angle.
- slide-phone (iPhone 13, dpr 3): 10 deg along the short axis reaches the +x wall (centroid 24.5 of 33.8 mm half-width), then along the long axis reaches the +y wall (41.5 of 57.5 mm). Contained, no NaN, console clean.
- pile-phone: 6 d6 via the panel ("Show controls" + Add d6), 12 deg tilt: corner pile settles at the +x wall (5/6 dice within 15 mm of the wall, min pair distance 16.6 mm = no interpenetration), then -12 deg: the whole pile leaves the wall and settles at the -x wall (5/6). Die-die contacts un-stick under tilt on both flips.
- settle-desktop: Roll at level gravity. Instrumentation fixed (frame-granular tracker): flight maxSpeed 1.471 m/s, dice airborne to z=36 mm (rest 8 mm), then settle on the floor at z=8.0 mm with 0.0 m/s residual. Contained, no NaN, console clean.
- roll-tilt-phone: Roll under 10 deg tilt: flight maxSpeed 1.584 m/s, dice settle back on the +x side (centroid 25.8 mm), contained, no NaN.
- Console gate: zero product errors across all runs; only known SwiftShader artifacts (CONTEXT_LOST_WEBGL at load, ReadPixels GPU-stall) and vite dev-server debug chatter.

In flight when held: added a diagonal-gravity corner scenario (10 deg toward the (+x,+y) corner, the 2D-disk case) and a clean flip-desktop rerun with the corrected console-gate regex. Both about to run, then cleanup (kill vite, verify port with lsof) and the final report. No product defects found so far.
