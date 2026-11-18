---
name: "fix: make every synthesized impact sound very dry"
priority: "high"
state: "to-do"
worktree: ""
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
