---
name: "feat: make impact sound intensity proportional to the impulse"
priority: "high"
state: "live-testing"
worktree: "feat/62-sound-proportional-impulse"
issuer: "user"
complexity: "simple"
shortName: "sound-proportional-impulse"
blockedBy: ""
splitter: "done"
changes: "{\"base\":\"main\",\"ins\":121,\"del\":57,\"files\":2}"
commits: "[{\"hash\":\"c2b2da2\",\"subject\":\"fix: use the raw clipper curve without oversampling\",\"when\":\"2026-11-22T23:21:47+01:00\"},{\"hash\":\"67f439c\",\"subject\":\"fix: bound the impact output with a symmetric soft clipper\",\"when\":\"2026-11-22T23:04:57+01:00\"}]"
---

# Summary
Verification scope: once the delta-impulse and audio subtasks have landed, confirm end to end that impact loudness is proportional to the impact impulse and the output stays free of clipping.

# Specs
## Scope
The work is split into subtasks #63 (physics: `event.impulse` is the new impulse, delta over the warm start) and #64 (audio: linear gain, pair gate, peak limiter). This task verifies the combination and makes the code changes below. Implement nothing else.

## Code change 1: fixed voice scale (done)
The voice gain is `gainValue * LIMITER_CEILING`. `voiceScale`, `scaleMeasured` and `peakOf` are deleted.

## Code change 2: replace the compressor with a bounded soft clipper
Measured with change 1: the peak after the `DynamicsCompressor` is 0.988, 1.274, 1.221, 1.195 and 1.152 over five 10-dice runs. Lowering the voices did not lower the peak, so the compressor does not bound the output. Do not tune it further.

In `resume()` in `src/audio/sound.js`, replace it with this chain: voices -> `master` (GainNode, gain `1 / CLIPPER_RANGE`) -> `WaveShaperNode` -> `context.destination`.

- `CLIPPER_RANGE = 4`.
- `oversample = '4x'`.
- Curve: `Float32Array` of 4097 points (odd, so that input 0 maps to output 0). For `x` in [-1, 1], `s = x * CLIPPER_RANGE`:
  - `|s| <= LIMITER_CEILING`: output `s`.
  - Otherwise: output `sign(s) * (C + (1 - C) * tanh((|s| - C) / (1 - C)))`, with `C = LIMITER_CEILING`.
- A single voice peaks at or below `LIMITER_CEILING`, so it stays in the linear part and stays proportional. Only overlaps above the ceiling are shaped. The output magnitude is always below 1.
- Export the curve builder only if the test needs it. Delete `LIMITER_THRESHOLD_DB` if nothing else uses it, and keep `LIMITER_CEILING = 10 ** (-3 / 20)`.
- Update the tests that expect one compressor and its parameters (`src/audio/sound.test.js`) and the audio mock. New assertions: no compressor is created, the curve is the identity at and below the ceiling within float32 tolerance, it is odd and strictly increasing, and every value has a magnitude below 1.

## Checks
- `npx vitest run src/audio src/physics` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium with a spy on the voice gain nodes during real Rolls: for all unclamped voices, `gain / event.impulse` is constant within 1% and equals `LIMITER_CEILING / MAX_IMPULSE` (47.2) in every page load.
- Browser check through the real chain: one voice at impulse I and one at I/2, rendered separately, have output peaks in the ratio 2 within 1%.
- Browser check over 10 Rolls of 10 dice with a continuous monitor after the WaveShaper (`AnalyserNode`, read often enough to cover burst onsets): the peak is at most 1.0 in all 10 Rolls.
- Mode and pitch selection, speed-based brightness, voice cap, audio unlock on the first gesture, silence before the context exists, and haptics on `event.speed` still work.
- Record the measured peaks and the voice count in Notes. A listening test is not part of this check.

# Notes
Live test of #62 at HEAD c2b2da2, in progress at the watch checkpoint. No verdict yet; no defects filed so far.

## Plan (committed before the run)
- Run the app as a user from the merged worktree: vite dev server on localhost:4647 (page, sound.js, main.js all HTTP 200), Chromium via Playwright, viewport 1280x800.
- Harness in /tmp/dice-lt62 adapted from the proven /tmp/dice-lt64 audio live-test harness, retargeted from the old compressor chain to the new voices -> master (0.25) -> WaveShaper -> destination chain. In-page spies only (no repo edits): voice gain+buffer capture at source.start, analyser tap inserted between WaveShaper and destination, navigator.vibrate wrapper, route-patch observer on play()/voices.push().
- Phases mapped to the Specs checks: env (app loads, no page errors) -> unlock (silence before context exists, unlock on first gesture, chain wired: master 0.25, curve 4097 points, oversample none) -> ratio (one voice at impulse I and I/2 through the real chain rendered separately via OfflineAudioContext, output peak ratio 2 within 1%; plus clamp case at 0.02) -> session (10 Rolls of 10 dice - 6 d6 + 4 d10 via panel, continuous 40 ms analyser monitor after the WaveShaper, per-Roll peak <= 1.0, gain/impulse spy) -> analyze (ratio = 47.2 within 1% per load, voice cap 12, durations, pitch/brightness from captured buffers, haptics 5..20 ms) -> reload (second page load repeats the gain/impulse ratio).
- Constants from source: LIMITER_CEILING = 10**(-3/20) = 0.7079457843841379, CLIPPER_RANGE = 4, MAX_IMPULSE = 0.015, MIN_IMPULSE = 1e-4, MAX_VOICES = 12, MIN_EVENT_SPEED = 0.15, duration bounds [0.05, 0.6] s, FULL_BRIGHTNESS_SPEED = 2, haptics MIN_SPEED 0.8 / 5..20 ms / GAP 60 ms. Expected unclamped ratio 47.19638562560919. AudioParam gains stored float32, so gain expectations use fround with eps 1e-9. Analyser window 8192 samples @ 48 kHz = 171 ms, monitor period 40 ms, so burst onsets are covered.

## Assumptions
- "Browser check" items in the Specs are executed by instrumenting the real app in a real browser (in-page measurement code only, established by the recorded #62 evidence and the #64 live-test precedent); the unit suites and npm test/build are excluded for the live test.
- The ratio-2 check uses the app's own sound.js module and a real OfflineAudioContext render through the real resume() chain, since real rolls cannot control impulses.
- "10 Rolls of 10 dice": 10 dice spawned via the panel (6 d6 + 4 d10, mixed types so pitch selection has data), all rolled each time.
- Brightness/pitch regression checks are weak-signal (zero-crossing-rate proxies on captured voice buffers): brightness gates on positive Spearman(speed, ZCR), pitch on distinct ZCR between d6 and d10 groups; if signals are too weak they are reported as harness limits, not defects.

## Status
- Worktree clean at c2b2da2; harness and driver written; node --check and the smoke launch not yet run (checkpoint arrived first). Next: check-in ladder, smoke run (PHASES=env,ratio), then the full run.
