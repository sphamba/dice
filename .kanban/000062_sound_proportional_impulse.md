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
## PM steer (read first)
- Do not use the real-time `AnalyserNode` monitor for the peak check. In headless Chromium it read only 0.0003 to 0.0012 during real Rolls, while the same buffers render at 0.618 offline.
- Use this method: record every voice (buffer, gain, start time) of 10 Rolls of 10 dice. For each Roll, replay all voices at their recorded start times through the real chain (gain 0.25, same curve, same `oversample` value as the source) in one `OfflineAudioContext`, and read the peak of the rendered samples. Pass: at most 1.0 in all 10 Rolls. Record also the peak of the same mix without the clipper.
- Report brightness and pitch proxies only if they work at once. Do not spend time on them, because the unit suites cover them.
- Time budget from now: 15 minutes. Kill the dev server on port 4647 when you finish.

Live test of #62 at HEAD c2b2da2, second watch checkpoint. No app defects found so far; two harness bugs (my glue) found and fixed. A stale r1 driver process (PID 822836) may still be running; it will be killed before the clean re-run.

## Results so far (valid gates)
- Smoke run (PHASES=env,ratio) and first full run (r1): all env, unlock and ratio gates PASS.
  - env: page loads, no #unsupported, no page errors, observer patch applied.
  - unlock: 29 impact events occur before any gesture while ctx=null and 0 voices (silence before the context exists); first gesture (panel toggle) creates the context, state running; chain wired (shaper connected to destination); master gain exactly 0.25; WaveShaper curve 4097 points, oversample 'none'; context clock advances.
  - ratio (Spec: one voice at impulse I and one at I/2 through the real chain, rendered separately): peaks 0.318735 vs 0.159368, ratio 1.9999970 (within 1% of 2). Full-clamp case (impulse 0.02, gainValue 1): rendered peak 0.478102 <= 1. Chain math exact: rendered peak == bufferPeak * fround(gain) * 0.25 * 4 - the curve's linear region outputs x * CLIPPER_RANGE, so the single-voice chain gain is unity and stays far below the 0.177 clipper input knee.
- Session replays (PM-steer method) in the r1 run: per-Roll replay peaks through the real chain 0.3446, 0.8041, 0.9305, 0.8977, 0.9752, 0.9837, 0.9918 for rolls 0..6, all <= 1.0 (7 of 10 rolls done at the checkpoint). Same mix without the clipper peaks 0.086..0.332 (recorded, no gate).

## Harness bugs found and fixed (glue, not app)
- Reload phase mis-sliced the voice list after page reload (capture store resets); fixed.
- The offline replay helper's own source.start() calls re-triggered my voice capture hook, so per-Roll voice counts grew exponentially (93, 249, 551, ...) and replay inputs and voice/capture pairing were polluted; the r1 session/analyze numbers are therefore invalid as recorded data (the peak gates happened to pass but on polluted mixes). Fixed with a replaying guard in init.js. The r1 ratio/unlock results are unaffected.

## Next after release
- node --check, kill stale r1 driver, one clean full re-run (env,unlock,ratio,session,analyze,reload) producing the single clean results file; then report Notes with measured peaks, voice counts, cap/duration/haptics results and file any defects. Server on port 4647 will be killed at wrap-up.
