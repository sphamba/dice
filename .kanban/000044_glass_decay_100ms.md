---
name: "fix: shorten the glass lid ring to a 100 ms decay"
priority: "medium"
state: "done"
worktree: ""
issuer: "user"
complexity: "simple"
shortName: "glass-decay-100ms"
changes: "{\"base\":\"main\",\"ins\":2,\"del\":2,\"files\":2}"
commits: "[{\"hash\":\"16595ab\",\"subject\":\"fix(audio): shorten the glass lid T60 to 100 ms\",\"when\":\"2026-11-22T11:30:37+01:00\"}]"
---

# Summary
The glass lid impact rings too long. Set the slowest glass mode T60 from 200 ms to 100 ms, and keep the box (80 ms) and dice (30 ms or less) as they are.

# Specs
# Need
- Glass (lid) impact sound: slowest-mode T60 = 100 ms (was 200 ms).
- Keep the box at 80 ms and every die type at 30 ms or less. Keep glass longer than box (100 > 80), the glass and box pitch (`f11`), the per-mode high-frequency damping, positions, gains and the clean buffer end.

# Facts (main at the time of filing)
- `src/audio/modes.js:12`: `GLASS = { f11: 900, tau: t60Tau(0.2) * (1 + 0.45), dampHF: 0.45 }`. The per-mode division `tau / (1 + dampHF * f / f11)` cancels the `(1 + dampHF)` factor at `f11`, so the fundamental mode has exactly the T60 inside `t60Tau(...)`.
- `src/audio/sound.js` routes `'lid'` impacts to GLASS.

# Change
- `GLASS.tau = t60Tau(0.1) * (1 + 0.45)`. No other audio change.

# Tests
- `src/audio/modes.test.js`: the slowest-mode T60 test expects 0.1 s for glass (`toBeCloseTo(0.1, 6)`) and 0.08 s for box. 'keeps the glass longer than the box' stays green.

# Acceptance criteria
- `npx vitest run src/audio`
- `npm test`
- `npm run build`

# Notes
Final live test report (task #44, commit 16595ab == main). No product defects found; no cards filed.

## Harness
- /tmp/dice-lt44 (init.js verbatim from the proven /tmp/dice-lt-audio audio harness; driver adapted and focused to this task). vite :4671 (killed after the run, port verified free), Playwright chromium 1280x800. Results persisted with unique run id dice-lt44/run1 in /tmp/dice-lt44/results.json; per-run logs run1.log.
- Served modes.js confirmed to carry the new constant: GLASS.tau / t60Tau(0.1) == 1 exactly (i.e. t60Tau(0.1) * (1 + 0.45)). Smoke run 7/7 before the full run. Per PM steer, the 2 weak band fits below were recorded as an instrument limit, not calibrated further.

## Usage flow tested
Real Web Audio pipeline: page load (dice settle on floor), first tap unlocks audio, add d4/d8/d20, roll button, device-tilt lid strikes (4 tilts). 89 voices played, every rendered AudioBuffer captured and analyzed against theory derived from the served modes.js.

## Results table
| # | Check | Outcome |
|---|-------|---------|
| 1 | Page loads, WebGL2 up (no #unsupported) | pass |
| 2 | Audio unlock preserved before first gesture (0 captures) | pass |
| 3 | First gesture unlocks audio (context running) | pass |
| 4 | No page errors during run | pass |
| 5 | One buffer per played voice | pass (89/89) |
| 6 | Coverage: floor / wall / glass lid / die-die impacts sounded | pass (21 glass, 48 box, 20 die buffers) |
| 7 | Glass slowest-mode T60 == 100 ms (theory, per buffer) | pass (all 21 glass buffers) |
| 8 | Box slowest-mode T60 == 80 ms (theory, per buffer) | pass (all 48 box buffers) |
| 9 | Die slowest-mode T60 <= 30 ms (theory, per buffer) | pass (all 20 die buffers) |
| 10 | Rendered band-fit T60 matches theory per buffer (tol max(20%, 4 ms)) | 87/89 pass; 2 = harness limit (see below) |
| 11 | Rendered glass T60 median | pass: 100.0 ms over 18 measurable fits (2 unmeasurable) |
| 12 | Rendered box T60 median | pass: 79.8 ms over 17 fits |
| 13 | Ordering glass > box > die (rendered) | pass: 100.0 > 79.8 > 20.6 ms |
| 14 | Rendered die decay vs theory (aggregate) | pass: median diff 1.2 ms |
| 15 | Buffer duration == 8 * slowest tau per buffer | pass; glass buffers all 115.8 ms (old tau would render ~232 ms) |
| 16 | Clean buffer end (last sample 0, no end click, tail below audible) | pass on all 89 buffers |
| 17 | Gains == gainForImpulse per buffer | pass on all 89 buffers |

## Harness limit (not a product defect)
- box#27@wall fitted 30.7 ms vs 80 @200 Hz and glass#47@lid fitted 13.4 ms vs 100 @900 Hz. Both fits span only the analyzer's 20 dB minimum range: the fitted band peak is very weak, so the fit is dominated by spectral leakage from louder, faster modes. The analyzer's minimum-span guard (15 dB) let these through; medians and ordering are unaffected (each median comes from 17-18 clean fits). Not calibrated further per PM steer.

## Assumptions made in the usage-test design
- The audio change is verified through the real Web Audio pipeline: real gesture unlock, real physics impacts (roll plus device-tilt lid strikes), and the actual rendered AudioBuffers of played voices.
- Band-fit T60 at the lowest excited mode is the accepted proxy for perceived decay.
- Positions, gains, pitch (f11) and per-mode high-frequency damping are keep-bullets verified by diff scope (2-line change) plus the per-buffer gain check; no separate spectral position test was rerun.
