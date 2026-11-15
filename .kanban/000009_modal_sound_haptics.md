---
name: "feat: synthesized impact sounds with plate modes, and haptics"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "modal-sound-haptics"
blockedBy: "#8"
---

# Summary
Play impact sounds made with Web Audio modal synthesis (no audio files): the box floor and walls and the phone glass lid are rectangular plates whose mode amplitudes depend on the contact point, dice have their own modes. Vibrate on strong impacts. No mute toggle.

# Specs
## Context
- Impact events come from `world.events` (task #5), read once per frame in `src/main.js` after `world.update`: `{ a, b, surface: 'floor' | 'lid' | 'wall' | 'die', point, speed (m/s), impulse (N·s) }`.
- Box: footprint `[-W/2, W/2] × [-H/2, H/2]`, floor `z = 0`, lid `z = D` (the phone screen glass). Walls are `W × D` (x walls) and `H × D` (y walls) plates.
- First user gesture hook: `onFirstGesture(fn)` from `src/input/motion.js` (task #7). Browsers start audio only after a gesture.
- No audio files. No mute toggle (the user decided this). The iOS silent switch still applies.

## `src/audio/modes.js` (pure, testable)
- `plateModes(a, b, u, v, material, maxModes)`: simply supported rectangular plate of size `a × b`, contact at local `(u, v)` with `u ∈ [0, a]`, `v ∈ [0, b]`. Mode `(m, n)` frequency `f_mn = material.f11 · ((m/a)² + (n/b)²) / ((1/a)² + (1/b)²)`, amplitude `sin(mπu/a) · sin(nπv/b)`, decay time `τ_mn = material.tau / (1 + material.dampHF · f_mn / material.f11)`. Keep modes with `f < 8 kHz`, sorted by frequency, at most `maxModes` (default 24).
- Materials (exported constants, tune by ear): `BOX` (floor and walls of the tray, wood-like, `f11` about 200 Hz) and `GLASS` (the phone screen lid, `f11` about 900 Hz, longer ring, brighter).
- `dieModes(type, radius)`: a few (3 to 5) high modes for a small acrylic die (2 to 7 kHz, short decay), slightly different per type, scaled by size.

## `src/audio/sound.js`
- `createSound()` returns `{ resume(), play(events, box) }`. Create the `AudioContext` lazily and resume it on the first gesture.
- Per event: choose the plate from `surface` (floor/lid → `W × H` plate at the contact x,y; walls → the wall plate at the contact position on that wall), or the die modes for `die` (sum the modes of both dice). The sound mixes the surface modes with the die modes. Excite with gain from the impulse (log scale) and brightness that rises with `speed` (attenuate higher modes at low speed).
- Synthesis: render a short `AudioBuffer` (sum of damped sinusoids, ≤ 0.6 s) per event, or `OscillatorNode` per mode with gain envelopes. Either is fine. A master `DynamicsCompressorNode` prevents clipping.
- Limits: at most 12 voices at the same time (drop the quietest), at most one sound per body pair per 40 ms, ignore events with `speed < 0.15 m/s`.

## `src/audio/haptics.js`
- `createHaptics()` returns `{ play(events) }`: if `navigator.vibrate` exists, vibrate 5 to 20 ms (scaled with speed) for the strongest event of the frame with `speed > 0.8 m/s`, at most once per 60 ms. No-op where the API is missing (iOS Safari).

## Wiring
- In `src/main.js`: create sound and haptics, `onFirstGesture(sound.resume)`, after each `world.update` call `sound.play(world.events, world.box)` and `haptics.play(world.events)`.

## Tests (`src/audio/modes.test.js`)
- Frequencies ascend, `f_11 = material.f11`, all `< 8 kHz`, count ≤ `maxModes`.
- At the plate center, every mode with even `m` or even `n` has amplitude ≈ 0; at a corner all amplitudes ≈ 0.
- Swapping `a ↔ b` and `u ↔ v` gives the same frequency/amplitude set.
- Higher modes have shorter decay.

## Acceptance criteria
- `npx vitest run src/audio` exits 0.
- `npm run build` exits 0.
- Manual: impacts make sounds after the first tap; a die on the glass lid (phone face-down) sounds different from the floor; a hit near the plate center sounds different from a hit near an edge; Android vibrates on strong hits.

# Notes
