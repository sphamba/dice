---
name: "fix: enlarge the d4 numbers"
priority: "medium"
state: "doing"
worktree: "fix/60-larger-d4-numbers"
issuer: "user"
complexity: "simple"
shortName: "larger-d4-numbers"
---

# Summary
The d4 numbers are too small. Make them about 64% larger and move them toward the face center, so that they stay clear of the rounded edges and of each other.

# Specs
## Need
The numbers on the d4 are too small. Make them larger. They must stay away from the corners and must not touch each other.

## Values
In `src/dice/labels.js`:

| Constant | Current | New |
|---|---|---|
| `D4_LABEL_CENTER` | 0.32 | 0.21 |
| `D4_MAX_WIDTH` | 0.125 | 0.19 |
| `D4_MAX_HEIGHT` | 0.146 | 0.24 |

Calculated result with the test glyph box (0.56 em by 0.71 em): em 2.149 mm to 3.533 mm, edge margin 0.382 mm, gap between numbers 0.554 mm.

## Constraints
- Change only these three values, unless a test proves that a value breaks a limit.
- If a limit breaks, keep the edge margin at 0.3 mm or more and the number gap at 0.2 mm or more, and use the largest size that obeys both limits.
- Do not change the labels of other dice, the carve method or the die geometry.
- Do not weaken the margin or overlap tests in `src/dice/labels.test.js:327-329` and `:372-414`.

## Acceptance
- `npx vitest run src/dice` passes.
- `npm test` passes.
- `npm run build` passes.
- A browser screenshot of a d4 shows all three numbers on a face, fully legible, with no contact between numbers and no contact with a rounded edge.

# Notes
## Live-check progress (subagent, browser only, no repo changes)

Cookie: work only in /tmp, no npm/git.

Done so far:
- Server http://127.0.0.1:4319/ answers 200.
- Playwright at /home/phamba/.pi/agent/skills/web-browser/node_modules/playwright-core works with default `chromium.launch()` (channel 'chrome-headless-shell' is unsupported for this build; plain chromium is fine).
- Set `dice.set` = d4 only via addInitScript + reload; the Roll button (getByRole button /roll/i, count 1) works and the die settles in ~6 s.
- Learned from src/input/pointer.js: dragging on the canvas does NOT orbit the camera; it grabs and flings the die. The camera is a fixed orthographic top-down view (src/render/camera.js, CAMERA_MARGIN), there is no orbit and no wheel zoom, so the die stays small (~100 CSS px) in the viewport.
- Adaptation: viewport 1000x900, deviceScaleFactor 3, several Roll clicks (6 s settle each), full-page screenshots /tmp/shot-1..6.png, plus two grab-and-fling drags -> /tmp/shot-7.png, /tmp/shot-8.png.

Next step (interrupted here): crop the die region with PIL/ImageMagick to get real high-res pixels, then read the crops with vision and judge per image: three numbers visible on one face, digits crisp, no digit-to-digit contact, no digit-to-bevel contact.

Files: /tmp/shots.mjs (driver), /tmp/shot-*.png.

Nothing was modified in the repo.
