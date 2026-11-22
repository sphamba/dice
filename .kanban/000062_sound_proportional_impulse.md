---
name: "feat: make impact sound intensity proportional to the impulse"
priority: "high"
state: "doing"
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
- Violation: the Specs require two code changes in this task, but the worktree has none: HEAD 0496435 equals main, tree clean, `git diff main...HEAD` is empty. Neither change exists: `voiceScale`, `scaleMeasured`, `peakOf` and the `DynamicsCompressor` are still in `src/audio/sound.js`; there is no `master` GainNode + WaveShaper chain, no `CLIPPER_RANGE`, no curve builder, and `LIMITER_THRESHOLD_DB` is still used.
- Subtasks #63 and #64 are done and on main. A prior verification run at this HEAD measured proportionality PASS (gain/impulse constant within 1e-6) and clipping FAIL (peak 1.351606 over 10 d6, max 12 voices); the PM folded the limiter fix into this task's Specs and no developer run has implemented it since.
- Remaining work: code change 1 (voice gain `gainValue * LIMITER_CEILING`, delete `voiceScale`/`scaleMeasured`/`peakOf`), code change 2 (compressor replaced by `master` gain `1 / CLIPPER_RANGE` -> WaveShaper -> destination, 4097-point tanh curve with `CLIPPER_RANGE = 4`, `oversample = '4x'`, output bounded below 1, delete `LIMITER_THRESHOLD_DB` if unused, export the curve builder only if tests need it), test and audio-mock updates with the specified assertions, then the browser checks with recorded peaks and voice count in Notes.
- No suites run in this review: the recorded diff is empty, so there is no changed code to test. Guidance: implement exactly the two Spec changes, nothing else, and pair the fix with the Spec's browser measurements before returning to review.
