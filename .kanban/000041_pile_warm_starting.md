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
## Live test in progress (watch checkpoint) — pile warm starting, browser feel

Environment: vite dev server on :8761 serving this worktree at HEAD 6497126 (verified served `/src/physics/contacts.js` contains `contactCache` and the fixed dot-on-`cached.normal.direction` check; route-rewrite spy on `/src/main.js` exposes the world). Phone context (iPhone 13 emulation), SwiftShader ~23 fps, ~0.63 sim-s per wall-s. Tilt applied through the real input path: emulated `devicemotion` events consumed by `src/input/motion.js` (20 deg / 27 deg / -20 deg gravity tilt about the phone x axis). Console noise whitelist (from captured text): `[vite]` chatter, SwiftShader `GPU stall due to ReadPixels` — 0 product messages in both runs.

### Run 1: spawn 10 mixed dice, tilt phases (26/26 checks PASS, `/tmp/dice-lt41/results-pile-mixed-tilt-phone.json`)
- Panel flow: expand controls, add 2 d4 / 2 d8 / 2 d10 / 1 d12 / 1 d20 on top of default 2 d6 → 10 mixed dice of 6 types, live-DOM counts confirmed.
- Level baseline (0 deg): Roll applied toss speeds (flight max 1.738 m/s ≥ ROLL_SPEED_MIN 0.8), pile settles within the first 1-s window, rest state numerically quiet (maxLin 0.0000 m/s, maxAng 0.0000 rad/s). Matches the ~0.4 s problem-statement baseline at window granularity.
- Tilt +20 deg: pile slides to +x wall and is at rest within the first 1-s window (final maxLin 0.0000, maxAng 0.0006 rad/s; peak window angular 0.0031 rad/s). Corner pile at +x wall (centroid x=13.3 mm, wall 33.8 mm). Hold 5 sim-s: stays at rest, zero drift, maxAng 0.0035 — no re-rocking.
- Tilt +27 deg (upper range): re-settles within 1 sim-s, stays at +x wall (maxAng 0.0001).
- Flip to -20 deg: whole pile un-sticks, crosses the box, settles at -x wall in ~7 sim-s. Angular series per sim-s: 28.7, 2.5, 6.0, 1.7, 1.8, 0.10, 0.03 rad/s — transient spikes decay to rest. 7/10 dice within 15 mm of wall, min pair distance 14.2 mm, no NaN, contained.
- No NaN, no box protrusion (0.000 mm worst), console clean after every phase.

### Run 2: roll under +20 deg tilt — toss forms the corner pile (13/13 checks PASS, `/tmp/dice-lt41/results-roll-tilt-mixed-phone.json`)
- Roll applied under tilt (flight max 1.908 m/s); tossed 10-die pile comes to rest in ~2 sim-s, angular series 4.92 → 0.01 rad/s; 10/10 dice in the +x wall region (centroid x=20.3 mm); hold 5 sim-s stays at rest (maxLin 0.0001, maxAng 0.0101); no NaN, contained, console clean.

### Interpretation so far
- The deferred item (rocking gone, settling within the iteration budget) is met in every phase: rest within 1-7 sim-s across 20/27/-20 deg, angular speeds at rest are 20x-60x below the 1.2 rad/s pre-fix rocking signature and do not re-grow during holds.
- The 28.7 rad/s transient at the flip moment is a decaying topple/un-stick transient, not rocking: it ends at rest with no NaN and quiet final state. Judged acceptable, not a defect.
- No product defects found so far; no defect cards filed.

### Assumptions made while designing the usage tests
- Gravity tilt via emulated devicemotion is the real user flow for tilt (motion.js has no other gravity source); tilt about the phone x axis.
- "10 mixed dice" = default 2 d6 + UI adds above, all six die types present.
- "Comes to rest" threshold: max linear < 0.02 m/s and max angular < 0.05 rad/s, sampled in 1 sim-s windows (angular limit is ~24x below the 1.2 rad/s rocking signature).
- No A/B against the pre-fix build: merged main equals HEAD here, and the pre-fix rocking baseline (up to 1.2 rad/s forever) is documented in the task problem statement; the test asserts the fixed behavior.
- The unit suite (`npx vitest run src/physics`) is the Specs acceptance and was left to the reviewer; this live test never runs it.

### Remaining wrap-up after release
- Kill the vite server on :8761 and verify with lsof; final results table mapping every check to pass/harness limit/defect; finish message.
