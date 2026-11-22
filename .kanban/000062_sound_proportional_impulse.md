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
The work is split into subtasks #63 (physics: `event.impulse` is the new impulse, delta over the warm start) and #64 (audio: linear gain, pair gate, peak limiter). This task verifies the combination and makes the one code change below. Implement nothing else.

## Code change: fixed voice scale
`createSound` in `src/audio/sound.js` measures the peak of the first voice and keeps it as `voiceScale`. The overall level thus depends on which impact plays first, and it differs between sessions (1.0 and 0.9287 were measured).

- `renderModes` normalizes the mode amplitudes so that their sum is 1. Thus every buffer peak is at most 1, and `LIMITER_CEILING` is a safe fixed scale for every voice.
- Set the voice gain to `gainValue * LIMITER_CEILING`.
- Delete `voiceScale`, `scaleMeasured`, `peakOf` and the measurement block in `playVoice`.
- Change the test `keeps one constant voice scale so loud overlaps stay below the ceiling` in `src/audio/sound.test.js`: the gain for an impulse of `MAX_IMPULSE` is exactly `LIMITER_CEILING` (float32 tolerance) for voices with different modes, in any play order, and the peak of each voice is at most `LIMITER_CEILING`.
- Keep `MAX_IMPULSE = 0.015` and the limiter settings.

## Checks
- `npx vitest run src/audio src/physics` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium with a spy on the voice gain nodes during real Rolls: for all unclamped voices, `gain / event.impulse` is constant within 1% and equals `LIMITER_CEILING / MAX_IMPULSE` (47.2) in every page load.
- Browser check with 10 dice: the peak after the limiter, read with an `AnalyserNode`, is at most 1.0.
- Mode and pitch selection, speed-based brightness, voice cap, audio unlock on the first gesture, silence before the context exists, and haptics on `event.speed` still work.
- Record the measured peak and the voice count in Notes. A listening test is not part of this check.

# Notes
## PM steer (read first)
- The first-voice scale is a defect, not an allowed detail. Make the code change in the Specs, then rerun the fixture cases and scenarios A and B on the new code. The expected gain for the 0.0075 fixture is 0.5 * LIMITER_CEILING = 0.35397.

## Live-check progress
Headless chromium, dev server on 127.0.0.1:5317, harness /tmp/dice-live/run.mjs.

Probe plumbing validated: 1 gain per voice, gain 0 events for impulse 0 and for speed 0.05 (< 0.15 gate), analyser strictly after the limiter (comp -> analyser -> target), limiter tap alive at 48 kHz, context created only after the gesture (25 pre-gesture play batches logged, all played 0 voices, __comp undefined before click, defined after, state running).

Next on release: make the code change, rerun the three fixture cases, then scenario A (6 d6, 6 Rolls, gain/impulse spread) and scenario B (10 d6, 5 Rolls, post-limiter peak, frames, max voices), screenshot, then kill the dev-server PID.
