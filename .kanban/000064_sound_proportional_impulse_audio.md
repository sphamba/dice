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
Live test in progress (watch checkpoint 3). r4 (clean full run: reload-based unlock, continuous 40 ms in-page output monitor, stop-aware voice intervals): 29/30 checks PASS, 1 REAL FINDING.

## KEY FINDING (r4)
- C7 output clipping: on loud overlaps the real rendered stream past the compressor peaks at 1.161 (> 1.0 full scale). 32 loud-overlap windows, compressor reduction reached -3.703 dB, but burst onsets overshoot the limiter: 12+ voices start within the same few ms and the 3 ms attack lets the transient sum through before gain reduction engages. The task's claim 'output stays free of clipping' does not hold on loud overlaps in a real rendered AudioContext. Will quantify the clip distribution from r4 data, reproduce once in the final run, and file a card.

## r4 results (spec by spec)
- C1 silence-before-context + unlock (spec 4): PASS deterministic now: 33 pre-gesture impact events, no AudioContext, 0 voices; first panel-toggle click creates context, resume to running, clock advances.
- C2 limiter config (spec 3): PASS all 5 params (threshold -3, knee 0, ratio 20, attack 0.003, release 0.1; AudioParams read back float32-quantized).
- C3 linear gain (spec 1): PASS. 515 played voices, every voice gain == fround(min(1, impulse/MAX_IMPULSE) * voiceScale) exactly; gain/impulse ratio constant to 0.0000114% (ratio 66.6667); no voice with impulse <= MIN_IMPULSE played. voiceScale = 1 (first buffer peak 0.6156 < ceiling 0.708, no scaling needed).
- C4 pair gate strongest-of-batch (spec 2): PASS. 515 played pair-decisions + 314 gated-pair batch decisions (silent or sub-speed strongest never plays), 0 violations.
- C5/C6 40 ms slot dynamics (spec 2): no natural cases; measured min same-pair batch gap 117.3 ms across the whole session (PAIR_GAP 40 ms), so the slot/override logic never binds in natural play (contact-based event stream). Unit-covered; recorded as data limit.
- C7 (spec 3): limiter engages on loud overlaps PASS (reduction < 0, min -3.703 dB); no-clip FAIL (see finding); single-voice classification still broken in harness (window 171 ms > max voice 116 ms, 'covering' impossible) - fix to intersecting==1 and reclassify; flatness comparison will be reported as data, not asserted (burst onset overshoot is not steady-state flatness).
- C8 voice cap + durations (spec 4 kept): PASS. Concurrent voices max 12 = cap exactly (never exceeded; stop-aware intervals prove the steal works), all 515 buffer durations within [50, 600] ms.
- Impulse range: events 0 to 1.07e-2 N*s, voices 1.26e-4 to 1.07e-2. Gain=1 clamp not reached live (max 0.71 of MAX_IMPULSE), consistent with task Facts; unit-covered.

## Next on release
1. Probe r4 data once: how many windows exceed 1.0, top peaks, their reduction values (card evidence).
2. Fix C7 singles definition (intersecting==1), flatness check -> NOTE.
3. Final clean run r5 (reproduces the clip finding with corrected classification).
4. Read evidence screenshots, file the clipping card with kanban_create (issuer #64), final Notes rewrite, kill server.
