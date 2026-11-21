---
name: "fix: reduce box and die friction and clamp diagonal friction correctly"
priority: "high"
state: "done"
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
## Live test report: PASS, no defects filed

Tested only the change of this task in a real browser run of the app from the worktree (vite dev server, Playwright chromium): tilted-device gravity on walls, die-die contacts, phone and desktop sizes, level-floor settling, containment, tunneling, NaN. Repo code was not modified.

### Harness
- Playwright from /home/phamba/repos/tarot/app/node_modules (chromium-1217), `npx vite --port 8731` from this worktree. Phone = iPhone 13 descriptor (390x844 CSS, dpr 3, iPhone UA, so the iOS sign branch of deviceToWorldGravity runs; box 67.5x146x67.5 mm). Desktop = 1280x800, dpr 1 (MIN_BOX_EDGE guard active; box 80x50x50 mm).
- Tilt input: synthetic `devicemotion` events with accelerationIncludingGravity mapped through the app's own motion.js math (10 deg tilt verified to yield world.gravity [1.703, 0, -9.661] exactly; screen angle 0).
- Observation: test-only route rewrite of `/src/main.js` that rebinds `createWorld` to record the live world instance, plus a frame-granular flight tracker wrapping `world.update` and a sim-time clock via `world.beforeStep`. No app behavior changed.

### Results (all checks PASS)
- Tilt slide, desktop, 10 deg then -10 deg (core friction-stuck check): dice leave the +x wall, cross 48-58 mm of the 80 mm box and settle at the -x wall both ways; final speeds 0.0000-0.0002 m/s. A die at 10 deg cannot stay stuck (tan(10)=0.176 > mu=0.1) and the run confirms it behaviorally.
- Tilt slide, phone, 10 deg along both axes: dice slide the short axis to the +x wall (centroid 24.5 of 33.8 mm half-width) and the long axis to the +y wall (41.5 of 57.5 mm), settle, contained, no NaN.
- Tilt hold, desktop and phone, 4 deg (below the atan(0.1) ~ 5.7 deg critical angle): drift 0.0 mm over 6 sim-seconds on both sizes; friction 0.10 still holds below the critical angle.
- Diagonal gravity, desktop, 10 deg toward the (+x,+y) corner: dice settle in that corner (18.8 mm from the corner), exercising the 2D friction disk path behaviorally.
- Die-die pile, phone, 6 d6 via the real panel flow ("Show controls" + "Add d6"), 12 deg tilt: corner pile at the +x wall (5/6 dice within 15 mm of the wall, min pair distance 16.6 mm, no interpenetration, settled at 0.001 m/s); flipping to -12 deg moves the whole pile to the -x wall (5/6). Dice do not stick to each other or to walls under tilt.
- Level-floor settling, desktop: Roll via the button; flight tracker saw roll velocities 1.471 m/s (ROLL_SPEED range 0.8-1.6) and dice airborne to z=36 mm above the 8 mm rest height (lift, bounce, restitution alive), then all dice settle at z=8.0 mm (d6 face rest) with 0.0 m/s residual.
- Tilted roll, phone, 10 deg: roll velocities 1.584 m/s, dice settle back on the downhill +x side, contained, no NaN.
- Containment/tunneling/NaN: after every phase of every scenario, all shape vertices inside the box (worst protrusion 0.000 mm), all state finite.
- Console: zero product errors across all runs; only known headless SwiftShader artifacts (CONTEXT_LOST_WEBGL at load, ReadPixels GPU-stall warnings) and vite dev-server debug chatter.

### Assumptions
- "Tilted-device gravity" was driven through the real devicemotion listener and mapping code; only event trust differs from a physical device, which the app ignores.
- Settle threshold 0.03 m/s is above observed rest noise (0.0000-0.0010 m/s).
- Impulse-level diagonal saturation (exactly mu*N at all tangent angles) was verified by the reviewer's numeric probe; this live test verifies the behavior end to end (diagonal corner, pile un-stick).

### Environment notes
- Vite 8 binds IPv6 localhost; 127.0.0.1 refused connections (harness uses http://localhost:8731). Server killed after testing, port verified free with lsof.
- Headless SwiftShader renders at ~33-37 fps; simulation ran at ~0.94x real time; all waits were sim-time based.
- Two early check failures were test-harness instrumentation bugs (sim-time target computed in Node as NaN; maxZ sampled only post-settle), fixed and rerun green; they were not product behavior.
- No open questions.
