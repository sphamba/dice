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
## PM steer (read first)
- Do not close on the failed peak check. Make code change 2 in the Specs, then rerun the fixture cases, scenario A2, the two-voice ratio check, and scenario B as 10 Rolls of 10 dice on the new code.
- Kill the dev server (PID 784050) when you finish.

## State before code change 2
Code change 1 is done: `node.gain.value = gainValue * LIMITER_CEILING`; `voiceScale`, `scaleMeasured`, `peakOf` and the measurement block are gone. Test `keeps one constant voice scale so loud overlaps stay below the ceiling` covers three mode sets (d6/lid, d20/wall, d4/die). `npx vitest run src/audio src/physics` 165 passed, `npm test` 379 passed, `npm run build` ok.

## Live-check results (headless chromium, dev server 127.0.0.1:5317 PID 784050, harness /tmp/dice-live/, raw log /tmp/dice-live/raw.json)
- Fixture: impulse 0.0075/lid gives gain 0.3539728820 vs expected 0.3539728922; impulse 0 and speed 0.05 give no voice.
- Context hygiene: 24 pre-gesture play batches, all 0 voices; context created after the click; state running; sampleRate 48000. No page or console errors. Canvas not blank.
- Scenario A2 (1 d6, 10 Rolls): 19 pairs, ratio 47.1963839 to 47.1963872, expected 47.1963856. PASS.
- Scenario B (10 d6, 5 Rolls): maxVoices 12. Peak after the compressor 0.987971, 1.274280, 1.221350, 1.195015, 1.152264. FAIL, addressed by code change 2.
