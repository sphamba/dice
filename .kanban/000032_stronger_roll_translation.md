---
name: "fix: double roll translation speed and lift without increasing spin"
priority: "high"
state: "done"
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
## Live test report - task #32

Tested the merged commit 28db826 from this worktree, served with `vite` dev server (the README user command), in headless Chromium driven by Playwright. The live physics world was exposed to the driver with a behavior-preserving route-interception wrapper on `src/physics/world.js` (one line sets `globalThis.__diceWorld`; no repo code edited). Roll velocities were captured in the same JS turn as the roll trigger, before any physics step, so the numbers below are exact roll outputs.

### Result: 86/86 checks passed. No defects found. No cards filed.

### Range verification (instrumented, both input routes, both sizes)
136 free-die roll captures in total, every one inside the new ranges; spin stayed inside the unchanged 15-40 rad/s band.
- Desktop 1280x720, Roll button, controls collapsed, 2 d6: 12 captures, hSpeed 0.87..1.47, vz 0.68..1.19, spin 17.4..38.8.
- Desktop 1280x720, Space: 12 captures, hSpeed 0.89..1.51, vz 0.65..1.20, spin 16.9..33.5.
- Desktop, 10 mixed dice (d4=2 d6=2 d8=2 d10=2 d12=1 d20=1): Roll button 40 captures, hSpeed 0.82..1.59, vz 0.62..1.19, spin 15.2..39.4; Space 20 captures, hSpeed 0.80..1.59, vz 0.63..1.19, spin 15.5..36.7.
- Phone 390x844 dpr 3 touch, Roll button: 10 captures, hSpeed 0.93..1.57, vz 0.72..1.18, spin 19.5..37.8; Space: 10 captures, hSpeed 0.84..1.57, vz 0.64..1.16, spin 21.0..38.8.
- Phone, 10 mixed dice, Roll button: 30 captures, hSpeed 0.80..1.60, vz 0.62..1.19, spin 15.2..39.0.
- Every observed horizontal speed is at or above 0.8 m/s and every lift at or above 0.6 m/s, which the old 0.4-0.8 / 0.3-0.6 ranges could not produce. Throws are visibly stronger; screenshots mid-flight show dice crossing the whole box (saved under /tmp/dice32-lt/).

### Real-user flows (real CDP input, not only synthetic events)
- Real Space keypress on desktop and real touch tap on the Roll button on phone both launch dice; sampled 80 ms after input, maxSpeed reached 0.44-0.58 m/s after wall bounces had already eaten part of the launch speed.
- Held dice: desktop mouse hold and phone single-finger touch hold. A roll while holding leaves the held die bitwise identical in linear and angular velocity, the die keeps tracking the pointer (0.0 mm offset), and all free dice still roll in range.
- 10 mixed dice on phone and desktop: settle in 0.6-0.9 s wall clock, all 10 dice kept, all positions finite, all inside the box after settle. No tunneling or escape observed in any run.
- Zero dice: removal through the panel down to 0, then Space and Roll both no-op without errors.
- Console: no pageerror and no product console message in any context. Two headless SwiftShader artifacts were whitelisted with evidence: "GPU stall due to ReadPixels" (no readPixels in app code, grep verified) and one "CONTEXT_LOST_WEBGL" at page load in the smoke run under software GL. Rendering was verified working through mid-flight screenshots with correct numerals; the app has no context-restore handler, which is a pre-existing hardening gap outside this task's scope.

### Assumptions made while designing the usage tests
- Headless browsers send no device-motion events, so gravity stays (0,0,-9.81); verified in-page. Lift direction check therefore reduces to vz in [0.6, 1.2] upward and horizontal speed equals the roll speed.
- A synthetic `.click()` / `KeyboardEvent` exercises the same synchronous onRoll handler as real input; real CDP input was additionally checked to launch dice.
- The world-exposure wrapper preserves behavior; physics, rendering, panel and drag all behaved normally with it active.
- Settle means all speeds below 0.01 m/s; tunneling would show as a body outside the box, NaN, or a lost die. None observed.
- A phone roll while holding a die was triggered with the shared Space handler because a real phone has no hardware key; the hold itself used real touch input.

### Environment limits and test difficulties (resolved, no product impact)
- Headless SwiftShader: 49-52 rAF fps desktop, 20 fps phone; physics ran in real time (no slow motion).
- Dice at 1+ m/s lose most speed to wall bounces within about 150 ms in the 9 cm box, so real-input probes must sample about 80 ms after the input; earlier 600 ms sampling looked like "no reaction".
- Playwright evaluates string arguments as expressions only, so in-page snippets must be IIFEs; initial unbounded waits were replaced with fail-fast timeouts.

### Task assumption check
- The task's stated assumptions held: the roll translation contract was already correct (only constants changed, verified via `git show`), and the stronger throws stayed contained through the existing collision and damping in every run.
