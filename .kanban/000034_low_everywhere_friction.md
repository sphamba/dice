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

Plan committed: Playwright (absolute path from /home/phamba/repos/tarot/app/node_modules/playwright, chromium-1217 in ~/.cache/ms-playwright) against `npx vite --port 8731` served from this worktree. Tilt input via synthetic `devicemotion` dispatch mapped per motion.js (`IOS ? -1 : 1` sign); observation via a test-only route rewrite of `/src/main.js` that rebinds `createWorld` to record the live world instance (no app-behavior change; repo untouched).

Done so far:
- Read TASK.md; the deferred item is: browser check of tilted-device gravity on walls and die-die contacts at phone and desktop sizes, plus level-floor settling, containment, no tunneling/NaN.
- Code inspection for the flows under test: contacts.js (FRICTION_BOX/DIE = 0.10, 2D Coulomb disk in solveFriction), world.js (containBody, FIXED_DT 1/480, MAX_STEPS 16, MAX_FRAME_DT 0.1), motion.js (devicemotion → deviceToWorldGravity, MAX_GRAVITY 4g), panel.js (Roll button, Add/Remove d6 rows, DEFAULT_SET 2x d6), body.js (DIE_RADIUS = 0.016*sqrt(3)/2 ≈ 13.86 mm), integrator.js (LINEAR_DAMPING 0.1, ANGULAR_DAMPING 0.2 preserved).
- Planned scenarios: probe (WebGL2, spy, devicemotion plumbing, fps, console audit); tilt slide/flip at 10 deg on desktop and phone (dice must leave a wall and cross the floor both ways); tilt hold at 4 deg below the atan(0.1) ≈ 5.7 deg critical angle (no drift); die-die pile of 6 dice under 12 deg tilt with flip (phone); level-floor roll settling; tilted roll with audio/haptics path. Checks: dice reach the far wall, no drift below critical angle, containment (per-vertex), no NaN, settled speeds, no tunneling, console clean.

No test run has completed yet; no findings so far. Test scenarios are written and about to execute after release.
