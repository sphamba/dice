---
name: "fix: make every synthesized impact sound very dry"
priority: "high"
state: "live-testing"
worktree: "fix/35-dry-impact-sound-decay"
issuer: "#9"
complexity: "simple"
shortName: "dry-impact-sound-decay"
changes: "{\"base\":\"main\",\"ins\":87,\"del\":5,\"files\":4}"
commits: "[{\"hash\":\"78d63a4\",\"subject\":\"fix(audio): tune modal decays to dry T60 targets\",\"when\":\"2026-11-21T20:42:10+01:00\"}]"
---

# Summary
Retune all modal decays to very dry slowest-mode T60 targets: 80 ms box, 200 ms glass and at most 30 ms per die. Preserve material and die identities and end every buffer cleanly without a truncated ring.

# Specs
# Perceptual target
All impacts currently ring unrealistically. Make box, glass and die sounds very dry with these slowest-mode amplitude T60 targets:
- Box floor/walls: 80 ms.
- Glass lid: 200 ms.
- Every die type at the application scale: 30 ms or less.
T60 is the time to decay by 60 dB. For an exponential mode, `tau = T60 / ln(1000)`.

# Implementation scope
- Retune the shared modal decay parameters in `src/audio/modes.js` (box, glass and die decay) so generated mode envelopes meet those targets. Include lower-frequency modes, not only high-frequency damping.
- Preserve modal frequency relationships, material/impact-position differences and distinct per-type die voices. Glass remains the longest-decaying material, but at the approved short target.
- Keep buffer duration consistent with the new decay. Every rendered buffer must end at negligible amplitude; add only a short end fade if needed to avoid a click. Do not merely truncate today's long ringing envelope at the existing 0.6 s cap.
- Preserve first-gesture unlock, impact mixing, gain/compression, voice management and haptics. No audio files, mute control or new dependency.

# Regression coverage
- Add numeric ring-down assertions for box, glass and every die type at the real app radius. Check actual mode frequencies/taus and the slowest-mode T60 against the targets, rather than only positivity and relative ordering.
- Check generated audio buffers decay naturally below audible level before the final sample, stay within the duration cap and have no abrupt nonzero end.
- Live-test floor, wall, center, edge, glass-lid and die-die impacts on real speakers/headphones. They must sound short and dry without clicks, while the existing material, position and die-type distinctions remain audible.

# Acceptance commands
- `npx vitest run src/audio`
- `npm run build`

# Notes
Live test ~60% done (headless Chromium, real app served from worktree HEAD 78d63a4, port 4617; harness in /tmp/dice-lt-audio/). Full driver run finished: page load, pre-gesture silence check, first-gesture unlock, add dice (d4/d8/d20 onto 2 d6), two Rolls, gravity flips via devicemotion dispatch for glass-lid impacts. 132 real played buffers captured and analyzed with matched impact events.

First-run results (all harness numbers now unit-corrected on my side, no product defect in these):
- PASS: page renders (no #unsupported); pre-gesture floor impact events occur but zero buffers are played and no AudioContext exists (first-gesture unlock preserved); first click creates a running 44.1 kHz AudioContext; coverage seen for floor, wall, glass-lid and die-die impacts (raw + played events).
- PASS (0 failures of 132 buffers): duration <= 0.6 s cap and exactly equal to min(0.6 s, max(50 ms, 8*peakTau)) theory; last sample exactly 0; end-fade jump <= -30 dB rel peak (no click); tail RMS before the 3 ms fade below -50 dB rel peak (natural ring-down, not truncation).
- PASS: slowest-mode T60 theory at real geometry: box floor/wall exactly 80.0 ms, glass lid exactly 200.0 ms, all die types 18.7-19.6 ms <= 30 ms target; box(80) > die(19.6) ordering.
- PASS: rendered tail-fit decay medians glass 0.2 s (=200 ms) > box 0.1 s (80-100 ms) — glass remains longest, box dry, matching targets.
- All six die types have distinct lowest mode frequencies (2126-2415 Hz at real DIE_RADIUS).

Harness corrections in flight (my bugs, not product): fit T60 was in seconds (ranges need ms); binOf used a missing field so all fLow spectral checks were void; gain comparisons need 1e-5 tolerance because AudioParam.value rounds to float32 (diffs ~4.7e-9, correct behavior); event-to-buffer pairing was gain-based and misaligned when the app's 40 ms pair-dedupe skips events — replaced with an exact 1:1 observer at voices.push (captured voice events) zipped by index with buffer captures.
Remaining on release: rerun corrected driver, verify lowest spectral peak == a real mode of the matched event, exact gain==gainForImpulse, per-type die-die spectral match, center-vs-edge position distinction via band-spectra similarity, material ordering medians in ms, console error audit, haptics log; then write results and file defects if any.
