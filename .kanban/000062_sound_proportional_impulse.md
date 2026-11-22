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
## Verification of commit 67f439c (HEAD, clean tree)

Method: Playwright/chromium headless against my own vite dev server (`127.0.0.1:4197`, started and stopped by me, port now free). Instrumentation = `page.route` rewrite of the dev-served `src/audio/sound.js` with all three anchors found exactly once (`    node.gain.value = gainValue * LIMITER_CEILING;`, `    source.buffer = renderModes(context, modes, event.speed);`, `        shaper.connect(context.destination);`). Extra parallel `AnalyserNode` (fftSize 2048, ~43 ms window, polled every 10 ms) after the WaveShaper via a zero-gain sink, so measured peak is the clipper output and is not affected by the tap. 10-dice set, viewport 1280x800, canvas clicked once, `context.state === 'running'` asserted on every page. Harness: /tmp/live-62/harness.js, raw JSON /tmp/live-62/out.json.

Tap validation (production numbers only reported after it passed): negative before any roll = 0; known positive 440 Hz sine 0.5 x Gain 0.5 through `master` = 0.4999999 (band 0.495..0.505). `curve.length` 4097, `oversample` `'4x'`, max |curve| 0.99999994, ceiling 0.7079457843841379, maxImpulse 0.015, range 4, sampleRate 48000.

### Check 1 - voice gain proportionality (2 fresh page loads, 5 Rolls each)
| load | unclamped | clamped | min ratio | max ratio | spread | expected |
|---|---|---|---|---|---|---|
| 1 | 295 | 0 | 47.19638309 | 47.19638826 | 1.09e-7 | 47.196385625609196 |
| 2 | 294 | 0 | 47.19638290 | 47.19638819 | 1.12e-7 | 47.196385625609196 |
Max |ratio/expected - 1| = 5.58e-8 (load 1) / 5.77e-8 (load 2). PASS (band 1%).
No clamped records: every observed `event.impulse` stayed below MAX_IMPULSE = 0.015 on the 10-dice set, so the clamp path was never exercised in this run.

### Check 2 - two-voice ratio through the real chain shape (offline, real curve, `__lastBuffer`)
| load | I = maxImpulse peak | I/2 peak | ratio |
|---|---|---|---|
| 1 | 0.51013118 | 0.25506562 | 1.99999977 |
| 2 | 0.41842279 | 0.20921142 | 1.99999972 |
PASS (band 1.98..2.02). Buffer captured was the final voice of the 5-Roll run, duration 0.0927 s.

### Check 3 - 10 Rolls of 10 dice, continuous peak monitor
| roll | peak | voices created |
|---|---|---|
| 1 | 0.000328 | 50 |
| 2 | 0.000917 | 55 |
| 3 | 0.000279 | 57 |
| 4 | 0.001229 | 65 |
| 5 | 0.000372 | 54 |
| 6 | 0.001176 | 67 |
| 7 | 0.000700 | 62 |
| 8 | 0.000313 | 65 |
| 9 | 0.000307 | 60 |
| 10 | 0.000531 | 70 |
Max peak 0.001229 at roll 4. All 10 <= 1.0. PASS. Peaks are far below the ceiling because each voice is a normalised modal buffer scaled by impulse/MAX_IMPULSE * CEILING (order 1e-3), i.e. overlap never approached 1.0. Voice counts above are events that actually played during the Roll window (concurrency itself stays capped at MAX_VOICES = 12 by the existing voice cap).

### Commands
- `npx vitest run src/audio src/physics`: 11 files, 168 tests passed.
- `npm test`: 28 files, 382 tests passed.
- `npm run build`: built in 68ms, `dist/assets/index-BpWOwJvh.js` 70.50 kB (gzip 25.90 kB).

### Console / errors
3 console errors, all `Blocked call to navigator.vibrate because user hasn't tapped on the frame...` (headless haptics blocking, expected, not a defect). 0 `pageerror`.

### Screenshots
/tmp/live-62/load0-before-rolls.png, /tmp/live-62/load1-before-rolls.png, /tmp/live-62/load1-after-last-roll.png, /tmp/live-62/load3-after-last-roll.png

### Verdict
All Specs checks on 67f439c pass. No source file changed; only the in-memory route rewrite was instrumented. Note that `npm run build` regenerated `dist/`, so that directory may show modified build output in the worktree.
