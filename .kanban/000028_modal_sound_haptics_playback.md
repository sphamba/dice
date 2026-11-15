---
name: "feat: modal sound haptics playback and wiring"
priority: "medium"
state: "done"
worktree: "feat/28-modal-sound-haptics-playback"
issuer: "#9"
complexity: "moderate"
shortName: "modal-sound-haptics-playback"
splitter: "done"
map: "{\"files\":[{\"path\":\"src/audio/haptics.js\",\"symbols\":[{\"name\":\"navigatorVibrate\",\"kind\":\"fn\",\"ins\":4,\"del\":0,\"isNew\":true},{\"name\":\"createHaptics\",\"kind\":\"fn\",\"ins\":16,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/haptics.test.js\",\"symbols\":[{\"name\":\"does nothing where navigator.vibrate is missing\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts at or below the speed gate\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"vibrates for the strongest impact of the frame only\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"scales the duration between the minimum and the maximum with speed\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"vibrates at most once per gap\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.js\",\"symbols\":[{\"name\":\"gainForImpulse\",\"kind\":\"fn\",\"ins\":5,\"del\":0,\"isNew\":true},{\"name\":\"plateArgs\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"modesFor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"renderModes\",\"kind\":\"fn\",\"ins\":28,\"del\":0,\"isNew\":true},{\"name\":\"createSound\",\"kind\":\"fn\",\"ins\":79,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/sound.test.js\",\"symbols\":[{\"name\":\"fakeAudio\",\"kind\":\"fn\",\"ins\":56,\"del\":0,\"isNew\":true},{\"name\":\"stays silent until resume creates the audio context\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"creates one context on resume and routes through a compressor\",\"kind\":\"fn\",\"ins\":8,\"del\":0,\"isNew\":true},{\"name\":\"does not resume without an audio context constructor\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"ignores impacts below the speed gate\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"renders one damped-sinusoid buffer per impact\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"mixes the die modes for die-to-die impacts\",\"kind\":\"fn\",\"ins\":6,\"del\":0,\"isNew\":true},{\"name\":\"plays each plate surface without failing\",\"kind\":\"fn\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"raises the gain with the impulse\",\"kind\":\"fn\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"limits one body pair to one voice per gap\",\"kind\":\"fn\",\"ins\":14,\"del\":0,\"isNew\":true},{\"name\":\"caps the voice count and drops the quietest voice\",\"kind\":\"fn\",\"ins\":13,\"del\":0,\"isNew\":true}]},{\"path\":\"src/main.js\",\"symbols\":[{\"name\":\"else\",\"kind\":\"case\",\"ins\":7,\"del\":1,\"isNew\":false},{\"name\":\"frame\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":false}]}],\"flows\":[],\"role\":\"developer\",\"run\":10,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T22:18:36.633Z\",\"head\":\"a968634\"}"
changes: "{\"base\":\"main\",\"ins\":444,\"del\":1,\"files\":5}"
commits: "[{\"hash\":\"a968634\",\"subject\":\"feat(audio): play modal synthesis impact sounds and haptics\",\"when\":\"2026-11-15T21:39:33+01:00\"}]"
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
Live test (real usage in headless Chromium via Playwright, serving dist of commit a968634 from the worktree; page-level instrumentation only, no source edits): all checks pass, no product defects found, no defect cards filed.

Harness: init-script spies on the AudioContext constructor and resume, createDynamicsCompressor, AudioBufferSourceNode.start (buffer duration, length, peak amplitude), AudioNode.connect edges, and navigator.vibrate. Viewports 390x844@2 and 866x1790@2 (the latter gives box D ≈ 0.1 m so spawn-fall impacts cross the 0.8 m/s haptic gate).

Results (all pass):
- Sound is fully silent before the first gesture: 0 AudioContexts, 0 buffer renders, 0 voices while the dice fall on load.
- The first gesture creates exactly 1 AudioContext and 1 DynamicsCompressor; later gestures reuse the same context.
- Routing is BufferSource -> Gain -> DynamicsCompressor -> AudioDestination.
- Roll button: 5-9 voices per roll; every rendered buffer is <= 0.600 s, non-silent (peaks 0.63-0.93), voice gains 0.15-0.57 inside (0,1]; voices receive ended events (released).
- Panel '+': the added die falls and sounds.
- Drag-fling onto a die (frame-guided pick at css 261,432): 17 voices and 12 vibrate calls in one window, no errors.
- Haptics: vibrate only for impacts over 0.8 m/s (2-12 calls per session), durations 6-7 ms, consistent with measured speeds just over the gate and inside the 5-20 ms range; fires pre-gesture too (spec has no gesture requirement); none while idle.
- Speed gate quiet side: settled dice produce 0 starts over 2.2 s idle.
- 0 pageerrors, 0 console errors, 0 failed requests across all runs.

Environment limits (not product issues):
- Headless SwiftShader renders 2-6 fps, so physics runs in slow motion and the 40 ms pair gap, 60 ms haptic gap, and 12-voice cap cannot be violated live (the frame interval exceeds the gaps). These stay covered by the unit suite.
- The headless AudioContext is created already 'running' (also with --autoplay-policy=user-gesture-required), so the suspended -> resume() branch never ran live. Unit-covered.
- Playwright actionability waits on .panel-roll stall about 10 s at 2 fps (frame pacing); worked around with raw mouse clicks at button coordinates.
- Audible loudness/quality and real Android vibration remain manual checks for task #9 per the task.

Test-design assumptions:
- Spawn-fall impact speeds: about 0.6-0.85 m/s at D = 0.05 m (MIN_BOX_EDGE clamp) and 0.84-1.19 m/s at D = 0.1 m, derived from box.js geometry (METERS_PER_DEVICE_PIXEL, MIN_BOX_EDGE) to choose a viewport that crosses the 0.8 m/s haptic gate.
- Sweep speeds during flings were about 0.4-0.7 m/s, below MAX_FLING_SPEED; the die still hit walls above 0.8 m/s (12 vibrates).
- The panel is visually near-invisible on the dark theme, but clicks land (elementFromPoint = BUTTON.panel-roll); panel styling is out of scope here.
- Buffer duration/peak/gain were read at start time via wrappers; synthesis internals beyond that were not inspected.
