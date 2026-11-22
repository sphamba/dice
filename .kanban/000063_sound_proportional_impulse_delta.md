---
name: "feat: emit impact impulse as the delta over the warm start"
priority: "high"
state: "done"
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
# Live test report (#63)

## Scope and method
Tested the merged commit 0496435 in the worktree via headless Chromium (Playwright, software WebGL) against the vite dev server. Physics was exercised through the real app: the world spy exposes the real `world`, events, and step counter; every scenario places drives-to-target UI d6 and lets the real solver and the real event emission run. No audio output was gated (AudioContext headless); the impulse-to-gain mapping belongs to the parallel audio subtask. Event shape was asserted key-exact. Evidence: /tmp/dice63-lt/out/results-full1-EUDLS.{json,md}, run-full1.log, env-view.png, probe trace (kick step 1940, entry v=-0.3, event on that step).

## Setup facts (measured live, not from source alone)
- Event field shape exactly `{a,b,impulse,point,speed,surface}` at every step of the full run; scope limit holds.
- Die mass m = 2.5166e-3 kg (1/invMass measured through the spy); floor events surface "floor", die-pair events surface "die".
- Event growth and window gates used `EVENT_MIN_SPEED = 0.05` from source; impact burst windows sized from the measured sim-rate ratio 0.508.

## Results
| Check | Result |
| --- | --- |
| E: page and modules serve HTTP 200; world spy alive | PASS |
| E: default set spawns 2 d6; sim-rate ratio 0.508 | PASS |
| E: 25 spawn events, all finite impulse >= 0 | PASS |
| E: render screenshot healthy (settled d6, panel + Roll UI); console clean | PASS |
| U: rest after spawn emits ZERO events over 1.2 sim s (no phantom crackle from warm load) | PASS |
| U: panel + spawns a die (28 impact events, finite) | PASS |
| U: panel Roll emits a 63-event impulse burst, all finite, impulse >= 0, speed > EVENT_MIN_SPEED | PASS |
| U: rest after roll emits zero events; console clean | PASS |
| D: fresh flat d6 drop at 2 m/s: impulse = m(1+e)*speed, rel -0.00% (7.6253e-3 N*s) | PASS |
| D: impact speed sanity (2.0200 m/s = (2 + g*dt) with damping) | PASS |
| L: kick (-0.3 m/s) on loaded pair B-on-A fires exactly one die-pair event while awake and warm | PASS |
| L: impulse 7.6012e-4 vs new-impulse-only m*0.3 = 7.5497e-4 (rel +0.68%, gate 3%) | PASS |
| L: hard bound excludes warm load (below m*0.31; old semantics m*(0.3+g*dt) = +6.8% excluded) | PASS |
| L: pre-kick rest silence; kick window silent elsewhere; B resumes resting on A (no drift) | PASS |
| S: console clean at end of run | PASS |
| harness: my warmed-kick speed expectation (see below) | FAIL - classified harness limit, not a defect |

## Assumptions
- Verified through emitted physics events; sound output not gated (parallel audio subtask owns gain mapping).
- Unit fixtures' relations (fresh drop = m(1+e)v; loaded pair = new impulse only) are the intended live-observable behavior; live tolerances loosened from unit 1% to 2-3% (frame batching, spin residuals).
- Placement through the world spy (drive-to-target) is acceptable setup; impacts still run the real solver and emission.
- Headless: no device motion, gravity stays 9.81; AudioContext blocked (whitelisted).

## Environment problem
Playwright browser revision mismatch against the global install; resolved by importing playwright-core from a repo-local install (/home/phamba/repos/tarot/app/node_modules). No project action needed.

## Harness limit (not a defect)
My expectation formula for `event.speed` on a warmed contact was wrong: live reads 0.29999 m/s for a -0.3 m/s kick (approach measured over the warm start, plus contact-point spin), while a fresh drop reads impact + g*dt with damping (2.0200). Raw trace: kick effective at step 1940 entry (v=-0.3), event emitted on that step. `event.speed` is untouched by this change (the diff only records warmNormal and changes the impulse lines), haptics consume it unchanged, and no task gate depends on it. Observation for the audio subtask: on warmed pairs event.speed reads the post-warm approach (about the kick speed), on fresh contacts it includes in-step gravity.
