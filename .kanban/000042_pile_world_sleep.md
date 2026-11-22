---
name: "fix: whole-world sleep that freezes and wakes the dice world"
priority: "medium"
state: "live-testing"
worktree: "fix/42-pile-world-sleep"
issuer: "#40"
complexity: "moderate"
shortName: "pile-world-sleep"
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":183,\"del\":2,\"files\":2}"
commits: "[{\"hash\":\"bdf6809\",\"subject\":\"fix(physics): sleep the whole world once every die is still\",\"when\":\"2026-11-22T02:14:20+01:00\"}]"
---

# Summary
Freeze the whole world once every die is still and wake it on every input, so settled dice cost nothing and stay settled until the user acts.

# Specs
# Problem
- Dice that have come to rest keep integrating every step, and any residual motion (rocking piles) is visible forever. A whole-world sleep freezes all dice once they are still.

# Scope
- Files: `src/physics/world.js` and `src/physics/world.test.js`. Read `src/input/pointer.js` to get the held-die semantics right.
- Do not edit `src/physics/contacts.js`, `collision.js` or `src/input/*`; another subtask owns contact warm starting.
- Do not add a low-pass filter on the accelerometer input in `src/input/motion.js`.
- Do not change friction, restitution, Baumgarte, SOLVER_ITERATIONS or FIXED_DT.

# Sleep (`src/physics/world.js`)
- After each step, compute the fastest die point speed `max(|v| + DIE_RADIUS*|w|)` over all bodies (`DIE_RADIUS` lives in `src/physics/body.js`).
- When it stays below `SLEEP_SPEED = 0.01 m/s` for `SLEEP_TIME = 0.5 s` of simulated time, set every velocity to zero and mark the world asleep. While asleep, `step` returns at once (no integration, no contacts, no events).
- The world wakes, and the sleep timer restarts, on each of these:
  - a held die (pointer grab or drag through the `beforeStep` drive of #33). A grab must always move the die at once.
  - any body with a non-zero velocity (Roll, Space, fling),
  - `addBody`, `removeBody` and `setBox` (resize),
  - a gravity change of more than 0.5 m/s^2 from its value at sleep time.
- Held-die semantics: `src/input/pointer.js` sets `world.beforeStep = drive` once and only clears it in `destroy()`, so the drive callback stays set when no die is held. The wake condition must be "a die is held" (the held set is non-empty), not "a callback exists", or the world never sleeps. Check what state the drive exposes to detect a hold (for example the `held` map or the `heldBodies` accessor) and pick the cheapest reliable signal.

# Tests (add to `src/physics/world.test.js`)
- The world sleeps after 0.5 s below the threshold.
- Each wake condition wakes it: held die, non-zero velocity, addBody, removeBody, setBox, gravity change above 0.5 m/s^2.
- A gravity change below 0.5 m/s^2 does not wake it.
- While asleep, `step` does no integration, no contacts and no events.
- All existing physics tests stay green.

# Acceptance criteria
- `npx vitest run src/physics`

# Notes
Live test in progress (watch checkpoint). Setup: worktree served with `npx vite --port 8772` from cwd; headless Chromium 1280x800, SwiftShader GL flags, 24 fps measured (sim runs ~0.8x wall); createWorld exposed via route-rewrite spy on served main.js; in-page __sample/__tilt/__screen helpers; harness in /tmp/dice-lt42 (adapted from the lt41 harness). Environment probe passed: synthetic devicemotion dispatch changes world.gravity through the app's own deviceToWorldGravity path (desktop sign=+1), grab lifts a die, screenshots non-blank (sd 0.178).

Results so far (17/20 checks, results-world-sleep.json):
- PASS load: default 2 d6 spawn; world asleep=false initially.
- PASS sleep: world sleeps ~0.9 s wall after the dice settle; velocities exactly zero.
- PASS frozen: settled pile bit-identical over 2 s (position and quaternion drift exactly 0), stayed asleep the whole window, events stayed empty, render pixel-identical (AE=0 between screenshots 1 s apart).
- PASS grab: grabbing a sleeping die moves it at once (14.2 mm displacement within ~0.9 s of mousedown, dz +14.1 mm lift toward hold height), world wakes; re-sleeps 0.9 s after release.
- PASS fling: flung die flies (0.084 m/s just after release, 14.3 mm travel over 0.6 s), world stays awake, re-sleeps after settle.
- PASS tilt small: 2 deg tilt (|dg| ~ 0.34 m/s^2 < 0.5) applied while asleep updates gravity but does not wake (asleep held true over 1.5 s watch).
- FAIL under triage (2 checks + 1 related): after clicking Roll (and after Space key), world shows asleep=false but maxSpeed=0.000 m/s at +800 ms and re-sleeps almost immediately (0.0 s / 0.2 s later); render AE=0 between two frames 200 ms apart during the roll window (world frozen), yet both roll screenshots differ from the pre-roll sleeping screenshot by 65666 px (dice moved at some earlier point). Two independent wake paths (Roll click, Space key) show the same signature, while grab and fling paths show real velocities. Hypotheses queued: (a) onRoll fires but velocity writes do not stick (would contradict the wake-on-nonzero-velocity path), (b) my sampler misses a fast transient, (c) an unrelated wake fires with zero velocity. Next step per triage rule: print live values at the decision point (velocity/asleep trace every ~100 ms for 2 s after Roll, plus events trace - empty events during the window would prove contacts never ran), check the captured console/pageerror log, then classify harness bug vs product defect before touching anything.
- Driver bug (mine, not product): strong-tilt phase crashed on a delta() call passed position arrays instead of bodies; strong-tilt wake/slide checks, add/remove-die wake, resize (setBox) wake, and the final console audit did not run yet. Driver fixed locally; rerun will cover only the invalidated checks.

Test-design assumptions (for the record): synthetic devicemotion stands in for real accelerometer tilt (values routed through the app's own conversion, verified in probe); the createWorld spy is observation-only; add/remove-die and resize wakes are treated as in-scope user flows of the same wake list the task defers (Roll/Space/fling/tilt are the deferred core); headless SwiftShader rendering is an acceptable stand-in for user-visible rendering.
