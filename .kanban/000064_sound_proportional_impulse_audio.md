---
name: "feat: linear impact gain, pair gate and peak limiter"
priority: "high"
state: "done"
worktree: ""
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
Live test done (r4, clean full run, 30 checks): 29 PASS, 1 finding handed to #62 per PM steer. No defect cards filed against #64.

## Handed to #62
- C7 output clipping: on loud overlaps the real rendered stream past the compressor peaks at 1.161 (> 1.0 full scale), with voiceScale = 1 (first buffer peak 0.6156 < ceiling 0.708, so no down-scale was applied). 32 loud-overlap windows, compressor reduction reached -3.703 dB steady, but burst onsets overshoot the limiter: 12+ voices start within the same few ms and the 3 ms attack lets the transient sum through before gain reduction engages. PM steer: #62 owns the no-clipping check (fixed scale LIMITER_CEILING + rerun of the 10-dice peak check); no card filed here.

## Results (r4, spec by spec)
- C1 silence-before-context + first-gesture unlock (spec 4): PASS. After a fresh page load, 33 impact events occurred with no AudioContext and 0 voices; the first panel-toggle click created the context, resume reached 'running', clock advances.
- C2 limiter config (spec 3): PASS. threshold -3, knee 0, ratio 20, attack 0.003, release 0.1 (AudioParams read back float32-quantized).
- C3 gain linear in impulse (spec 1): PASS. 515 played voices: every voice gain == fround(min(1, impulse/MAX_IMPULSE) * voiceScale) exactly; gain/impulse ratio constant to 0.0000114% spread (ratio 66.6667 = 1/MAX_IMPULSE); no voice with impulse <= MIN_IMPULSE ever played.
- C4 pair gate, strongest-of-batch (spec 2): PASS. 515 played pair-decisions and 314 gated-pair batch decisions (a silent or sub-speed strongest never plays and never takes the slot), 0 violations.
- C5/C6 40 ms slot dynamics (spec 2): no natural occurrences. Measured min same-pair batch gap over the whole session: 117.3 ms (PAIR_GAP 40 ms), so the open-slot/override logic never binds in natural play. Unit-covered per Specs; recorded as a data limit, not a defect.
- C7 limiter (spec 3): engages on loud overlaps PASS (reduction < 0, min -3.703 dB); no-clip result handed to #62; single-voice flatness not assertable live (loudest single voice ~0.44 peak; reported as data).
- C8 voice cap + buffer durations (spec 4 kept): PASS. Concurrent voices max 12 = cap exactly (stop-aware intervals prove the steal path works), all 515 buffer durations within [50, 600] ms.
- Impulse range observed: events 0 to 1.07e-2 N*s, voices 1.26e-4 to 1.07e-2. Gain = 1 clamp not reached live (max 0.71 of MAX_IMPULSE, consistent with task Facts' 1.17e-2 measured peak); unit-covered.

## Assumptions made when designing the usage tests
- Real usage = load, unlock via first UI click, add dice through the panel, roll with the roll button; up to 10 dice (panel cap) for overlap stress. Rolls + spawn drops are the impact generators; no pointer flings (MAX_FLING_SPEED 3 m/s over an 80 ms window cannot exceed roll impacts, and synthetic pointer events would fail setPointerCapture).
- Observable voice identity: per-voice gain node value + buffer, captured in-browser (route-patched observers); impulses from the same events. voiceScale expected as fround(gain * scale) since AudioParams store float32.
- Limiter output verified by tapping an analyser between the compressor and destination (the only destination connection), reading the real float stream with a continuous 40 ms in-page monitor.
- The 1.5x slot override and slot-after-playVoice ordering are only observable with same-pair events < 40 ms apart; natural play never produces them (min gap 117.3 ms), so those behaviors stay unit-covered.

## Technical difficulties hit while testing (all resolved in the harness, no app impact)
- Four harness calibration bugs fixed over r1-r4: float64-vs-float32 gain comparison, panel rows closed by an earlier toggle, __capIndex missing duration, poll-based output sampling missing ~100 ms bursts (replaced by a continuous in-page monitor) and counting stolen (stopped) voices as active (fixed with stop-aware intervals). The pre-gesture event check raced page load in r1-r3 (0 events); fixed by reloading before the unlock phase (33 events in r4).
- Environment: vite dev server on port 4619, killed and verified free at wrap-up.
