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
- Live test of #63 in progress (worktree 0496435, emission site contacts.js:297-301 confirmed carrying the delta-over-warm-start formula).
- Scope fixed: event.impulse semantics only; audio gain rework is the parallel subtask, haptics untouched; no unit suites run.
- Harness choice committed: vite dev :48317 + playwright-core (/tmp/pw-live) headless Chromium, route-wrapped src/physics/world.js exposing __diceWorld (precedent /tmp/dice32-lt), in-page rAF snapshot of world.events after the app frame (events clear next frame), world.step counter for the sim clock, console whitelist, results writer in /tmp/dice63-lt/out.
- Constants table (source): FIXED_DT=1/480 s; g=9.81 m/s^2; RESTITUTION_BOX=RESTITUTION_DIE=0.5; EVENT_MIN_SPEED=0.05 m/s; WARM_START_DISTANCE=1e-3 m; SLOP=2e-4 m; DIE_DENSITY=1200; d6 half-diagonal r=0.011085 m, face half-width c=0.0064 m; mass measured live via invMass.
- Observation plan: sim clock = stepCount/480; kick armed in-page (race-free against world sleep at 0.5 s sim: sleep() nulls contactCache, so the kick must land while awake and warm).
- Phases: E env+smoke (render screenshot, console clean, event field shape {a,b,surface,point,speed,impulse} unchanged); U real-UI flow (default 2 d6 spawn, settle -> zero events at rest, panel Roll -> burst of finite impulse >= 0 events, +1 die via panel); D fresh flat d6 drop at 2 m/s -> impulse ~= m(1+e)*speed within 2% (fresh pairs keep warmNormal 0, so the fix must not change them); L loaded pair (B resting flush on A, kick -0.3 m/s while world awake) -> impulse ~= m*0.3 within 3% and hard bound < m*0.31, which the old semantics m*(0.3+g*dt)=+6.8% would fail; rest windows emit zero events (no phantom crackle).
- No findings yet; no defects filed; task state untouched.
