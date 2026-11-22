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

## Code change 1: fixed voice scale
`createSound` in `src/audio/sound.js` measures the peak of the first voice and keeps it as `voiceScale`. The overall level thus depends on which impact plays first, and it differs between sessions (1.0 and 0.9287 were measured).

- `renderModes` normalizes the mode amplitudes so that their sum is 1. Thus every buffer peak is at most 1, and `LIMITER_CEILING` is a safe fixed scale for every voice.
- Set the voice gain to `gainValue * LIMITER_CEILING`.
- Delete `voiceScale`, `scaleMeasured`, `peakOf` and the measurement block in `playVoice`.
- Change the test `keeps one constant voice scale so loud overlaps stay below the ceiling` in `src/audio/sound.test.js`: the gain for an impulse of `MAX_IMPULSE` is exactly `LIMITER_CEILING` (float32 tolerance) for voices with different modes, in any play order, and the peak of each voice is at most `LIMITER_CEILING`.
- Keep `MAX_IMPULSE = 0.015`.

## Code change 2: only if the output still clips
The #64 live test measured a peak of 1.161 after the limiter on loud 10-dice overlaps with `voiceScale = 1`, because burst onsets pass the 3 ms attack. Change 1 lowers this level. Measure the peak after change 1.
- If the peak is at most 1.0 over 10 Rolls of 10 dice, change nothing more.
- If the peak is above 1.0, set the limiter attack to 0 and measure again.
- If the peak is still above 1.0, stop and write an Open question with the measured peaks. Do not change `MAX_IMPULSE` or the gain law.

## Checks
- `npx vitest run src/audio src/physics` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium with a spy on the voice gain nodes during real Rolls: for all unclamped voices, `gain / event.impulse` is constant within 1% and equals `LIMITER_CEILING / MAX_IMPULSE` (47.2) in every page load.
- Browser check over 10 Rolls of 10 dice with a continuous monitor after the limiter (`AnalyserNode`, read often enough to cover burst onsets): the peak is at most 1.0.
- Mode and pitch selection, speed-based brightness, voice cap, audio unlock on the first gesture, silence before the context exists, and haptics on `event.speed` still work.
- Record the measured peak and the voice count in Notes. A listening test is not part of this check.

# Notes
## PM steer (read first)
- The first-voice scale is a defect, not an allowed detail. Make the code change in the Specs, then rerun the fixture cases and scenarios A and B on the new code. The expected gain for the 0.0075 fixture is 0.5 * LIMITER_CEILING = 0.35397.

DONE: `src/audio/sound.js` now sets `node.gain.value = gainValue * LIMITER_CEILING`; `voiceScale`, `scaleMeasured`, `peakOf` and the measurement block are gone. Test `keeps one constant voice scale so loud overlaps stay below the ceiling` rewritten for three different mode sets (d6/lid, d20/wall, d4/die): every gain is `LIMITER_CEILING` (1e-6) and every buffer peak <= 1. `npx vitest run src/audio src/physics` 165 passed, `npm test` 379 passed, `npm run build` ok.

## Live-check results (headless chromium, dev server 127.0.0.1:5317 PID 784050, harness /tmp/dice-live/, raw log /tmp/dice-live/raw.json)
Fixture (new code): impulse 0.0075/lid -> 1 gain 0.3539728820 vs expected 0.3539728922 (delta 1.0e-8, AudioParam float32); impulse 0 -> 0 gains (played 0); speed 0.05 -> 0 gains (played 0). Implied voiceScale from the fixture = 0.7079458 = LIMITER_CEILING.
Context hygiene: 24 pre-gesture play batches, all 0 voices; `__comp` undefined before the click, defined after; state running; sampleRate 48000. No pageerror/console.error in any run. Canvas non-blank (197 distinct colours, 10557 non-dark samples in a 1280x800 screenshot).

Scenario A (6 d6, 6 Rolls): only 1 unambiguous single-event/single-voice pair in the 6-die run (41 ambiguous multi-voice batches), ratio 47.1963845.
Supplement A2 (1 d6 so single-event batches are plentiful, 10 Rolls, same code path): 19 pairs, min 47.1963839, max 47.1963872, (max-min)/min = 7.1e-8, mean 47.1963857. Expected LIMITER_CEILING/MAX_IMPULSE = 47.1963856. PASS by a wide margin.

Scenario B (10 d6, 5 Rolls, ~10 s): maxVoices 12 (cap respected), frames ~77-120 rAF / 1006-1369 at 4 ms. Peak after the limiter is NOT stable and NOT <= 1.0: measured 0.987971, 1.274280, 1.221350, 1.195015, 1.152264 across five runs (4 of 5 fail the <= 1.0 band). A compressor (ratio 20, 3 ms attack) passes transient overshoot, so 12 coincident voices summing to ~8.5 into the master still yield >1 out.

Open: this pushes scenario B from PASS to FAIL. Awaiting release; then I kill the dev server and deliver the verdict block. Dev server still up for any follow-up measurement you want first.
