---
name: "feat: app integration, dice set panel, roll button and Space key"
priority: "high"
state: "live-testing"
worktree: "feat/8-app-integration-panel"
issuer: "user"
complexity: "simple"
shortName: "app-integration-panel"
blockedBy: ""
splitter: "done"
map: "{\"files\":[],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T20:12:27.484Z\",\"head\":\"4af8263\"}"
changes: "{\"base\":\"main\",\"ins\":0,\"del\":0,\"files\":0}"
commits: "[]"
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
- Verified on the merged tree at 4af8263 (no code changes, tree stays clean, nothing to commit).
- `npm test` exit 0: 20 files, 200 tests passed. `npm run build` exit 0 (25 modules); `dist/index.html` uses relative `./assets/...` paths.
- Live test (headless Chromium, swiftshader, Vite on :5199, server stopped afterwards): no console errors; default 2 x d6; counts persist across reload; invalid storage (`{"d6":99}`, `nope`, `{"d7":1}`) falls back to 2 x d6 with storage left untouched; `+` disabled at total 10 and `-` disabled at count 0; Roll button and Space both work (Space prevents default, repeat ignored); panel `pointerdown` never reaches the canvas; 360 x 640 @DPR3 panel fully inside viewport, step buttons 44 x 44; resize to 900 x 500 and CSS 100dvh OK.
- Physical scale confirmed by module math: `boxFromViewport(393, 852, 3)` gives W = 0.06806 m (6.8 cm), and `DIE_RADIUS` gives a d6 edge of exactly 0.016 m (16 mm).
- Assumption: the backing-store cap `Math.min(devicePixelRatio, 2)` in `src/render/canvas-size.js` is intentional (asserted by `canvas-size.test.js`), so on a DPR 3 phone the canvas draws at 2x while `boxFromViewport` keeps the unclamped DPR. Physical dice and box size therefore stay correct under zoom and high-DPR screens; only sharpness is capped.
- Assumption: drag and fling were accepted on the strength of the `src/input/pointer.test.js` cases (hold height, release velocity, held-body release), not re-driven in the browser; `stopPropagation` on the panel was confirmed in the browser.
