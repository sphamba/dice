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

### Inspected so far
- Commit 28db826 changes exactly the four constants in `src/main.js` (verified via `git show`); `rollDice` body untouched.
- Roll handler runs synchronously on click/keydown, so exact roll velocities can be captured in the same JS turn as the trigger, before any physics step.
- World is not exposed globally; plan is to expose it with a Playwright route-interception wrapper on `src/physics/world.js` (one behavior-preserving line adding `globalThis.__diceWorld`, no repo edits).
- Default gravity is (0,0,-9.81) with no device motion in headless, so expected captures: horizontal speed in [0.8,1.6], vz in [0.6,1.2] up, angular speed in [15,40].
- Playwright found at `/home/phamba/repos/tarot/app/node_modules/playwright` with chromium-1217 in `~/.cache/ms-playwright`; app served with `vite` dev server (the README user command).

### Plan
1. Shared `/tmp` harness (server, world exposure, console capture, settle/containment helpers), smoke run first, then full driver.
2. Desktop 1280x720 and phone 390x844 contexts: real Roll click / Space press / phone tap as UX evidence, synchronous captures per die for range verification on both routes, held-die test (mouse hold on desktop, CDP touch hold on phone) with before/after velocity comparison, 10 mixed dice settle + containment, zero-dice no-op, console gate with environment artifacts whitelisted.

### Defects filed
- None yet (no test executed yet).
