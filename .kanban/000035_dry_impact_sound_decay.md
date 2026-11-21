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
Live test in progress (headless Chromium against the real app served from the worktree).

Setup done:
- Worktree HEAD 78d63a4; project served with `node node_modules/vite/bin/vite.js --port 4617` (all module URLs 200), Playwright found at /home/phamba/repos/dotfiles/pi-agent/skills/web-browser/node_modules/playwright, Chromium smoke probe passed (71 ms launch).
- Harness in /tmp/dice-lt-audio/: in-page observers written (init.js) — captures every real AudioBuffer the app plays via patched AudioBufferSourceNode.start/connect (samples + gain), logs AudioContext creation/resume, navigator.vibrate, and a one-line observer injected into the served src/audio/sound.js play() via route interception (no code edits) so real impact events {surface, point, speed, impulse, die types} are recorded.
- In-page analyzer computes per buffer: duration, peak, exact last sample, end-fade jump (click check), tail RMS before fade, windowed T60 fits, FFT lowest peak (material fingerprint), 96-band spectrum (position/type distinction).

Code path read (no edits): src/audio/modes.js (BOX t60Tau(0.08)*(1+0.8), GLASS t60Tau(0.2)*(1+0.45), DIE_TAU t60Tau(0.03), per-mode tau division), src/audio/sound.js (renderModes, MIN_DURATION 0.05, MAX_DURATION 0.6, END_FADE 0.003, per-mode 1e-4 break), src/main.js wiring, event shape from physics (surface floor/wall/lid/die, point, speed, impulse), panel UI (.panel-toggle, .panel-roll, [aria-label="Add d4"]...), first-gesture unlock on global pointerdown/keydown capture.

Planned run (not yet executed): load page; assert pre-gesture floor events happen but no AudioContext and zero buffers (unlock preserved); first click creates running context; add d4/d8/d20 to default 2 d6; Roll for floor/wall/die-die impacts; flip gravity via devicemotion dispatch (tilt flow) to force glass-lid impacts; analyze all captured buffers against targets (box/wall T60 80 ms, lid 200 ms, dice <=30 ms at real DIE_RADIUS; duration <=0.6 s cap and equal to min(0.6, max(0.05, 8*peakTau)); last sample exactly 0; tail below audible before the 3 ms fade, no click; glass > box > die ordering; center-vs-edge position difference via f11 amplitude; per-type die voices via lowest mode). Results and defects to follow on release.
