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
- Implemented in `src/audio/sound.js` (commit 67f439c, worktree clean): every voice gain is `gainValue * LIMITER_CEILING`; `voiceScale`, `scaleMeasured`, `peakOf` and `LIMITER_THRESHOLD_DB` deleted; `resume()` builds voices -> `master` (gain `1 / CLIPPER_RANGE = 1/4`) -> `WaveShaperNode` (`oversample = '4x'`, 4097-point curve) -> `destination`; no compressor is created.
- Curve: `s = x * 4`, output `s` at and below `LIMITER_CEILING = 10 ** (-3 / 20)`, else `sign(s) * (C + (1 - C) * tanh((|s| - C) / (1 - C)))`.
- Assumption: curve values are clamped to the largest float32 below one (`1 - 2 ** -24`), because the literal formula rounds to exactly 1.0 in float32 and the Spec requires every magnitude below 1. Probed curve: max 0.99999994, linear-region error 0, 12 full voices map to 0.99999994.
- Assumption: the curve top therefore ties in float32, so the test asserts a non-decreasing curve plus strict monotonicity in the linear part.
- Tests (`src/audio/sound.test.js`, audio mock): no compressor, master gain 1/4, chain to destination, curve length/oversample, linearity at and below the ceiling, oddness, monotonicity, every value below 1, one voice inside the linear part, voice gain `LIMITER_CEILING * gainForImpulse`.
- Checks green: `npx vitest run src/audio src/physics` 168 passed, `npm test` 382 passed, `npm run build` green. Mode/pitch selection, brightness, voice cap, unlock, and haptics are covered by those suites.
- Browser checks in headless Chromium (dev server, instrumented `sound.js`, parallel AnalyserNode tap after the WaveShaper): tap validation negative 0, known positive 0.49999991; voice gain/impulse over 2 page loads (295 and 294 unclamped voices, 0 clamped) spread 1.1e-7 and matching `LIMITER_CEILING / MAX_IMPULSE = 47.1963856`; offline render of real buffers through the same chain at I and I/2 gives peaks 0.510/0.255 and 0.418/0.209, ratio 1.9999997 in both loads.
- Open blocker: the real-time tap reads only 0.0003..0.0012 during 10 Rolls of 10 dice (50..70 voices per roll, impulses up to 0.0086, voice signal peaks up to 0.35), while the same captured buffer through the same chain renders 0.618 offline and synthetic buffers/oscillators read exactly in the same page. Real-time playback of the game-rendered buffers appears unreliable in this headless build, so the "peak at most 1.0" number is not yet trustworthy. Next step: reproduce with the captured channel data outside the game page and, if headless real-time audio is at fault, replace the tap with a deterministic offline mix render of the recorded voices and record its peaks.

