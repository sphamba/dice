---
name: "fix: shorten the glass lid ring to a 100 ms decay"
priority: "medium"
state: "live-testing"
worktree: "fix/44-glass-decay-100ms"
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
Live test in progress (held at watch checkpoint).

## Harness
- Worktree serves the merged commit: HEAD 16595ab == main, `git diff main...HEAD` empty; the 2-line change (GLASS.tau t60Tau(0.2)->t60Tau(0.1) + test expectation) is what is under test.
- Reused the proven /tmp/dice-lt-audio harness (init.js verbatim, driver adapted and focused to task scope) in /tmp/dice-lt44; vite on port 4671; Playwright chromium 1280x800.
- sound.js is routed through an observer patch: every played voice and its exact rendered AudioBuffer are captured in-page; served modes.js is fetched and used as theory source (GLASS.tau/t60Tau(0.1) == 1 exactly, so the served app carries the new constant).
- Smoke run 7/7 PASS (spies, patch, audio unlock, capture flow, analyzer instrument) before the full run.

## Full run 1 (89 played voices, 20 checks): 17/20
- PASS page loads WebGL2, no page errors, unlock preserved, one buffer per played voice (89/89).
- PASS coverage: floor/wall/glass-lid/die-die impacts all sounded and were analyzed (21 glass, 48 box, 20 die buffers).
- PASS rendered glass slowest-mode T60 == 100 ms: median 100.0 ms over 18 measurable band fits (2 unmeasurable), per-buffer tolerance max(20%, 4 ms).
- PASS rendered box T60 stays 80 ms: median 79.8 ms over 17 fits; all die theory <= 30 ms, rendered die aggregate diff 1.2 ms.
- PASS ordering glass > box > die rendered (100.0 > 79.8 > 20.6 ms).
- PASS glass buffer durations all 115.8 ms (8 * t60Tau(0.1); old tau would render ~232 ms) and clean buffer end on all 89 buffers (last sample 0, no end click, tail below audible).
- PASS gains match gainForImpulse on all buffers.
- FAIL 2/89 per-buffer band fits: box#27@wall 30.7 ms vs 80 @200 Hz, glass#47@lid 13.4 ms vs 100 @900 Hz. Both fits span exactly 20 dB (the analyzer's minimum range), i.e. the fitted band peak is very weak. Suspected instrument limit (weak mode buried under spectral leakage of louder, faster modes), not a product defect; medians and ordering are unaffected.

## In progress when held
- Added a band-peak-level field (peakRelDb) to the band-fit analyzer copy; next step: calibrate the instrument on synthetic buffers with known amps/T60, dump per-buffer records, then one rerun with the calibrated validity floor to classify the 2 failures as harness limit or product defect.

## Assumptions made in the usage-test design
- The audio change is verified through the real Web Audio pipeline: real gesture unlock, real physics impacts (roll plus device-tilt lid strikes), and the actual rendered AudioBuffers of played voices.
- Band-fit T60 at the lowest excited mode is the accepted proxy for perceived decay; fits are trusted only above a calibrated amplitude/span floor.
- Positions, gains, pitch (f11) and per-mode damping are keep-bullets verified by diff scope (2-line change) plus the per-buffer gain check; no separate spectral position test was rerun.
