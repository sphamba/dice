---
name: "feat: emit impact impulse as the delta over the warm start"
priority: "high"
state: "to-review"
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
- `src/physics/contacts.js`: each prepared contact records `warmNormal` where the warm start replays the cached normal impulse; `event.impulse` is now the sum over the pair's contacts of `max(0, normal.impulse - warmNormal)`.
- Solver untouched: warm-start application, accumulators, restitution and body motion are identical. The seeded-state test pins that.
- Tests added in `src/physics/contacts.test.js` (describe `impact impulse`), written first and seen red for the delta semantics: fresh flat drop at 2 m/s emits `m(1+e)v` within 1%; a resting contact under 30 m/s^2 (approach g*dt = 0.0625, above EVENT_MIN_SPEED, so the pair emits) carries its full load in the accumulator but emits below 1e-6 of it; a loaded die pair (warm load 5e-4) emits only the new impulse, with the accumulated 4.9152e-3 unchanged; a seeded 3-die run of 0.5 s pins body positions and velocities.
- Assumption: `warmNormal` stays 0 for a fresh contact, so a fresh impact keeps its full impulse.
- Assumption: a warmed pair whose solver impulse does not grow now emits 0, so `gainForImpulse` in `src/audio/sound.js` reads 0 there. Untouched, per specs; the audio subtask owns the new gain curve.
- Assumption: the resting-contact check needs the higher gravity because EVENT_MIN_SPEED suppresses the event below 0.05 m/s of approach.
- Verification at HEAD 0ae92be: `npx vitest run src/physics` 127 passed, `npm test` 371 passed, `npm run build` built 30 modules.
- No live check run here: the change is pure physics state, no UI path, and impact loudness is verified by the audio subtask and the live-tester role.
