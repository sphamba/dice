---
name: "feat: app integration, dice set panel, roll button and Space key"
priority: "high"
state: "doing"
worktree: "feat/8-app-integration-panel"
issuer: "user"
complexity: "simple"
shortName: "app-integration-panel"
blockedBy: ""
splitter: "done"
---

# Summary
Verify the split-out pieces once both have landed (#24 panel UI module, #25 main.js integration): suite, build and the manual/live-test acceptance list.

# Specs
# Scope
- #24 delivered `src/ui/panel.js` (+ `src/ui/panel.test.js`, panel styles in `src/style.css`): dice set panel with per-type −/+ counts, cap 10, localStorage persistence and validation, Roll button, Space key, accessibility.
- #25 delivered `src/main.js`: world/renderer/input wiring, rAF loop with clamped dt, resize/orientation/DPR handling, die spawn/remove, roll impulse, panel wiring and initial spawn.

# Verification
- `npm test` exits 0 and `npm run build` exits 0 on the merged tree (both subtasks together; #25 alone cannot build without #24).
- Manual live test (`npm run dev`, desktop and phone-size viewport): dice fall onto the floor and settle with readable faces and visible shadows; on a phone (or DevTools device mode, iPhone 15 at DPR 3) a d6 looks about 16 mm wide and the box width is about 6.8 cm; the Roll button and Space roll all held-released dice (held dice unchanged); a die can be dragged and flung; counts persist after reload; the panel is usable at 360 × 640 CSS px and panel taps never drag dice; rotating, resizing, or browser zoom keeps all dice inside the box and zoom does not change the physical box size; invalid or missing `localStorage` content falls back to 2 × d6.

# Notes
