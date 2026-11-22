---
name: "fix: warm-start the contact solver for resting piles"
priority: "medium"
state: "reviewing"
worktree: "fix/41-pile-warm-starting"
issuer: "#40"
complexity: "moderate"
shortName: "pile-warm-starting"
splitter: "done"
---

# Summary
Persist solved contact impulses across steps and reuse them to warm start the solver, so coupled contacts in a resting pile converge within the fixed iteration budget instead of rocking forever.

# Specs
# Problem
- With tilted gravity (15-30 degrees), 10 mixed dice form a corner pile that never comes to rest (angular speed up to 1.2 rad/s forever). A level floor settles in about 0.4 s.
- Cause (measured in a copy of the engine): contact impulses restart at zero every step (no warm starting), so 10 iterations cannot converge 20-40 coupled contacts. More substeps with fewer iterations, soft contacts and a relax pass were tested and did not fix it.

# Scope
- Files: `src/physics/contacts.js`, plus contact data from `src/physics/collision.js` if needed, and `src/physics/contacts.test.js`.
- Do not edit `src/physics/world.js` or `src/input/*`; another subtask owns the whole-world sleep there.
- Keep friction at 0.10. Do not change friction, restitution, Baumgarte, SOLVER_ITERATIONS or FIXED_DT. Do not add module-level mutable state.

# Warm starting
- `detectContacts` clears `world.contacts` every step, so the solved impulses must be snapshotted to a separate field on the world object (not module state), written by `solveContacts` at the end of a solve.
- For each new contact, find the old contact with the same body pair and surface whose point is within 1 mm and whose normal agrees (dot > 0.99).
- Start the new accumulated normal impulse at the old value and apply it before the iterations. Project the old friction impulse onto the new tangent directions, clamp it to the friction disk of the warm-started normal impulse, and apply it.
- A contact with no match starts at zero, as today.

# Tests (add to `src/physics/contacts.test.js`)
- A matched contact starts with the old normal impulse.
- An unmatched contact starts at zero.
- All existing physics tests stay green.

# Acceptance criteria
- `npx vitest run src/physics`

# Notes
## Deliverable
- `src/physics/contacts.js`: `solveContacts` caches the prepared contacts with their solved impulses in `world.contactCache` and clears it on a step without contacts. Each new contact warm starts from the cached contact with the same body pair and surface, point within `WARM_START_DISTANCE` (1 mm) and normal dot above `WARM_START_NORMAL_DOT` (0.99): the normal impulse starts at the old value and is applied before the iterations, the old friction impulse is projected onto the new tangents and clamped to the friction disk of that normal impulse.
- `warmStartImpulses` is exported as the pure matching and clamping decision so the tests can assert the starting values.
- No change to friction, restitution, Baumgarte, `SOLVER_ITERATIONS`, `FIXED_DT`, `world.js` or `src/input/*`. No module-level mutable state.

## Verification
- HEAD `147d43a`; `npx vitest run src/physics` → 8 files, 80 tests passed.
- `npm run build` green; `dist/index.html` references `./assets/index-BIsGiyBQ.js` and `./assets/index-DA_12YQk.css`.
- Probe, 10 mixed dice, 20 degrees tilted gravity, 5 s, max angular speed: HEAD 0.082 / 0.112 / 1.347 rad/s at 3 / 4 / 5 s, with the change 0.019 / 0.020 / 0.016 rad/s. The reported rocking is gone and the pile stays settled.

## Assumptions
- The cache holds the step's prepared contact objects, so the cached shape is `{a, b, surface, point, normal: {direction, impulse}, tangents: [{direction, impulse}]}`.
- The restitution target is computed before the warm start is applied, so the approach speed of the step is unchanged by warm starting.
- Matching reads the new contact normal for its tangent basis, which agrees with the prepared tangent directions.

## Blockers
- None.

## Manual checks left to other roles
- Live feel of the tilted pile in the browser.
