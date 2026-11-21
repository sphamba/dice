---
name: "fix: make every synthesized impact sound very dry"
priority: "high"
state: "done"
worktree: ""
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
LIVE TEST COMPLETE: 27/27 checks PASS, 0 product defects. Third full driver run (116 real played buffers, exact 1:1 voice-to-buffer pairing via voices.push observer; headless Chromium 44.1 kHz, real app at worktree HEAD, harness /tmp/dice-lt-audio/).

Rendered decay verified with a sliding Goertzel band fit at the slowest active mode frequency (die-click immune, break-floor aware):
- Box: median 79.8 ms vs 80 ms target (measurable on 22/72 box buffers; the other 50 unmeasurable because the designed 1e-4 per-mode break floor ends weak edge-position rings before 40 dB of clean span - not a defect, see below).
- Glass: 200.0 ms exactly vs 200 ms target (28/28 measurable).
- Die: median diff +1.2 ms vs theory over 16 measurable fits; theory 18.7-19.6 ms <= 30 ms target for all six types.
- Ordering preserved: glass 200.0 > box 79.8 > die 20.6 (rendered); box 80.0 > die 19.6 (slowest-mode parameters).

Everything else re-confirmed this run:
- Unlock preserved: pre-gesture floor impacts logged, zero buffers, no AudioContext; first gesture creates a running 44.1 kHz context.
- Coverage: floor, wall, glass-lid, die-die all sounded (72 box / 28 glass / 16 die).
- Per-buffer 116/116: duration exact min(0.6, max(0.05, 8*peakTau)); last sample 0; no end click (<= -30 dB); tail below -50 dB; no late-tail discontinuity > -50 dB (1e-4 break step inaudible); lowest spectral peak always a real mode; gain exact.
- Position distinction: center vs edge spectra differ (cosine 0.945 cross vs 0.978 within, n=39/18). Die-type distinction: all six lowest modes distinct (2126-2415 Hz), every measured die-die pair matches theory (7 type-pairs).
- Haptics wired and firing: 10 vibrate calls, 5-14 ms, at voice speeds > 0.8 m/s (max 1.7).
- No page errors, no console errors.

Perceptual summary (numeric proxies for the headphone listen I cannot perform): all impacts are dry and short (buffers 50-232 ms), decay at exactly the specified slowest-mode rates, end in digital silence with no clicks, and keep material, position and die-type distinctions. A final human headphone check of the four scenarios is the only remaining subjective confirmation.

Not a defect (verified, out of task scope): wall contacts exactly on a plate node (corner hits where two plate candidates tie) excite zero plate modes, so the sound is a die-only click - physically correct for mode shapes with nodes at supported edges, pre-existing behavior, unchanged by this task. Measured numbers and instrument details in /tmp/dice-lt-audio/results.json. No defects filed.
