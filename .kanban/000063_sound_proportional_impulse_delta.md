---
name: "feat: emit impact impulse as the delta over the warm start"
priority: "high"
state: "live-testing"
worktree: "feat/63-sound-proportional-impulse-delta"
issuer: "#62"
complexity: "simple"
shortName: "sound-proportional-impulse-delta"
changes: "{\"base\":\"main\",\"ins\":113,\"del\":2,\"files\":2}"
commits: "[{\"hash\":\"0496435\",\"subject\":\"feat: emit the impact impulse as the delta over the warm start\",\"when\":\"2026-11-22T22:16:23+01:00\"}]"
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
- Live test of #63, full run complete (results /tmp/dice63-lt/out/results-full1-EUDLS.json, run-full1.log). All task-relevant gates GREEN; one harness-side FAIL under classification.
- E env: HTTP 200 (/, main.js, world.js); world spy alive; default set spawns 2 d6; sim-rate ratio 0.508; event field shape exactly {a,b,impulse,point,speed,surface} (scope limit holds); 25 spawn events all finite impulse >= 0; render screenshot /tmp/dice63-lt/out/env-view.png healthy (two settled d6, panel + roll UI); console clean.
- U real-UI flow: rest after spawn emits ZERO events over 1.2 sim s (no phantom crackle); panel + spawns a die (28 impact events, finite); panel Roll emits a 63-event impulse burst, all finite, impulse >= 0, speed > EVENT_MIN_SPEED; rest after roll zero events; console clean.
- D fresh flat d6 drop at 2 m/s: impulse = m(1+e)*speed with the event's own speed to rel -0.00% (7.6253e-3 vs 7.6253e-3 N*s, m = 2.5166e-3 kg measured live). Fresh pairs keep warmNormal 0, so the fix leaves them unchanged - confirmed.
- L loaded pair (B resting flush on A, kick -0.3 m/s while world awake and warm): exactly one die-pair event, impulse 7.6012e-4 vs new-impulse-only m*0.3 = 7.5497e-4 (rel +0.68%, gate 3%) and hard-bounded below m*0.31; old semantics would read m*(0.3+g*dt) = 8.0641e-4 (+6.8%) - excluded. Rest of the kick window silent; zero events while the loaded pair rests.
- The one FAIL is my own expectation formula, not a task gate: event.speed for the warmed kick read 0.29999 m/s where I predicted 0.3 + g*dt = 0.32044 (delta exactly g*dt); the fresh drop's speed read 2.0200 vs predicted 2.02044 (delta 0.00044). Speed semantics are not part of this change (haptics consume it, untouched). One probe planned (in-page beforeStep velocity trace around the kick) to classify wrong-expectation vs app behavior before wrap-up; impulse verdicts are unaffected.
- No defects filed so far; task state untouched.
