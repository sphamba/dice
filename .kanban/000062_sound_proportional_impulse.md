---
name: "feat: make impact sound intensity proportional to the impulse"
priority: "high"
state: "to-review"
worktree: "feat/62-sound-proportional-impulse"
issuer: "user"
complexity: "simple"
shortName: "sound-proportional-impulse"
blockedBy: ""
splitter: "done"
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
- Verification only: no source change, worktree HEAD 0496435, tree clean, no commit.
- `npx vitest run src/audio src/physics`: 11 files, 165 tests pass. `npm test`: 28 files, 379 tests pass. `npm run build`: pass (dist/assets/index-Bv4ZQ0HW.js).
- PASS proportionality, live Chromium, real Rolls: 6 d6 over 8 Rolls gives gain/impulse = 66.6666677 with zero spread in the unambiguous sample; 1 d6 over 10 Rolls gives 18 pairs, spread 7.4e-8, mean 66.6666665. Implied voice scale 1.0, so gain is linear in the delta impulse within 1e-6.
- FAIL clipping, live Chromium, 10 d6 over 5 Rolls: peak after the limiter 1.351606 (float samples, 127 analyser frames), max live voices 12. The spec band is at most 1.0.
- Cause: the compressor has a 3 ms attack, so the onset of a full 12-voice overlap passes above unity before the gain reduction settles. A second contributor is the voice scale, latched from the first rendered buffer and therefore 1 whenever that buffer peak sits below -3 dBFS.
- Measured fix options (experiment reverted, not applied): a tanh clipper after a 1/4 master gain with the curve bounded below 1 gives 0.999992 with `oversample: 'none'` (pass), 1.009410 and 1.093174 with `'4x'` (fail, resampler ringing overshoots the curve), and 0.947469 with `'4x'` and the shoulder capped at 0.9 (pass).
- Other spec checks hold: no audio context before the first gesture (23 pre-gesture batches played zero voices), mode and pitch selection, pair gate, speed brightness, voice cap and the climb-to-silence buffer covered by the passing `src/audio` suites (38 tests); haptics read `event.speed` and are not observable headless, so that pair with `event.impulse` is unchecked in the browser.
- Assumption: proportionality is measured on batches that carry exactly one event and one unclamped voice, the only unambiguous pairing.
- Blocker: the peak above 1.0 needs a change in `src/audio/sound.js`, which is out of this task's scope; it belongs to #64. #62 stays open until that limiter fix lands and the 10-dice peak is re-measured.
