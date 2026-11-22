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

Cookie: /tmp only, no npm/git, server already at http://127.0.0.1:4319/.

Findings so far:
- Playwright works with plain `chromium.launch()` (channel 'chrome-headless-shell' is NOT supported by this playwright-core build).
- `dice.set` = d4-only via addInitScript + reload works; Roll button works; die settles in ~6 s.
- Dragging the canvas does NOT orbit a camera: per src/input/pointer.js it grabs/flings the die. The camera is fixed orthographic top-down (src/render/camera.js), no orbit, no wheel zoom, so the die is only ~105 CSS px wide. To get real pixels I raise deviceScaleFactor instead of zooming.
- Run A (dsf 3, 8 states incl. 2 flings): /tmp/shot-1..8.png, crops /tmp/crop-*-crop.png. One crop viewed: a d4 face shows 3 numbers, but too few pixels to judge contact/crispness.
- Run B (dsf 6, 4 rolls, 6000x5400 shots): /tmp/hi-1..4.png; crops (each ~500-650 px, die bbox found by background-diff masking the two UI corners): /tmp/hi-1-crop.png, /tmp/hi-2-crop.png, /tmp/hi-4-crop.png (hi-3 has no foreground above threshold — die likely off/edge or under the UI mask).

Next step (interrupted here): read /tmp/hi-*-crop.png with vision and judge the criterion per image, then write the final report.

Scripts: /tmp/shots.mjs, /tmp/hishops.mjs, /tmp/crop.py, /tmp/crophi.py. No repo file was touched.
