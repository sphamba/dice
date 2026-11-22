---
name: "fix: warm-start the contact solver for resting piles"
priority: "medium"
state: "done"
worktree: ""
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
## Live test result: PASS — no product defects, no defect cards filed

Tested the deferred item only: browser feel of the tilted pile (rocking gone, settling within the iteration budget). Real user flows in an iPhone 13 context: panel adds to build a 10-dice mixed set, Roll button, gravity tilt through the real `devicemotion` input path (20 / 27 / -20 deg about the phone x axis). App served from this worktree at HEAD 6497126; verified the served `/src/physics/contacts.js` contains `contactCache` and the fixed dot-on-`cached.normal.direction` check. SwiftShader ~23 fps, ~0.63 sim-s per wall-s. Console noise whitelist (built from captured text): `[vite]` chatter, SwiftShader `GPU stall due to ReadPixels` — 0 product messages in both runs.

### Results (39/39 checks pass)

| Phase | Check | Result |
|---|---|---|
| Panel | UI adds give 10 mixed dice (d4:2 d6:2 d8:2 d10:2 d12:1 d20:1) | PASS |
| Panel | 10 bodies, 6 distinct shape groups | PASS |
| Spawn | no NaN; contained in box | PASS, PASS |
| Level 0 deg | Roll applied toss speeds (flight 1.738 m/s >= ROLL_SPEED_MIN 0.8) | PASS |
| Level 0 deg | dice come to rest (measured ~1 sim-s window; baseline ~0.4 s), rest numerically quiet (0.0000 / 0.0000) | PASS, PASS |
| Level 0 deg | no NaN; contained | PASS, PASS |
| Tilt +20 deg | rocking gone: pile at rest within 1 sim-s (final maxLin 0.0000, maxAng 0.0006 rad/s; peak window 0.0031) | PASS |
| Tilt +20 deg | corner pile at +x wall (centroid x=13.3 mm, wall 33.8 mm) | PASS |
| Tilt +20 deg | hold 5 sim-s: stays at rest, 0 drift, maxAng 0.0035 (no re-rocking) | PASS |
| Tilt +20 deg | no NaN; contained | PASS, PASS |
| Tilt +27 deg | re-settles within 1 sim-s, stays at +x wall (maxAng 0.0001) | PASS |
| Tilt +27 deg | no NaN; contained | PASS, PASS |
| Flip -20 deg | rocking gone: pile comes to rest in ~7 sim-s, angular series 28.7, 2.5, 6.0, 1.7, 1.8, 0.10, 0.03 rad/s decays to rest | PASS |
| Flip -20 deg | whole pile un-sticks and settles at -x wall (centroid x=-18.8 mm, wall -33.8 mm) | PASS |
| Flip -20 deg | 7/10 dice within 15 mm of wall; min pair distance 14.2 mm | PASS, PASS |
| Flip -20 deg | no NaN; contained | PASS, PASS |
| Roll under +20 deg | 10 mixed dice present; spawn no NaN; contained | PASS x3 |
| Roll under +20 deg | Roll applied under tilt (flight 1.908 m/s) | PASS |
| Roll under +20 deg | tossed pile comes to rest in ~2 sim-s, angular series 4.92 -> 0.01 rad/s | PASS |
| Roll under +20 deg | pile at downhill corner (centroid x=20.3 mm), 10/10 dice in wall region | PASS, PASS |
| Roll under +20 deg | hold 5 sim-s stays at rest (maxLin 0.0001, maxAng 0.0101) | PASS |
| Roll under +20 deg | no NaN; contained x2 | PASS x3 |
| Both runs | console clean (0 product messages) | PASS x2 |

Artifacts: `/tmp/dice-lt41/results-pile-mixed-tilt-phone.json`, `/tmp/dice-lt41/results-roll-tilt-mixed-phone.json` (drivers, probe and log in the same directory). Vite server on :8761 stopped and verified with lsof.

### Interpretation
- The deferred item is met in every phase: rest within 1-7 sim-s across 20/27/-20 deg tilt and under a tilted toss; angular speeds at rest are 20x-60x below the 1.2 rad/s pre-fix rocking signature and never re-grow during 5-sim-s holds.
- The 28.7 rad/s spike at the flip moment is a decaying topple/un-stick transient, not rocking: it ends at rest with no NaN and a quiet final state. Judged acceptable, not a defect.
- Level-floor settling is unchanged (settles within the first 1-s window, rest numerically quiet), so the fix does not disturb the easy case.

### Assumptions made while designing the usage tests
- Gravity tilt via emulated devicemotion is the real user flow for tilt (motion.js has no other gravity source); tilt about the phone x axis.
- "10 mixed dice" = default 2 d6 + UI adds above, all six die types present.
- "Comes to rest" threshold: max linear < 0.02 m/s and max angular < 0.05 rad/s, sampled in 1 sim-s windows (angular limit ~24x below the 1.2 rad/s rocking signature).
- No A/B against the pre-fix build: merged main equals HEAD here, and the pre-fix rocking baseline (up to 1.2 rad/s forever) is documented in the task problem statement; the test asserts the fixed behavior.
- The unit suite (`npx vitest run src/physics`) is the Specs acceptance and was left to the reviewer; this live test never runs it.
