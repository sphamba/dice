---
name: "fix: d4/d10 and d6/d12 die voices are identical (4 distinct sounds for 6 types)"
priority: "low"
state: "to-do"
worktree: "fix/29-die-types-share-voices"
issuer: "#27"
complexity: "simple"
shortName: "die-types-share-voices"
map: "{\"files\":[{\"path\":\"src/audio/modes.js\",\"symbols\":[{\"name\":\"DIE_DETUNE_STEP\",\"kind\":\"class\",\"ins\":1,\"del\":0,\"isNew\":true},{\"name\":\"dieModes\",\"kind\":\"fn\",\"ins\":2,\"del\":1,\"isNew\":false}]},{\"path\":\"src/audio/modes.test.js\",\"symbols\":[{\"name\":\"gives every die type a distinct voice\",\"kind\":\"case\",\"ins\":9,\"del\":4,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T22:00:39.096Z\",\"head\":\"4101720\"}"
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
## Deliverable
- `src/audio/modes.js`: `dieModes()` now applies a per-type detune from a second hash modulus (`(seed % 17 - 8) * 0.003`, range ±2.4%) on top of the existing base frequency and mode count. Ratios, amplitudes, and tau derivation are unchanged. This separates the former d4/d10 and d6/d12 collisions (1.5% frequency offset) while keeping every mode in the pinned 2 to 7 kHz band at `DIE_REFERENCE_RADIUS`.
- `src/audio/modes.test.js`: replaced the single d4 vs d20 check with a pairwise distinctness test over all six types at both `DIE_REFERENCE_RADIUS` and the app radius `0.016*sqrt(3)/2`.

## Verification
- `npx vitest run src/audio/modes.test.js`: 11 passed. Test failed before the fix (4 distinct voices) and passes after (6 distinct).
- `npm run build`: green.

## Assumptions
- "Distinct voice" means a pairwise different frequency set, not a perceptual threshold. A 1.5% detune is the accepted separation.
- App radius `0.016*sqrt(3)/2` is the intended live radius and differs from `DIE_REFERENCE_RADIUS` only by scaling, so distinctness carries over.
- The detune constant is tuned for the six current `DICE_TYPES`; a future type whose `seed % 17` is near an extreme could need a band recheck.

## Blockers
- None.

