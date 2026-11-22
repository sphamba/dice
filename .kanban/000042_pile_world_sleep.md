---
name: "fix: whole-world sleep that freezes and wakes the dice world"
priority: "medium"
state: "done"
worktree: ""
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
Outcome: approved. Live usage test of the whole-world sleep passed every check; no product defects found, no cards filed. The three FAIL rows seen mid-run were instrument artifacts (two sampling-latency misses and one wrong physical expectation), each superseded by a frame-granular re-measurement. Artifacts: /tmp/dice-lt42/ (results-world-sleep.json, -rerun.json, -rerun2.json, traces in the run logs).

Setup: served the worktree with `npx vite --port 8772`; headless Chromium 1280x800 with SwiftShader GL flags, 24 fps (sim ~0.8x wall); the world was exposed by a route-rewrite spy on served main.js (observation-only); devicemotion was dispatched synthetically through the app's own deviceToWorldGravity path (desktop sign=+1, verified in probe). Instrument for the wake checks: in-page trace sampled every ~50 ms, started BEFORE the trigger (per the PM hint).

Results (all PASS in final form):
- Sleep: default 2 d6 settle and the world sleeps ~0.9 s wall after stillness; velocities exactly zero at sleep.
- Settled pile shows no residual motion: positions and quaternions bit-identical over a 2 s watch, asleep flag never dropped, events stayed empty, render pixel-identical (AE=0 between screenshots 1 s apart; image non-blank, sd 0.178).
- Grab a sleeping die: moves at once (14.2 mm displacement within ~0.9 s of mousedown, dz +14.1 mm lift toward hold height); the grab wakes the world; world re-sleeps 0.9 s after a gentle release.
- Roll wakes: frame trace from the click shows first die motion 109 ms after trigger (linear+angular peak 25.5), contact events up to 5/frame (sound/haptics input), dice settle ~0.36 s after trigger, world re-sleeps ~1 s later. Matches the #37 measurement (settle 0.2-0.5 s); the run-1 FAIL was a +800 ms sample taken after settle, as the PM hint predicted.
- Space wakes: first motion 50 ms after keypress, peak 27.5, events up to 9/frame, settle ~0.35 s, re-sleep ~0.9 s after that. (Roll button blurred first via a click on an empty canvas spot, as the panel ignores Space on focused buttons.)
- Fling wakes: flung die leaves at 0.084 m/s and travels 14.3 mm over 0.6 s; world stays awake through the fling and re-sleeps after settle.
- Tilt: 2 deg (|dg| ~ 0.34 m/s^2 < 0.5) applied while asleep updates gravity and does NOT wake (asleep held over a 1.5 s watch). 5 deg (|dg| ~ 0.86 m/s^2 > 0.5) wakes within 50 ms. The "dice slide" expectation was dropped as an invalid instrument: friction is 0.1 (contacts.js FRICTION_DIE), which holds dice up to ~5.7 deg, so no slide at 5 deg is correct physics; the trace confirms wake then correct re-sleep 0.6 s later.
- Add/remove/resize wake: Add d6 woke the world 79 ms after click (bodies 2 -> 3), Remove d6 woke 64 ms after click (3 -> 2), viewport resize (setBox) woke with box W 0.0800 -> 0.0724 m; each re-sleeps after the new motion settles (re-sleep latencies 0.6-1.4 s wall, consistent with settle + 0.5 s threshold).
- Console: clean (only [vite] debug chatter).

Assumptions made while designing the tests: synthetic devicemotion stands in for real accelerometer tilt (values routed through the app's own conversion, sign verified in probe); the createWorld spy is observation-only; add/remove-die and resize wakes are in-scope user flows of the same wake list the task defers (Roll/Space/fling/tilt are the deferred core); headless SwiftShader rendering stands in for user-visible rendering; motion detector thresholds mix linear m/s and angular rad/s (both are motion). No observed behavior contradicts the task's stated assumptions.

Technical difficulties hit while testing (all resolved in-run, none product-side): (1) +800 ms samples after Roll/Space/Add/Remove landed after the fast settle and re-sleep, producing false FAILs; fixed with pre-trigger in-page traces. (2) Driver bug: strong-tilt drift check passed position arrays to a distance helper; fixed. (3) setViewportSize failed on a maximized headless window; fixed by restoring window state via CDP before resizing.
