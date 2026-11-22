---
name: "fix: shorten the glass lid ring to a 100 ms decay"
priority: "medium"
state: "to-merge"
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
- Review outcome: approved. HEAD 16595ab, diff touches exactly `src/audio/modes.js` (GLASS.tau `t60Tau(0.2)` -> `t60Tau(0.1)`, damp factor kept) and the matching expectation in `src/audio/modes.test.js`.
- Spec bullets all map to evidence: glass slowest-mode T60 100 ms (test `toBeCloseTo(0.1, 6)` green), box 80 ms and dies <= 30 ms tests green, 'glass longer than box' green, f11 900, dampHF 0.45, positions/gains untouched (diff scope).
- 'Clean buffer end' preserved structurally: `src/audio/sound.js` derives buffer duration from the modes' peak tau (renderModes), so it shortens with the new tau; no hardcoded decay anywhere else (grep round: GLASS consumed only at sound.js lid routing line 43).
- Evidence: `npx vitest run src/audio` 30 passed, `npm test` 300 passed (26 files), `npm run build` green (29 modules, dist assets emitted). All exit 0.
- Developer assumptions verified, none silent or load-bearing beyond the task text.
