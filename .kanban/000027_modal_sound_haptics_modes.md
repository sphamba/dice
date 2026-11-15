---
name: "feat: modal sound haptics plate modes module"
priority: "medium"
state: "live-testing"
worktree: "feat/27-modal-sound-haptics-modes"
issuer: "#9"
complexity: "simple"
shortName: "modal-sound-haptics-modes"
map: "{\"files\":[{\"path\":\"src/audio/modes.js\",\"symbols\":[{\"name\":\"MAX_MODE_FREQUENCY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DEFAULT_MAX_MODES\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"BOX\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"GLASS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_REFERENCE_RADIUS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_BASE_FREQUENCY\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_FREQUENCY_STEP\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_MODE_RATIOS\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_TAU\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"DIE_DAMP_REFERENCE\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"hashType\",\"kind\":\"fn\",\"ins\":7,\"del\":0,\"isNew\":true},{\"name\":\"clamp\",\"kind\":\"fn\",\"ins\":3,\"del\":0,\"isNew\":true},{\"name\":\"plateModes\",\"kind\":\"fn\",\"ins\":25,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"fn\",\"ins\":17,\"del\":0,\"isNew\":true}]},{\"path\":\"src/audio/modes.test.js\",\"symbols\":[{\"name\":\"norm\",\"kind\":\"fn\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"gridFrequency\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"oddOddFrequencies\",\"kind\":\"fn\",\"ins\":11,\"del\":0,\"isNew\":true},{\"name\":\"near\",\"kind\":\"fn\",\"ins\":2,\"del\":0,\"isNew\":true},{\"name\":\"materials\",\"kind\":\"case\",\"ins\":9,\"del\":0,\"isNew\":true},{\"name\":\"plateModes\",\"kind\":\"case\",\"ins\":45,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"case\",\"ins\":23,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":20,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T21:47:37.321Z\",\"head\":\"3920873\"}"
changes: "{\"base\":\"main\",\"ins\":225,\"del\":0,\"files\":2}"
commits: "[{\"hash\":\"3920873\",\"subject\":\"feat(audio): add plate and die modal synthesis module\",\"when\":\"2026-11-15T21:30:09+01:00\"}]"
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
## Live test report (usage test of this task #27)

### How the test ran
- The change is a pure math module with no browser, DOM, or Web Audio code, and the pinned consumer src/audio/sound.js is not in this tree. The real interface is therefore the module API. A node driver (/tmp/dice-lt27/modes-live.mjs) played the consumer role: impact events in, {f, amp, tau} voice lists out, then each voice rendered as a sum of amp*sin(2*pi*f*t)*exp(-t/tau) to check the audible outcome (peak, ring-down time).
- Fixtures come from the app itself: boxFromViewport(393, 852, 3) gives a 0.0681 x 0.1476 x 0.0681 m phone box, dice spawn with radius 0.01386 m (DIE_RADIUS), types d4 to d20. The driver ran all 14 checks in about 1 s.
- No repo test suites were run and no code was edited. The vitest suite and npm run build named in the acceptance criteria stay with the developer role.

### Assumptions made when designing the usage tests
- The consumer maps surfaces to plates as: floor and lid are W x H, x walls span H x D, y walls span W x D, with (u, v) the contact point moved into [0, a] x [0, b]. The spec pins the plate sizes but not the axis order, so both orientations were exercised (wall plates and the a/b swap check).
- A user-level "sound" is the mode sum above. Ring time runs from the waveform peak to the last sample at 10% of the peak, sampled at 24 kHz over 2.5 s.
- The 2 to 7 kHz die band is asserted at the real die radius 0.01386 m (scale 1.0032 against DIE_REFERENCE_RADIUS).

### Results
| Check | Result |
| --- | --- |
| Pinned exports: MAX_MODE_FREQUENCY 8000, DEFAULT_MAX_MODES 24, DIE_REFERENCE_RADIUS 0.0139 | PASS |
| Realistic 5-event impact frame (floor, x wall, lid, y wall, die-on-die) gives valid contract voices | PASS |
| Floor BOX hit: lowest mode 200 Hz, <= 24 modes, audible, decays (ring 0.20 s) | PASS |
| Lid GLASS hit: lowest mode 900 Hz, rings longer (0.90 s vs 0.20 s), tau 0.621 s vs 0.194 s | PASS |
| Corner contacts on all plates silent (peak < 1e-9) | PASS |
| Center hit: even modes silent (17), odd/odd full amp (7), list matches the spec formula | PASS |
| a<->b with u<->v swap gives the same mode set (rect and tie-prone square plate) | PASS |
| maxModes: 5 keeps the lowest 5, 0 gives none, default caps at 24 (70 modes exist under 8 kHz) | PASS |
| x and y wall plates: valid voices, f11 = 200 Hz | PASS |
| Die voices: 3 to 5 modes, 2 to 7 kHz at the real radius, tau <= 0.05 s, amps decreasing | PASS |
| Die voices differ per type | FAIL, see #29 |
| Half radius doubles die frequencies exactly, top modes leave the 7 kHz band | PASS |
| dieModes() default radius equals DIE_REFERENCE_RADIUS | PASS |
| Contact slightly outside the plate clamps and stays silent, no throw | PASS |

### Finding
- #29 (filed): d4/d10 and d6/d12 return identical mode sets, so only 4 of 6 die types sound different. This contradicts the spec's "slightly different per type".

### Observations, no defect
- A floor-center hit sounds only 7 of the 24 modes (even m or n silenced); off-center hits excite more modes. Matches the spec mode shape.
- Smaller dice leaving the 7 kHz band is by design per the task's size-scaling assumption; observed consistent (half radius: lowest mode 4815 Hz stays in band, top modes reach 11556 Hz).
- BOX floor ring 0.20 s vs GLASS lid ring 0.90 s. Matches the material intent (wood tray, brighter longer glass ring).

### Limits
- Material constants (f11, tau, dampHF) and die constants can only be judged by ear once src/audio/sound.js lands. This test checks structure and relative behavior only.
- Two measurement bugs in the test driver itself (waveform zero crossings read as ring-down, an over-strict band assert) were fixed in the harness before judging results. They were not product issues.
