---
name: "feat: make impact sound intensity proportional to the impulse"
priority: "high"
state: "backlog"
worktree: ""
issuer: "user"
complexity: "moderate"
shortName: "sound-proportional-impulse"
---

# Summary
Impact volume uses a logarithmic curve today, and the event impulse includes the resting load. Make the sound amplitude linear in the new normal impulse of each impact, and keep the output free of clipping.

# Specs
## Need
The sound intensity of an impact must be proportional to the impulse of that impact. Decision for this task: the voice amplitude (gain) is linear in the normal impulse.

## Facts (main, 6d593ef)
- `src/audio/sound.js:28-32` maps impulse to gain on a log scale between `MIN_IMPULSE = 1e-4` and `MAX_IMPULSE = 0.1`.
- `src/physics/contacts.js:295-306` emits one event per pair and step. `event.impulse` is the accumulated normal impulse and includes the warm start (`:164`). A resting contact thus carries `m*g*dt`.
- `src/audio/sound.js:156-160`: speed gate 0.15 m/s, one voice per pair per 40 ms. The first event in the slot wins, even if a later one is stronger. The slot is taken before `playVoice` can return false, so a silent event can block a real impact.
- All voices go through one `DynamicsCompressor` with default settings (`sound.js:146`). Its default threshold is inside the common impact range, so it makes the output non-proportional.
- Measured Roll impulses: median 3.5e-4 (d4) to 2.4e-3 N*s (d12), largest 1.17e-2 N*s. An ideal 2 m/s d12 hit is 1.37e-2 N*s.

## Change
1. **Impact impulse.** Store each contact's warm-start normal impulse at `contacts.js:164`. The emitted `event.impulse` becomes the sum over the pair's contacts of `max(0, finalNormalImpulse - warmNormalImpulse)`. Do not change the solver result: accumulators, warm start, restitution and all body motion stay identical. Grep every consumer of `event.impulse` and keep each one correct.
2. **Gain.** `gain = min(1, impulse / MAX_IMPULSE)` above `MIN_IMPULSE`, and 0 at or below it. Set `MAX_IMPULSE = 0.015` N*s. Keep `MIN_IMPULSE = 1e-4`.
3. **Pair gate.**
   - Within one `play()` batch, only the strongest event of each pair is a candidate.
   - Take the 40 ms slot only after `playVoice` returns true.
   - During an open slot, a later event plays only if its impulse is at least 1.5 times the strongest impulse played in this slot.
4. **Output limiter.** Configure the existing compressor as a peak limiter: threshold -3 dB, knee 0, ratio 20, attack 0.003 s, release 0.1 s. If one voice at gain 1 peaks above the threshold, scale all voices by one constant so that it peaks at the threshold. Thus single impacts stay proportional, and only loud overlaps are limited.
5. Keep the mode and pitch selection, the speed-based brightness, the voice cap, the audio unlock on the first gesture and the silence before the context exists. Haptics continue to use `event.speed`.

## Scope limits
Do not add a volume or mute control. Do not change physics constants or mode tables.

## Tests
- In `src/audio/sound.test.js`: double the impulse gives double the gain below the clamp, gain is 1 at and above `MAX_IMPULSE`, and gain is 0 at `MIN_IMPULSE`.
- A stronger later event in the same batch wins. An event at least 1.5 times stronger in an open slot plays. A silent event does not take the slot.
- In `src/physics/contacts.test.js`: a resting contact emits an impact impulse near 0. A flat d6 drop at 2 m/s emits `m(1+e)v` within 1%. A new impact on a loaded pair emits only the new impulse.
- A seeded world run gives the same body states before and after the change.

## Acceptance
- `npx vitest run src/audio src/physics` passes.
- `npm test` passes.
- `npm run build` passes.
- Browser check in Chromium with a spy on the voice gain nodes during real Rolls: for all unclamped voices, `gain / event.impulse` is constant within 1%.
- Browser check with 10 dice: the peak after the limiter, read with an `AnalyserNode`, is at most 1.0.
- Record the measured peak and the voice count in Notes. A listening test is not part of this check.

# Notes
