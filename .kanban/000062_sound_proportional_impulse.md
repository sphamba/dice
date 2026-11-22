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
- Reviewed at HEAD c2b2da2, worktree clean, base main; diff touches src/audio/sound.js and src/audio/sound.test.js only.
- Code change 1 verified: every voice gain is `gainValue * LIMITER_CEILING` (sound.js:157); `voiceScale`, `scaleMeasured`, `peakOf`, `LIMITER_THRESHOLD_DB` have zero references across src/.
- Code change 2 verified: `resume()` builds voices -> `master` (gain `1 / CLIPPER_RANGE`) -> WaveShaper -> `context.destination` (sound.js:173-179); curve is 4097 float32 points, `s = x * 4`, linear at and below the ceiling, tanh soft clip above, matching the Spec formula.
- Tests updated per Spec: mock counts compressors and the suite asserts 0 created; curve asserted identity at and below the ceiling, odd, and every magnitude below 1. Reviewer runs: `npx vitest run src/audio src/physics` 168 passed, `npm test` 382 passed, `npm run build` green.
- Accepted deviation: `oversample` is `'none'`, not the Spec's `'4x'`: `'4x'` measured a 1.011 peak in 4 of 10 mixes, which breaks the hard requirement that output magnitude stays below 1; Notes record a PM steer for `'none'`. Fold this decision into the Specs text when the card closes.
- Accepted test adaptation: whole-curve monotonicity is asserted as non-decreasing with strict increase only in the linear part; float32 spacing (~6e-8) exceeds the tanh-tail step (~2e-9) near the top, so ties are unavoidable, and the curve top is clamped to `1 - 2 ** -24` as documented.
- Browser evidence accepted as recorded: `gain / event.impulse` = 47.1964 = `LIMITER_CEILING / MAX_IMPULSE` over 2 loads (295/294 unclamped voices, 0 clamped), separate-render peak ratio 2.0 within 1%, and 10-Roll deterministic offline replay through the real chain max peak 0.9996 <= 1.0 with per-Roll peaks and voice counts in Notes. Listening test deferred to the live tester.
