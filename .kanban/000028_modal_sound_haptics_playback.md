---
name: "feat: modal sound haptics playback and wiring"
priority: "medium"
state: "merging"
worktree: "feat/28-modal-sound-haptics-playback"
issuer: "#9"
complexity: "moderate"
shortName: "modal-sound-haptics-playback"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/audio/haptics.js\",\"symbols\":[{\"name\":\"navigatorVibrate\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"createHaptics\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/haptics.test.js\",\"symbols\":[{\"name\":\"does nothing where navigator.vibrate is missing\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts at or below the speed gate\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"vibrates for the strongest impact of the frame only\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"scales the duration between the minimum and the maximum with speed\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"vibrates at most once per gap\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.js\",\"symbols\":[{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"gainForImpulse\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"plateArgs\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"modesFor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"renderModes\",\"kind\":\"fn\",\"ins\":28,\"del\":0,\"isNew\":true},{\"name\":\"createSound\",\"kind\":\"fn\",\"ins\":79,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.test.js\",\"symbols\":[{\"name\":\"fakeAudio\",\"kind\":\"fn\",\"ins\":56,\"del\":0,\"isNew\":true},{\"name\":\"FakeContext\",\"kind\":\"class\",\"ins\":52,\"del\":0,\"isNew\":true},{\"name\":\"stays silent until resume creates the audio context\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"creates one context on resume and routes through a compressor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"does not resume without an audio context constructor\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts below the speed gate\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"renders one damped-sinusoid buffer per impact\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"mixes the die modes for die-to-die impacts\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"plays each plate surface without failing\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"raises the gain with the impulse\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"limits one body pair to one voice per gap\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"caps the voice count and drops the quietest voice\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true}]},{\"path\":\"src/main.js\",\"symbols\":[{\"name\":\"main\",\"kind\":\"fn\",\"ins\":7,\"del\":1,\"isNew\":false},{\"name\":\"frame\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":2,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T20:52:15.642Z\",\"head\":\"4efc79b\"}"
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
- Deliverable is commit 4efc79b: `src/audio/sound.js` (lazy AudioContext, DynamicsCompressor master, one rendered damped-sinusoid AudioBuffer per impact, voice cap 12 dropping the quietest, 40 ms per body pair, speed gate 0.15 m/s), `src/audio/haptics.js` (navigator.vibrate 5-20 ms scaled by speed, once per 60 ms, no-op without the API), both suites, and `src/main.js` wiring (line 53 `onFirstGesture(() => sound.resume())`; lines 172-174 `world.update(dt)`, `sound.play(world.events, world.box)`, `haptics.play(world.events)`).
- Re-verified on 4efc79b against sibling #27 at 3920873 with `src/audio/modes.js` copied in and removed after: `npx vitest run src/audio` = 15 passed, `npm run build` exits 0, tree clean afterwards, `dist/index.html` uses relative `./assets/...` paths.
- Assumption: sound.js imports exactly `BOX`, `GLASS`, `plateModes`, `dieModes` from `./modes.js`, which matches the sibling's exports.
- Blocker: sibling #27 is still in `to-merge` and `main` has no `src/audio/modes.js`, so this branch alone cannot resolve `./modes.js` (red tests, red build). The branch stays free of the sibling file; it goes green after #27 lands on `main` plus one `git merge --ff-only main`.
- Assumption: impulse gain is a log ramp from MIN_IMPULSE 1e-4 to MAX_IMPULSE 1e-1 N s, and high-mode brightness reaches full at FULL_BRIGHTNESS_SPEED 2 m/s.
- Assumption: haptic duration ramps linearly from 0.8 to 3 m/s, and synthesis duration is `min(0.6 s, 5 tau)` over the loudest mode's tau.
- Assumption: wall plates follow the spec literally (x wall W x D, y wall H x D, u along the wide axis, v = contact z), wall side chosen by the larger contact coordinate relative to its half extent.
- Assumption: `die` surface events sum `dieModes(type, radius)` for both bodies from `body.shape`, with no plate mode added.
- Audible sound and Android vibration checks stay with parent verification task #9, as specified.
