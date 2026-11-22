---
name: "feat: linear impact gain, pair gate and peak limiter"
priority: "high"
state: "live-testing"
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
Live test in progress (watch checkpoint).

## Progress so far
- Read TASK.md, sound.js, main.js, pointer.js, panel.js, world.js/box.js/roll.js; harvested precedent /tmp/dice-lt-audio (proven method: route-patch sound.js in-browser to inject __onPlay/__onVoice observers; init.js wraps AudioBufferSourceNode.start to capture per-voice gain + buffer, AudioContext lifecycle; no repo code edits).
- Constants table from source: MIN_EVENT_SPEED 0.15 m/s (sound.js:3), PAIR_GAP 0.04 s (:5), SLOT_OVERRIDE 1.5 (:7), MAX_VOICES 12 (:9), MIN_IMPULSE 1e-4 N*s (:15), MAX_IMPULSE 0.015 N*s (:17), LIMITER_THRESHOLD_DB -3 (:19), LIMITER_CEILING 0.70795 (:20).
- Harness: /tmp/dice-lt64/init.js written (precedent init + compressor node capture, analyser tapped compressor->destination for real output peaks, per-event pairKey tagging, __readOut output-peak sampler). Driver next, then vite serve on port 4619.

## Planned checks (each maps to a spec)
- C1 (spec 4): pre-gesture floor-impact events occur but no AudioContext, no voices (silence before context); first click creates + resumes context.
- C2 (spec 3): compressor params threshold -3, knee 0, ratio 20, attack 0.003, release 0.1.
- C3 (spec 1): played voice gain == min(1, impulse/MAX_IMPULSE)*voiceScale exactly; gain/impulse ratio constant below clamp; sub-MIN_IMPULSE events never play.
- C4 (spec 2): per batch per pair, only the strongest event plays.
- C5 (spec 2): pair whose batch-strongest is silent (impulse <= MIN_IMPULSE) takes no slot; a later batch within 40 ms still plays.
- C6 (spec 2): open-slot replay only at impulse >= 1.5x slot impulse (data-driven from real rolls; if no natural case, recorded as harness limit, unit-covered).
- C7 (spec 3): single voiceScale constant across session; real output peaks never reach 1.0 (no clipping); loud-overlap output peaks stay near single-voice peaks (limiter flat), compressor reduction < 0 during overlaps.
- C8 (spec 4 kept): <= 12 concurrent voices, buffer durations within [50, 600] ms.

## Assumptions/limits so far
- Pointer fling phase dropped: MAX_FLING_SPEED = 3 m/s over an 80 ms sample window cannot exceed roll impacts (rise speeds ~3.8 m/s; measured roll peaks 1.17e-2 per task Facts), and synthetic pointer events would fail setPointerCapture. Rolls + spawn drops are the real-usage impact generators.
- Live data may never reach the gain = 1 clamp (roll peaks 1.17e-2 < MAX_IMPULSE 1.5e-2): clamp covered by unit tests; live evidence limited to the linear range if so.
- No live runs yet, no defects found yet.
