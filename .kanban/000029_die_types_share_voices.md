---
name: "fix: d4/d10 and d6/d12 die voices are identical (4 distinct sounds for 6 types)"
priority: "low"
state: "done"
worktree: ""
issuer: "#27"
complexity: "simple"
shortName: "die-types-share-voices"
map: "{\"files\":[{\"path\":\"src/audio/modes.js\",\"symbols\":[{\"name\":\"DIE_DETUNE_STEP\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"fn\",\"ins\":2,\"del\":1,\"isNew\":false}]},{\"path\":\"src/audio/modes.test.js\",\"symbols\":[{\"name\":\"gives every die type a distinct voice\",\"kind\":\"case\",\"ins\":9,\"del\":4,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":2,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T22:04:37.331Z\",\"head\":\"4101720\"}"
changes: "{\"base\":\"main\",\"ins\":13,\"del\":5,\"files\":2}"
commits: "[{\"hash\":\"4101720\",\"subject\":\"fix(audio): give every die type a distinct modal voice\",\"when\":\"2026-11-15T23:00:12+01:00\"}]"
---

# Summary
dieModes() derives type variation only from hashType(type) % 5 (base frequency) and % 3 (mode count), and the collisions land so that d4 and d10 produce the exact same 5-mode set while d6 and d12 produce the exact same 4-mode set. Two pairs of dice are sonically indistinguishable, against the spec's "slightly different per type".

# Specs
## Evidence (live test of #27, node driver over src/audio/modes.js)
At the real die radius 0.01386 m:
- d4 and d10 both return f = 2206.9 / 3244.2 / 4259.4 / 5296.6 / 6333.9 Hz (5 modes, identical).
- d6 and d12 both return f = 2407.6 / 3539.1 / 4646.6 / 5778.1 Hz (4 modes, identical).
- d8 (2106.6...) and d20 (2307.2...) are unique. Only 4 distinct voices across the 6 DICE_TYPES.

## Root cause
src/audio/modes.js: the type seed feeds only two weak derivations, `DIE_BASE_FREQUENCY + (seed % 5) * DIE_FREQUENCY_STEP` and `count = 3 + (seed % 3)`. hashType('d4') and hashType('d10') agree mod 5, and hashType('d6') and hashType('d12') agree mod 5 with equal counts, so the full {f, amp, tau} lists coincide.

## Fix direction
Derive per-type variation from more hash entropy, e.g. a per-mode frequency offset from a different modulus of the seed (or seed >> k) applied per mode index, instead of only base and count. Keep the pinned shape and the 2 to 7 kHz band at DIE_REFERENCE_RADIUS.

## Acceptance
- All 6 die types produce pairwise distinct mode sets at DIE_REFERENCE_RADIUS and at the app radius (0.016*sqrt(3)/2).
- Still 3 to 5 modes per type, all f in 2 to 7 kHz at the reference radius, tau short and decreasing, amps decreasing.
- `npx vitest run src/audio/modes.test.js` stays green (extend the per-type variation test to require pairwise distinctness).

# Notes
## Live test (#29, node driver /tmp/dice-lt29/modes-live.mjs over src/audio/modes.js at HEAD 4101720)

Scope: only the die voice flow of this task. The app has no audio consumer yet (#28 in progress), so the driver plays the pinned consumer role: calls dieModes() for all 6 DICE_TYPES at DIE_REFERENCE_RADIUS (0.0139) and at the app radius DIE_RADIUS = 0.016*sqrt(3)/2 from src/physics/body.js, and renders each voice to PCM. Repo test suites not run, per live-test rules.

Results: 8 checks, 0 failed.

| Check | Result |
|---|---|
| 6 types pairwise distinct at DIE_REFERENCE_RADIUS | PASS, 6/6 distinct {f, amp, tau} sets |
| 6 types pairwise distinct at app radius | PASS, 6/6 distinct |
| Former collisions separated | PASS, d4/d10 min relative f separation 1.527%, d6/d12 1.518% (matches the claimed 1.5% offset) |
| Contract at reference radius | PASS, 3-5 modes per type, all f in 2-7 kHz, tau <= 0.0327 s and decreasing, amps 1/0.625/0.455/... decreasing |
| Contract at app radius | PASS, f ascending, top f 6315 Hz, inside the 8 kHz consumer cap |
| Detune band claim | PASS, max abs detune 2.40% over the 6 types, inside the claimed +/-2.4% |
| Consumer render | PASS, all 6 voices peak > 0.1, ring-down < 0.5 s (short click) |
| Unchanged neighbours | PASS, half radius still doubles die f; floor plate lowest mode still f11 = 200 Hz |

Measured mode sets at reference radius (f in Hz):
- d4: 2193.4 / 3224.3 / 4233.3 / 5264.2 / 6295.1 (5 modes)
- d10: 2160.4 / 3175.8 / 4169.6 / 5185.0 / 6200.3 (5 modes)
- d6: 2407.2 / 3538.6 / 4645.9 / 5777.3 (4 modes)
- d12: 2371.2 / 3485.7 / 4576.4 / 5690.9 (4 modes)
- d8: 2118.9 / 3114.8 / 4089.5 (3 modes)
- d20: 2355.2 / 3462.1 / 4545.5 (3 modes)

## Assumptions made while designing the tests
- The real interface of this change is the dieModes() module API, because the app does not wire audio yet (task #28 still in doing). Tested in the pinned consumer role, same approach as the #27 live test.
- "Distinct voice" means a pairwise different mode set, not a perceptual threshold. The measured 1.5% separation matches the task's own accepted separation, so no contradiction.
- Audibility was approximated with an additive decaying-sinusoid render (peak, ring-down), because no playback path exists to listen through.

## Blockers
- None.
