---
name: "fix: warm-start the contact solver for resting piles"
priority: "medium"
state: "live-testing"
worktree: "fix/41-pile-warm-starting"
issuer: "#40"
complexity: "moderate"
shortName: "pile-warm-starting"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":152,\"del\":3,\"files\":2}"
commits: "[{\"hash\":\"6497126\",\"subject\":\"fix(physics): compare cached normal directions for warm-start matching\",\"when\":\"2026-11-22T02:07:20+01:00\"},{\"hash\":\"147d43a\",\"subject\":\"fix(physics): warm start the contact solver from the previous step\",\"when\":\"2026-11-22T02:03:06+01:00\"}]"
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
## Review outcome: fixed

- Violation found and fixed in commit 6497126: `findCached` passed the prepared `{direction, impulse}` object to `vec3.dot` instead of `cached.normal.direction`, so the dot check evaluated to NaN and `NaN <= 0.99` never rejected. Any contact with the same body pair, surface and point within 1 mm warm started regardless of normal (probe: cached normal [1,0,0], fresh [0,0,1] still carried the 0.02 impulse). Hit hardest for die-die contacts whose normals change between steps. Fixed to compare `cached.normal.direction` and added a regression test for the disagreeing-normal case.
- Rest matches the Specs: cache lives on `world.contactCache` (prepared objects mutated in place, so end-of-solve impulses), matching uses pair + surface + 1 mm point + dot > 0.99, normal impulse applied before the iterations, friction projected onto the new tangents and clamped to the friction disk, unmatched contacts start at zero, cache cleared on contact-less steps, no changes to friction, restitution, Baumgarte, iterations, dt, world.js or input, no module-level mutable state.
- Verified after the fix: `npx vitest run src/physics` → 8 files, 81 tests passed; `npm run build` green; probe confirms the dot filter now rejects orthogonal normals.

## Guidance for future reviewers

- When a Spec names a numeric match predicate, probe it with an off-by-construction input (for example orthogonal normals) instead of trusting fixtures that mirror the production shape; here the fixtures reproduced the bug's blind spot and all tests stayed green.

## Deferred to live testing

- Browser feel of the tilted pile (rocking gone, settling within the iteration budget).
