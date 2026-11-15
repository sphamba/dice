---
name: "feat: modal sound haptics plate modes module"
priority: "medium"
state: "backlog"
worktree: ""
issuer: "#9"
complexity: "simple"
shortName: "modal-sound-haptics-modes"
---

# Summary
Pure modal-synthesis module src/audio/modes.js (plate modes, die modes, materials) plus its vitest suite. No browser or Web Audio code in this task; src/audio/sound.js consumes it via the pinned contract below (sibling task, runs in parallel).

# Specs
## Context
- Impact events come from `world.events` (populated by `src/physics/contacts.js`, read per frame elsewhere): `{ a, b, surface: 'floor' | 'lid' | 'wall' | 'die', point, speed (m/s), impulse (N·s) }`. This task only builds the mode math.
- Box: footprint `[-W/2, W/2] × [-H/2, H/2]`, floor `z = 0`, lid `z = D` (the phone screen glass). Walls are `W × D` (x walls) and `H × D` (y walls) plates.
- Pure math, runnable in node under vitest. No audio files, no Web Audio, no DOM.

## Shared contract (pinned, do not change)
- Materials: exported constant plain objects `{ f11, tau, dampHF }`: `BOX` (tray floor and walls, wood-like, f11 about 200 Hz) and `GLASS` (phone screen lid, f11 about 900 Hz, longer ring, brighter). Tune constants by ear later; pick sane starting values.
- `plateModes(a, b, u, v, material, maxModes)` and `dieModes(type, radius)` both return an array of mode objects `[{ f, amp, tau }, ...]` sorted by ascending `f`, where `f` is Hz, `amp` is in [0, 1], `tau` is seconds. `src/audio/sound.js` consumes exactly this shape.

## src/audio/modes.js
- `plateModes(a, b, u, v, material, maxModes)`: simply supported rectangular plate of size `a × b`, contact at local `(u, v)` with `u ∈ [0, a]`, `v ∈ [0, b]`. Mode `(m, n)` frequency `f_mn = material.f11 · ((m/a)² + (n/b)²) / ((1/a)² + (1/b)²)`, amplitude `sin(mπu/a) · sin(nπv/b)`, decay time `τ_mn = material.tau / (1 + material.dampHF · f_mn / material.f11)`. Keep modes with `f < 8 kHz`, sorted by frequency, at most `maxModes` (default 24).
- `dieModes(type, radius)`: a few (3 to 5) high modes for a small acrylic die (2 to 7 kHz, short decay), slightly different per type, scaled by size.

## Tests (src/audio/modes.test.js)
- Frequencies ascend, `f_11 = material.f11`, all `< 8 kHz`, count ≤ `maxModes`.
- At the plate center, every mode with even `m` or even `n` has amplitude ≈ 0; at a corner all amplitudes ≈ 0.
- Swapping `a ↔ b` and `u ↔ v` gives the same frequency/amplitude set.
- Higher modes have shorter decay.

## Acceptance criteria
- `npx vitest run src/audio/modes.test.js` exits 0.
- `npm run build` exits 0.

# Notes
