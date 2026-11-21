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
- Outcome: approved on HEAD 78d63a4, no fixes needed. Worktree clean; single commit over main's 0553e31, touching only src/audio (modes.js, sound.js and both test files).
- Acceptance verbatim: `npx vitest run src/audio` 30 passed (3 files), exit 0; `npm run build` exit 0.
- Independent assert-based probe: through the damping law at real box dims 0.1/0.08/0.06 with non-center impact points, slowest-mode T60 is 80.0 ms floor/wall and 200.0 ms lid; all six die types at DIE_RADIUS land at 18.7 to 19.6 ms with implied base tau equal to t60Tau(0.03) within 1e-9; ordering glass > box > every die holds.
- Probe-rendered buffers at 48 kHz: floor/wall 92.7 ms, lid 231.6 ms, die-die 50 ms (MIN_DURATION floor), all inside the 0.6 s cap, last sample exactly 0, 3 ms and 10 ms tails at 0; the ring decays naturally via the pre-existing 1e-4 per-mode break before the 3 ms end fade, so nothing is truncated at the cap.
- Regression coverage matches the spec: slowest-mode T60 for box, glass and all six die types (dice at the real DIE_RADIUS from physics/body.js) plus buffer cap, inaudible tail and exact-zero end through createSound.
- Accepted: the box/glass T60 test asserts at test dims 0.15/0.1 instead of real box dims; probe confirms slowest-mode T60 is geometry-independent (smallest plate frequency is always f11), so the assertion is equivalent. Accepted: material.tau = t60Tau(T)*(1+dampHF), the dampHF factor divided out at the slowest mode, as the reading of the spec's slowest-mode T60 definition.
- Frequencies, dampHF ratios, per-type die voices, first-gesture unlock, mixing, gain/compressor and voice management untouched; no new dependency, no audio files.
- Deferred to live-testing: dryness, absence of clicks and preserved material/position/die-type distinctions on real speakers/headphones.
- Guidance for future reviewers: one damping-law probe at real geometry settles the T60 targets; slowest-mode T60 is geometry-independent, so test-dims assertions are valid.
