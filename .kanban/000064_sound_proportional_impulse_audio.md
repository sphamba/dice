---
name: "feat: linear impact gain, pair gate and peak limiter"
priority: "high"
state: "to-live-test"
worktree: "feat/64-sound-proportional-impulse-audio"
issuer: "#62"
complexity: "simple"
shortName: "sound-proportional-impulse-audio"
changes: "{\"base\":\"main\",\"ins\":136,\"del\":13,\"files\":2}"
commits: "[{\"hash\":\"6474470\",\"subject\":\"feat: linear impact gain, pair gate and peak limiter\",\"when\":\"2026-11-22T22:13:53+01:00\"}]"
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
- Review outcome: approved, no fixes needed (HEAD 6474470, clean tree, diff = sound.js + sound.test.js only).
- Spec 1 gain: `gainForImpulse` = `min(1, impulse / MAX_IMPULSE)` with 0 at/below `MIN_IMPULSE = 1e-4`, `MAX_IMPULSE = 0.015`; exported and covered by linear-ratio, clamp and silence tests.
- Spec 2 pair gate: `play()` picks the strongest event per `pairKey` before the voice loop, skips non-strongest; slot is written only after `playVoice` returns true; open-slot replay needs `impulse >= 1.5 * slot.impulse` (`SLOT_OVERRIDE`), slot impulse records the played event so it stays the strongest played. All three behaviors have tests (strongest-of-batch wins, 1.5x override, silent event does not take the slot).
- Spec 3 limiter: compressor configured threshold -3 dB, knee 0, ratio 20, attack 0.003 s, release 0.1 s, asserted per parameter; one constant `voiceScale` from the first measured buffer peak multiplies every voice. The developer-stated assumption stands: later buffers with a higher waveform peak are not re-measured; the ratio-20 limiter is the backstop, accepted.
- Spec 4 kept behaviors: mode/pitch selection, speed brightness, voice cap, unlock gesture, pre-context silence untouched; existing tests still pass. Haptics still read `event.speed`; no volume/mute control added; no src/physics changes.
- Edge noted, accepted: strongest-of-batch is picked before the speed gate, so a sub-gate strongest silences faster weaker siblings of the same pair in one batch; real events from contacts.js are always well-formed objects, no impact on direction.
- Evidence: `npx vitest run src/audio` 38/38 passed, `npm test` 375/375 passed (28 files), `npm run build` passed.
- Manual checks left to other roles: audibility of faint versus hard hits, absence of clipping on loud overlaps in a real browser.
