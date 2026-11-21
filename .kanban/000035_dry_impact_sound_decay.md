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
Live test ~85% done. Second full driver run (130 real played buffers, exact voice-to-buffer 1:1 pairing): every product check passes.

Confirmed on the real app path (headless Chromium 44.1 kHz, real events from roll + gravity-flip lid flow):
- Unlock preserved: pre-gesture floor impacts logged but zero buffers and no AudioContext; first gesture creates a running 44.1 kHz AudioContext (headless creates it already 'running', so resume() is rightly skipped - by design in sound.js).
- Coverage: floor, wall, glass-lid and die-die impacts all sounded (78 box / 29 glass / 18 die buffers).
- Per-buffer (130/130): duration <= 0.6 s and exactly min(0.6, max(0.05, 8*peakTau)); last sample exactly 0; no end click (fade jump <= -30 dB rel peak); tail below -50 dB rel peak before the 3 ms fade (natural ring-down via the 1e-4 per-mode break, no cap truncation); lowest spectral peak always a real mode of the matched event; gain exactly gainForImpulse within AudioParam float32 rounding.
- Slowest-mode T60 theory at real geometry: box floor/wall exactly 80.0 ms, glass lid exactly 200.0 ms, dice 18.7-19.6 ms (<= 30 ms target).
- Rendered tail medians: glass 186 ms > box 76 ms > die ~19 ms - material identities and ordering preserved.
- Position distinction: center vs edge hit spectra differ (cosine similarity 0.935 cross vs 0.966 within, n=41 center / 29 edge).
- Die types: all six have distinct lowest mode frequencies (2126-2415 Hz); every measured die-die lowest peak matches the paired types' theory (7 and 5 type-pairs across two runs).
- No page errors; no console errors.

Harness notes (my instruments, not product defects): a late-window RMS fit crossed into the post-break digital-silence floor (span 160-184 dB) giving false ~11-49 ms reads - replaced with a sliding Goertzel band fit at the slowest mode frequency (die-click immune); a w3 dB-window fit on edge hits reads the loud die click instead of the quiet box ring - same replacement covers it. Also found my drain() discarded vibrate-call logs (false 'haptics silent' alarm); fixing accumulation. Max voice event speed 2.056 m/s exceeds haptics MIN_SPEED 0.8, so haptics should have fired - will confirm with fixed logging.

Remaining on release: final rerun with band-T60 check for all buckets (box ~80 ms, glass ~200 ms, die ~19 ms rendered), fixed haptics log, then write the final report and file any defects.
