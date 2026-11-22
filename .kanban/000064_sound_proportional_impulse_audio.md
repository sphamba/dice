---
name: "feat: linear impact gain, pair gate and peak limiter"
priority: "high"
state: "reviewing"
worktree: "feat/64-sound-proportional-impulse-audio"
issuer: "#62"
complexity: "simple"
shortName: "sound-proportional-impulse-audio"
---

# Summary
Rework `src/audio/sound.js` so the voice gain is linear in the event impulse, only the strongest event of a pair per batch plays, the 40 ms slot is taken only on a real voice, and the compressor acts as a peak limiter so the output stays free of clipping.

# Specs
## Need
Impact sound intensity must be proportional to the impulse of the impact. This subtask reworks the voice gain, the per-pair gate and the output limiting in `src/audio/sound.js`. Decision: the voice amplitude (gain) is linear in the normal impulse.

## Facts (main, 6d593ef)
- `src/audio/sound.js:28-32` maps impulse to gain on a log scale between `MIN_IMPULSE = 1e-4` and `MAX_IMPULSE = 0.1`.
- `sound.js:156-160` (the `play` loop): speed gate 0.15 m/s, one voice per pair per 40 ms (`PAIR_GAP = 0.04`). The first event in the slot wins even if a later one is stronger. The slot is taken before `playVoice` can return false, so a silent event can block a real impact.
- All voices go through one `DynamicsCompressor` with default settings (`sound.js:146`, in `resume()`). Its default threshold sits inside the common impact range, so it makes the output non-proportional.
- Calibration for `MAX_IMPULSE`: an ideal 2 m/s d12 hit is 1.37e-2 N*s under the new impulse definition, measured Roll peaks reach 1.17e-2 N*s.
- Interface contract: `event.impulse` is the new impulse of the impact (sum of positive deltas over the warm start, landed by a parallel subtask in `src/physics/contacts.js`). The unit tests build synthetic events, so no code dependency on that subtask.

## Change
1. Gain: `gain = min(1, impulse / MAX_IMPULSE)` above `MIN_IMPULSE`, and 0 at or below it. Set `MAX_IMPULSE = 0.015` N*s. Keep `MIN_IMPULSE = 1e-4`.
2. Pair gate:
   - Within one `play()` batch, only the strongest event of each pair is a candidate.
   - Take the 40 ms slot only after `playVoice` returns true.
   - During an open slot, a later event plays only if its impulse is at least 1.5 times the strongest impulse played in this slot.
3. Output limiter: configure the existing compressor as a peak limiter: threshold -3 dB, knee 0, ratio 20, attack 0.003 s, release 0.1 s. If one voice at gain 1 peaks above the threshold, scale all voices by one constant so that it peaks at the threshold. Single impacts stay proportional; only loud overlaps are limited.
4. Keep the mode and pitch selection, the speed-based brightness, the voice cap, the audio unlock on the first gesture and the silence before the context exists.

## Scope limits
Do not add a volume or mute control. Do not touch `src/physics/` (a parallel subtask changes `event.impulse` there). Haptics keep using `event.speed`.

## Tests
In `src/audio/sound.test.js`:
- Double the impulse gives double the gain below the clamp; gain is 1 at and above `MAX_IMPULSE`; gain is 0 at `MIN_IMPULSE`.
- A stronger later event in the same batch wins. An event at least 1.5 times stronger in an open slot plays. A silent event does not take the slot.

## Acceptance
- `npx vitest run src/audio` passes.
- `npm test` passes.
- `npm run build` passes.

# Notes
- `src/audio/sound.js`: `gainForImpulse` is now linear, `min(1, impulse / MAX_IMPULSE)` from 0.015 N*s, and 0 at or below `MIN_IMPULSE = 1e-4`. It is exported for the unit tests.
- `play()` keeps only the strongest event per pair per batch, takes the 40 ms slot after `playVoice` returns true, and lets a later event into an open slot only when its impulse is at least 1.5 times the impulse that played (`SLOT_OVERRIDE`).
- The compressor is a peak limiter: threshold -3 dB, knee 0, ratio 20, attack 0.003 s, release 0.1 s. One constant voice scale (`LIMITER_CEILING / peak`) is measured on the first rendered buffer and applied to every voice.
- Assumptions:
  - The one limiter scale is calibrated on the first rendered voice buffer; a later buffer with a higher waveform peak is not re-measured.
  - `event.impulse` in N*s is delivered by the parallel `src/physics/contacts.js` subtask; the audio module only reads it.
  - Mode and pitch selection, speed brightness, voice cap, unlock gesture and pre-context silence are unchanged.
- Verification: scoped `npx vitest run src/audio` 38 passed; `npm test` 375 passed; `npm run build` passed. HEAD 6474470.
- Blockers: none.
- Manual checks left to other roles: audibility of faint versus hard hits and absence of clipping on loud overlaps in a real browser.
