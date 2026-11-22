---
name: "fix: shorten the glass lid ring to a 100 ms decay"
priority: "medium"
state: "doing"
worktree: "fix/44-glass-decay-100ms"
issuer: "user"
complexity: "simple"
shortName: "glass-decay-100ms"
---

# Summary
The glass lid impact rings too long. Set the slowest glass mode T60 from 200 ms to 100 ms, and keep the box (80 ms) and dice (30 ms or less) as they are.

# Specs
# Need
- Glass (lid) impact sound: slowest-mode T60 = 100 ms (was 200 ms).
- Keep the box at 80 ms and every die type at 30 ms or less. Keep glass longer than box (100 > 80), the glass and box pitch (`f11`), the per-mode high-frequency damping, positions, gains and the clean buffer end.

# Facts (main at the time of filing)
- `src/audio/modes.js:12`: `GLASS = { f11: 900, tau: t60Tau(0.2) * (1 + 0.45), dampHF: 0.45 }`. The per-mode division `tau / (1 + dampHF * f / f11)` cancels the `(1 + dampHF)` factor at `f11`, so the fundamental mode has exactly the T60 inside `t60Tau(...)`.
- `src/audio/sound.js` routes `'lid'` impacts to GLASS.

# Change
- `GLASS.tau = t60Tau(0.1) * (1 + 0.45)`. No other audio change.

# Tests
- `src/audio/modes.test.js`: the slowest-mode T60 test expects 0.1 s for glass (`toBeCloseTo(0.1, 6)`) and 0.08 s for box. 'keeps the glass longer than the box' stays green.

# Acceptance criteria
- `npx vitest run src/audio`
- `npm test`
- `npm run build`

# Notes
