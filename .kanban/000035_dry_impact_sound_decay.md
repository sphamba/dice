---
name: "fix: make every synthesized impact sound very dry"
priority: "high"
state: "doing"
worktree: "fix/35-dry-impact-sound-decay"
issuer: "#9"
complexity: "simple"
shortName: "dry-impact-sound-decay"
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
- Outcome: approved, no fixes needed.
- Verified slowest-mode T60s with an independent numeric probe (assert-based, derived through the damping law, not the tuned constants) at real box dims 0.1/0.08/0.06 m and the app DIE_RADIUS: floor/wall 80.0 ms at 200 Hz, lid 200.0 ms at 900 Hz, all six die types 18.7 to 19.6 ms, so at or under the 30 ms target. Glass remains the longest-decaying material.
- Diff is minimal and at the root cause: tau constants retuned via t60Tau with the dampHF factor divided out at the slowest mode; frequencies, dampHF ratios and per-type die voices untouched. The only sound.js changes are TAIL_DECAYS 5 to 8 and a 3 ms linear end fade that ends at exactly zero.
- Buffers end cleanly: duration is 8x peakTau (0.17 to 0.23 s for plates, 50 ms floor for die-die), so it no longer reaches the 0.6 s cap and nothing is truncated; end amplitude before the fade is about exp(-8) or 3.4e-4.
- The dampHF divide-out at the slowest mode matches the spec's slowest-mode T60 definition and is documented in the developer's assumptions, not silent.
- Tests: `npx vitest run src/audio` 30 passed, exit 0; `npm run build` exit 0. New numeric T60 assertions for box, glass and all six dies at real radii plus the buffer ring-down and silent-end test satisfy the regression spec.
- Deferred to live-testing: dryness, absence of clicks and preserved material/position/die-type distinctions on real speakers/headphones.
- Guidance for future reviewers: check slowest-mode targets with a probe through the damping law at real geometry and a non-center impact point, not only the test's center-point dims.
