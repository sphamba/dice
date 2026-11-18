---
name: "fix: reduce box and die friction and clamp diagonal friction correctly"
priority: "high"
state: "doing"
worktree: "fix/34-low-everywhere-friction"
issuer: "#8"
complexity: "simple"
shortName: "low-everywhere-friction"
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
