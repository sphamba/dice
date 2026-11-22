---
name: "feat: make impact sound intensity proportional to the impulse"
priority: "high"
state: "reviewing"
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
- Deliverable at HEAD `c2b2da2`, worktree clean. `src/audio/sound.js`: every voice gain is `gainValue * LIMITER_CEILING`; `voiceScale`, `scaleMeasured`, `peakOf` and `LIMITER_THRESHOLD_DB` are deleted. `resume()` builds voices -> `master` (gain `1 / CLIPPER_RANGE = 1/4`) -> `WaveShaperNode` -> `context.destination`. No compressor is created.
- Curve: 4097 points, `s = x * 4`, output `s` at and below `LIMITER_CEILING = 10 ** (-3 / 20)`, else `sign(s) * (C + (1 - C) * tanh((|s| - C) / (1 - C)))`.
- Oversampling: `oversample = '4x'` measured 1.011 in 4 of 10 mixes, so it is `'none'` now, as the PM steer allowed. The test asserts `'none'`.
- Assumptions: curve values are clamped to the largest float32 below one (`1 - 2 ** -24`), because the literal formula rounds to exactly 1.0 in float32 and the Spec requires every magnitude below 1. The top of the curve therefore ties in float32, so the test asserts a non-decreasing curve plus strict monotonicity in the linear part.
- Checks green: `npx vitest run src/audio src/physics` 168 passed, `npm test` 382 passed, `npm run build` green. Mode/pitch selection, brightness, voice cap, unlock and haptics are covered by those suites.
- Gain spy over 2 page loads, real Rolls: 295 and 294 unclamped voices, 0 clamped, `gain / impulse` spread 1.1e-7, value 47.1963856 = `LIMITER_CEILING / MAX_IMPULSE` (47.2). PASS.
- Real chain, one voice at I and at I/2 rendered separately: peaks 0.5101/0.2551 and 0.4184/0.2092, ratio 1.9999997 in both loads. PASS (band 2 within 1%).
- Deterministic clipper check (PM method): every voice (buffer, gain, start time) of 10 Rolls of 10 dice replayed at its recorded start time in one `OfflineAudioContext` through the real chain (`1/4` gain, real curve, `'none'`). Peaks per Roll, voices per Roll, and the same mix without the clipper: 1: 0.9971 / 98 / 1.4807; 2: 0.9873 / 60 / 1.2638; 3: 0.9811 / 67 / 1.2040; 4: 0.9888 / 53 / 1.2825; 5: 0.9920 / 73 / 1.3316; 6: 0.9968 / 61 / 1.4671; 7: 0.9305 / 70 / 1.0004; 8: 0.9863 / 69 / 1.2523; 9: 0.9996 / 67 / 1.7767; 10: 0.9752 / 59 / 1.1630. Max clipper peak 0.9996 <= 1.0 in all 10 Rolls. PASS.
- The 98 voices of Roll 1 exceed the 12-voice cap because the offline replay keeps every voice, so the measured peak is a conservative upper bound of the live mix.
- Notes on method: the real-time AnalyserNode tap in this headless Chromium reads game-rendered buffers about 400x too low (same buffer renders 0.618 offline, synthetic buffers read correctly), so the continuous monitor was dropped for the deterministic replay above, per the PM steer.
- Manual checks left to other roles: a listening test.
