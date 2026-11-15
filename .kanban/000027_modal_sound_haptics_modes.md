---
name: "feat: modal sound haptics plate modes module"
priority: "medium"
state: "to-do"
worktree: "feat/27-modal-sound-haptics-modes"
issuer: "#9"
complexity: "simple"
shortName: "modal-sound-haptics-modes"
map: "{\"files\":[{\"path\":\"src/audio/modes.js\",\"symbols\":[{\"name\":\"MAX_MODE_FREQUENCY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DEFAULT_MAX_MODES\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"BOX\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"GLASS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_REFERENCE_RADIUS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_BASE_FREQUENCY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_FREQUENCY_STEP\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_MODE_RATIOS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_TAU\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_DAMP_REFERENCE\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"hashType\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"plateModes\",\"kind\":\"fn\",\"ins\":24,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"fn\",\"ins\":18,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/modes.test.js\",\"symbols\":[{\"name\":\"norm\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"gridFrequency\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"oddOddFrequencies\",\"kind\":\"fn\",\"ins\":12,\"del\":0,\"isNew\":true},{\"name\":\"near\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"materials\",\"kind\":\"case\",\"ins\":10,\"del\":0,\"isNew\":true},{\"name\":\"plateModes\",\"kind\":\"case\",\"ins\":52,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"case\",\"ins\":27,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":16,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T21:39:34.920Z\",\"head\":\"3920873\"}"
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
- Deliverable: HEAD `3920873` on `feat/27-modal-sound-haptics-modes`, tree clean, main already merged. `src/audio/modes.js` exports `BOX`/`GLASS` materials, `plateModes(a, b, u, v, material, maxModes = 24)` and `dieModes(type, radius)`, both returning ascending `{ f, amp, tau }` lists; extra exports `MAX_MODE_FREQUENCY = 8000`, `DEFAULT_MAX_MODES = 24`, `DIE_REFERENCE_RADIUS`.
- Deliverable: `src/audio/modes.test.js` covers the four spec assertions plus the 8 kHz cap, count cap, corner silence, plate a/b and u/v symmetry, die range 2 to 7 kHz, per-type variation and size scaling (11 tests).
- Verification: re-verified at HEAD `3920873`: `npx vitest run src/audio/modes.test.js` 11 passed in 413 ms, `npm run build` green with 25 modules, and `dist/index.html` references `./assets/index-BZsgA1fW.js` and `./assets/index-DasNQWd4.css` with relative paths. Export list matches the pinned contract. Verification-only run, no commit.
- Assumption: `DIE_REFERENCE_RADIUS = 0.0139 m`; die frequencies scale as 1/radius, so smaller dice exceed 7 kHz by design (size scaling wins over the band).
- Assumption: `amp` is the absolute mode shape clamped to [0, 1], because the contract requires a non-negative amplitude.
- Assumption: degenerate plates can give equal frequencies for different (m, n), so ordering and decay assertions are non-strict.
- Blocker: none. The pinned consumer `src/audio/sound.js` is owned by the sibling task and is not in this tree yet, so no import wiring is verifiable here.
- Manual checks left to other roles: tune material and die constants by ear once `src/audio/sound.js` exists. The unrelated `src/physics/world.e2e.test.js` wall-clock budget test fails on this machine regardless of this change.
