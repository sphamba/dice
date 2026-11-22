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

Cookie: /tmp only, no npm/git; server already at http://127.0.0.1:4319/.

Key constraints found:
- Playwright needs plain `chromium.launch()` (channel 'chrome-headless-shell' unsupported by this playwright-core build).
- `src/render/canvas-size.js` caps devicePixelRatio at 2, so dsf>2 only upscales blur. To get REAL extra pixels I enlarged the viewport instead: viewport 2000x1600, dsf 2 -> backing store 4000x3200, die ~300 real px, digits ~50 px. This is lossless (screenshot == backing store).
- No camera orbit and no wheel zoom: dragging grabs/flings the die (src/input/pointer.js); camera is fixed ortho top-down (src/render/camera.js).

Vision results so far:
- /tmp/bigzoom-1.png (from /tmp/bigcrop-1.png, /tmp/big-1.png): PASS. Up face flat to camera, three numbers "4", "3", "1" all legible, clear gaps between digits, all well inside the flat inset, clean margin to the bevel. No contact anywhere.
- bigzoom-2 / bigzoom-3 / bigzoom-5: die seen near edge-on, up face foreshortened or facing away, so three numbers are visible but squashed -> not usable for the criterion.
- bigzoom-4: two side faces visible, 3 numbers each, legible-ish but not a flat-on face.

Next step (interrupted here): view the 4x2 contact sheet /tmp/rr-sheet.png (crops /tmp/rrc-11..18.png from rolls /tmp/rr-11..18.png) to look for more flat-on faces, then write the final report.

Scripts: /tmp/big.mjs, /tmp/more.mjs, /tmp/cropbig.py. No repo file touched.
