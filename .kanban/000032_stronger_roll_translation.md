---
name: "fix: double roll translation speed and lift without increasing spin"
priority: "high"
state: "live-testing"
worktree: "fix/32-stronger-roll-translation"
issuer: "#8"
complexity: "simple"
shortName: "stronger-roll-translation"
changes: "{\"base\":\"main\",\"ins\":4,\"del\":4,\"files\":1}"
commits: "[{\"hash\":\"28db826\",\"subject\":\"fix(roll): double roll translation speed and lift\",\"when\":\"2026-11-18T22:47:32+01:00\"}]"
---

# Summary
Double Roll/Space horizontal speed to 0.8-1.6 m/s and lift to 0.6-1.2 m/s. Keep spin at 15-40 rad/s, replace free-die velocities as before, and leave held dice unchanged.

# Specs
# Required tuning
In `src/main.js`, change only the roll translation ranges:
- `ROLL_SPEED_MIN/MAX`: 0.8-1.6 m/s (currently 0.4-0.8).
- `ROLL_LIFT_MIN/MAX`: 0.6-1.2 m/s (currently 0.3-0.6).
- Keep `ROLL_SPIN_MIN/MAX` at 15-40 rad/s.

# Preserved behavior
- Roll button and Space continue through the same `rollDice` path, including while controls are collapsed.
- For each free die, replace its previous linear/angular velocities with a random XY direction in the approved speed range, lift opposite normalized gravity in the approved lift range, and spin in the unchanged range.
- Keep held dice completely unchanged during rolls. Do not change drag/fling, contact, damping or audio parameters in this task.
- Zero dice remains a no-op. No main-loop or module-structure rewrite is needed.

# Verification
- Use controlled randomness or an instrumented browser check to confirm every free die's horizontal speed and opposite-gravity lift are inside the new ranges and angular speed remains inside 15-40 rad/s for both input routes.
- Live-test up to ten mixed dice on phone and desktop sizes: throws are visibly stronger, stay contained, settle without tunneling or console errors, and held dice do not move.
- Add a focused regression check if it can be done without exporting test-only production helpers or making `main.js` DOM/WebGL setup test-hostile.

# Acceptance commands
- `npm test`
- `npm run build`

# Notes
## Live test in progress (watch checkpoint)

### Scope fixed
- Test only the roll translation change: horizontal speed 0.8-1.6 m/s, lift 0.6-1.2 m/s opposite gravity, spin kept 15-40 rad/s, via both Roll button and Space, phone and desktop sizes, up to 10 mixed dice, settle without tunneling, held dice untouched, zero dice no-op. No unit test suite will be run.

### Confirmed working so far (desktop, headless Chromium via Playwright + vite dev server)
- Harness unblocked: Playwright evaluates string arguments as expressions only, so all in-page snippets were converted to IIFEs; every page step now has a fail-fast timeout and the vite server lifecycle is managed by the driver.
- Roll button route (real `.click()` handler, same synchronous path as a user click): captured roll velocities of 4 dice all inside the new ranges - hSpeed 1.114..1.574 (limit 0.8..1.6), vz 0.607..1.074 (limit 0.6..1.2), spin 24.7..37.2 (limit 15..40).
- Space route works: synthetic keydown on body launched dice at hSpeed 1.53/1.08, vz 0.89/0.68 (in range); a real CDP Space keypress reached the document with code 'Space', target BODY, and dice were mid-flight 80 ms later (maxSpeed 0.41 m/s). Earlier "no reaction" readings were my measurement timing: dice at 1+ m/s in the 9 cm box lose most speed to wall bounces within ~150 ms, so the real-input probe must sample ~80 ms after the input. Physics runs in real time at 52 rAF fps (no slow-motion), settle about 1-2 s.
- Settle + containment after rolls: dice settle in ~1 s wall, all positions finite, all inside the box (W=0.089, H=0.050, D=0.050 m), dice count preserved.

### Console findings being classified (environment vs product)
- "GPU stall due to ReadPixels" warnings: no readPixels in app code (grep verified) - SwiftShader/driver artifact.
- "WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost": occurred during the smoke run under software GL. App has no context-restore handler (pre-existing, unrelated to this task's four constants). I will timestamp console events in the full run and check the final screenshot to see whether rendering died; classified as environment artifact of headless SwiftShader unless it proves product-triggered.
- No pageerror so far.

### Next
- Fix real-interaction probe timing (sample ~80 ms after input), whitelist the two GL artifacts in the classifier with timestamps, rerun smoke, then the full run: desktop (6+6 capture rounds, held-die mouse test, 10 mixed dice, zero-dice no-op) and phone 390x844 (real tap, 5+5 rounds, held-die touch test, 10 mixed dice, zero-dice no-op).

### Defects filed
- None yet.
