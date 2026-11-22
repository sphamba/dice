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
The work is split into subtasks #63 (physics: `event.impulse` is the new impulse, delta over the warm start) and #64 (audio: linear gain, pair gate, peak limiter). This task only verifies the combination; implement nothing here.

## Checks
- `npx vitest run src/audio src/physics` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium with a spy on the voice gain nodes during real Rolls: for all unclamped voices, `gain / event.impulse` is constant within 1%.
- Browser check with 10 dice: the peak after the limiter, read with an `AnalyserNode`, is at most 1.0.
- Mode and pitch selection, speed-based brightness, voice cap, audio unlock on the first gesture, silence before the context exists, and haptics on `event.speed` still work.
- Record the measured peak and the voice count in Notes. A listening test is not part of this check.

# Notes
Live-check in progress (headless chromium, dev server on 127.0.0.1:5317, harness /tmp/dice-live/run.mjs).

Probe plumbing validated: 1 gain per voice, gain 0 events for impulse 0 and for speed 0.05 (< 0.15 gate), analyser strictly after the limiter (comp -> analyser -> target), limiter tap alive at 48 kHz, context created only after the gesture (25 pre-gesture play batches logged, all played 0 voices, __comp undefined before click, defined after, state running).

One numeric detail that is NOT a plumbing bug: the 0.0075 / 'lid' fixture voice records gain 0.46434 instead of 0.5, because the rendered buffer peak is 0.762253 > LIMITER_CEILING 0.707946, so the app latched voiceScale = 0.928681. An independent recomputation of that latch (peak of AudioBuffer.getChannelData(0) at source.start of the first voice = 0.9286809424) reproduces the recorded gain to 7e-9, i.e. only AudioParam float32 rounding. The spec's own caveat allows this ("voiceScale = 1 unless the rendered buffer peak exceeded 0.708"), so I am tightening the fixture tolerance to 1e-6 and will report voiceScale = 0.928681 rather than 1.

Next on release: rerun the three fixture cases, then scenario A (6 d6, 6 Rolls, gain/impulse spread) and scenario B (10 d6, 5 Rolls, post-limiter peak, frames, max voices), screenshot, then kill the dev-server PID.
