---
name: "feat: modal sound haptics playback and wiring"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "#9"
complexity: "moderate"
shortName: "modal-sound-haptics-playback"
---

# Summary
Web Audio playback src/audio/sound.js, vibration src/audio/haptics.js, and main.js wiring for synthesized impact sounds and haptics. Develops against src/audio/modes.js (sibling task, runs in parallel) via the pinned contract below.

# Specs
## Context
- Impact events from `world.events`, read once per frame in `src/main.js` after `world.update`: `{ a, b, surface: 'floor' | 'lid' | 'wall' | 'die', point, speed (m/s), impulse (N·s) }` (see `src/physics/contacts.js`).
- `world.box` is `{ W, H, D }`: footprint `[-W/2, W/2] × [-H/2, H/2]`, floor `z = 0`, lid `z = D` (the phone screen glass). Walls are `W × D` (x walls) and `H × D` (y walls) plates.
- First user gesture hook: `onFirstGesture(fn)` from `src/input/motion.js`. Browsers start audio only after a gesture.
- Modes come from `src/audio/modes.js` (sibling task, developed in parallel; do not change that file): `plateModes(a, b, u, v, material, maxModes = 24)` and `dieModes(type, radius)` return `[{ f, amp, tau }, ...]` sorted by ascending `f`; materials `BOX` (tray floor and walls) and `GLASS` (lid) are exported constants. Code against this contract. If modes.js has not landed when you finish, leave the audible manual check to the parent verification task (#9).
- No audio files. No mute toggle (decided). The iOS silent switch still applies. `navigator.vibrate` is missing on iOS Safari: no-op there.

## src/audio/sound.js
- `createSound()` returns `{ resume(), play(events, box) }`. Create the `AudioContext` lazily and resume it on the first gesture.
- Per event: choose the plate from `surface` (floor/lid → `W × H` plate at the contact x,y; walls → the wall plate at the contact position on that wall), or the die modes for `die` (sum the modes of both dice). The sound mixes the surface modes with the die modes. Excite with gain from the impulse (log scale) and brightness that rises with `speed` (attenuate higher modes at low speed).
- Synthesis: render a short `AudioBuffer` (sum of damped sinusoids, ≤ 0.6 s) per event, or `OscillatorNode` per mode with gain envelopes. Either is fine. A master `DynamicsCompressorNode` prevents clipping.
- Limits: at most 12 voices at the same time (drop the quietest), at most one sound per body pair per 40 ms, ignore events with `speed < 0.15 m/s`.

## src/audio/haptics.js
- `createHaptics()` returns `{ play(events) }`: if `navigator.vibrate` exists, vibrate 5 to 20 ms (scaled with speed) for the strongest event of the frame with `speed > 0.8 m/s`, at most once per 60 ms. No-op where the API is missing (iOS Safari).

## Wiring
- In `src/main.js`: create sound and haptics, `onFirstGesture(sound.resume)`, after each `world.update` call `sound.play(world.events, world.box)` and `haptics.play(world.events)`.

## Acceptance criteria
- `npm run build` exits 0.
- Wiring calls sound.play and haptics.play per frame and resumes audio on the first gesture.
- Audible sound and Android vibration manual checks happen at the parent verification task (#9), not here.

# Notes
