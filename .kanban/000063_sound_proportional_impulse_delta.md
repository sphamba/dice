---
name: "feat: emit impact impulse as the delta over the warm start"
priority: "high"
state: "merging"
worktree: "feat/63-sound-proportional-impulse-delta"
issuer: "#62"
complexity: "simple"
shortName: "sound-proportional-impulse-delta"
---

# Summary
Change the physics event emission so `event.impulse` is the new impulse of the impact: the sum over the pair's contacts of `max(0, finalNormalImpulse - warmNormalImpulse)`, instead of the accumulated normal impulse that includes the resting load.

# Specs
## Need
Impact sound intensity must be proportional to the impulse of the impact. This subtask changes what `event.impulse` means so it measures the new impulse of the impact, not the accumulated normal impulse. Decision: `event.impulse` = sum over the pair's contacts of `max(0, finalNormalImpulse - warmNormalImpulse)`.

## Facts (main, 6d593ef)
- `src/physics/contacts.js:295-306` emits one event per pair and step; `group.impulse` accumulates `contact.normal.impulse` over the group's contacts (`:296`).
- The warm start sets `prepared.normal.impulse = warm.normal` at `contacts.js:164` and applies it to the bodies, so a resting contact carries `m*g*dt` in the accumulated impulse today.
- Sole consumer of `event.impulse` outside this file: `src/audio/sound.js:119` (`gainForImpulse`). Haptics use `event.speed` (`src/audio/haptics.js:22`) and stay untouched. A parallel subtask reworks the audio gain against the new semantics; nothing to do there.

## Change
1. Record each prepared contact's warm-start normal impulse where the warm start applies it (`contacts.js:164` region).
2. At event emission, `event.impulse` = sum over the group's contacts of `max(0, contact.normal.impulse - warmNormalImpulse)`.
3. Do not change the solver result: warm-start application, accumulators, restitution and all body motion stay identical. The recorded warm value must not feed back into the solver.

## Scope limits
Do not change physics constants, mode tables, or the event shape (fields stay the same). Do not touch `src/audio/`.

## Tests
In `src/physics/contacts.test.js`:
- A resting contact emits an impact impulse near 0.
- A flat d6 drop at 2 m/s emits `m(1+e)v` within 1%.
- A new impact on a loaded pair emits only the new impulse.
- A seeded world run gives the same body states before and after the change.

## Acceptance
- `npx vitest run src/physics` passes.
- `npm test` passes.
- `npm run build` passes.

# Notes
- Outcome: approved. Diff (main...0ae92be) touches only src/physics/contacts.js and src/physics/contacts.test.js; scope limits hold: no physics constants or mode tables changed, event shape unchanged, src/audio untouched, sound.js:119 stays the sole external consumer of event.impulse.
- Specs mapped: warmNormal recorded where the warm start applies (contacts.js:104 init to 0, :164 record); event.impulse = sum over the pair's contacts of max(0, normal.impulse - warmNormal) (contacts.js:300), matching the decision formula exactly.
- warmNormal has a single read site, the emission loop; the solver path is otherwise untouched.
- A/B against base contacts.js: the resting and loaded-pair tests go red (2 failed) under the old semantics while the fresh-drop and seeded-run tests stay green, so the new tests test the delta and the hard-coded seeded states are identical pre and post change.
- Verification: npx vitest run src/physics 127 passed, npm test 371 passed, npm run build 30 modules transformed.
- The developer's three stated assumptions check out in code: fresh contacts keep warmNormal 0 (prepare init plus cache-miss path returns normal 0), non-growing warmed pairs emit 0, and the resting test's 30 m/s^2 gravity clears EVENT_MIN_SPEED (g*dt = 0.0625 > 0.05).
- No fixes needed; live GL, sound, and feel remain the live-tester role's scope.
