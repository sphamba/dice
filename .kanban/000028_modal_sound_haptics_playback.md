---
name: "feat: modal sound haptics playback and wiring"
priority: "medium"
state: "to-merge"
worktree: "feat/28-modal-sound-haptics-playback"
issuer: "#9"
complexity: "moderate"
shortName: "modal-sound-haptics-playback"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/audio/haptics.js\",\"symbols\":[{\"name\":\"navigatorVibrate\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"createHaptics\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/haptics.test.js\",\"symbols\":[{\"name\":\"impact\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"recorder\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"does nothing where navigator.vibrate is missing\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts at or below the speed gate\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"vibrates for the strongest impact of the frame only\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"scales the duration between the minimum and the maximum with speed\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"vibrates at most once per gap\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.js\",\"symbols\":[{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"gainForImpulse\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"plateArgs\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"modesFor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"renderModes\",\"kind\":\"fn\",\"ins\":28,\"del\":0,\"isNew\":true},{\"name\":\"createSound\",\"kind\":\"fn\",\"ins\":79,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.test.js\",\"symbols\":[{\"name\":\"die\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"impact\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"fakeAudio\",\"kind\":\"fn\",\"ins\":56,\"del\":0,\"isNew\":true},{\"name\":\"beforeEach\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"afterEach\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"stays silent until resume creates the audio context\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"creates one context on resume and routes through a compressor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"does not resume without an audio context constructor\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts below the speed gate\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"renders one damped-sinusoid buffer per impact\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"mixes the die modes for die-to-die impacts\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"plays each plate surface without failing\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"raises the gain with the impulse\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"limits one body pair to one voice per gap\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"caps the voice count and drops the quietest voice\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true}]},{\"path\":\"src/main.js\",\"symbols\":[{\"name\":\"frame\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":5,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T21:05:58.680Z\",\"head\":\"4efc79b\"}"
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
- Deliverable: commit 4efc79b, unchanged this run. `src/audio/sound.js` (lazy AudioContext on resume, DynamicsCompressor master, one rendered damped-sinusoid AudioBuffer per impact <= 0.6 s, `MAX_VOICES = 12` dropping the quietest, one voice per body pair per 40 ms, `MIN_EVENT_SPEED = 0.15`), `src/audio/haptics.js` (`navigator.vibrate` 5-20 ms scaled by speed, strongest event with `MIN_SPEED = 0.8`, `GAP_MS = 60`, feature-gated no-op), both suites, and `src/main.js` wiring.
- Verification: HEAD 4efc79b unchanged, re-run against `main` (4101720) which now carries `src/audio/modes.js` and `modes.test.js`. With that module staged temporarily from `git show main:src/audio/modes.js` (removed afterwards): `npx vitest run src/audio` = 2 files, 15 tests passed. `npm run build` exits 0 (44.04 kB bundle). `dist/index.html` uses relative `./assets/index-BWOSxVib.js` and `./assets/index-DasNQWd4.css` paths. Staged copy removed, `git status` clean.
- Verification: wiring greps at `src/main.js` lines 11-12 (imports), 50-51 (`createSound`/`createHaptics`), 53 (`onFirstGesture(() => sound.resume())`), 173-174 (`sound.play(world.events, world.box)`, `haptics.play(world.events)`) directly after `world.update`.
- Assumption: sound.js imports exactly `BOX`, `GLASS`, `plateModes`, `dieModes` from `./modes.js`, matching the landed sibling exports.
- Assumption: impulse gain is a log ramp from 1e-4 to 1e-1 N s, and high-mode brightness reaches full at 2 m/s.
- Assumption: haptic duration ramps linearly from 0.8 to 3 m/s, and synthesis duration is `min(0.6 s, 5 tau)` over the loudest mode's tau.
- Assumption: wall plates follow the spec literally (x wall W x D, y wall H x D, u along the wide axis, v = contact z), the wall side chosen by the larger contact coordinate against its half extent.
- Assumption: `die` surface events sum `dieModes(type, radius)` for both bodies from `body.shape`, with no plate mode added.
- Blocker: the earlier missing-`modes.js` blocker is cleared, `main` now holds it (3920873 plus mode-voice fix 4101720). Remaining: this branch diverged from `main`, so `git merge --ff-only main` no longer applies. Unblock at the merge role: a real merge (or rebase) of 4efc79b onto `main`. The branch stays free of the sibling file.
- Manual checks left to other roles: audible sound and Android vibration on parent verification task #9.
