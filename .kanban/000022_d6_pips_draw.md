---
name: "fix: d6 pips draw at wrong scale and flood the label atlas with ink"
priority: "high"
state: "live-testing"
worktree: "fix/22-d6-pips-draw"
issuer: "#6"
complexity: "simple"
map: "{\"files\":[{\"path\":\"src/dice/labels.js\",\"symbols\":[{\"name\":\"drawFaceLabel\",\"kind\":\"fn\",\"ins\":1,\"del\":1,\"isNew\":false},{\"name\":\"drawPips\",\"kind\":\"fn\",\"ins\":5,\"del\":2,\"isNew\":false}]},{\"path\":\"src/dice/labels.test.js\",\"symbols\":[{\"name\":\"RecordingContext\",\"kind\":\"class\",\"ins\":18,\"del\":0,\"isNew\":true},{\"name\":\"recordAtlas\",\"kind\":\"fn\",\"ins\":23,\"del\":0,\"isNew\":true},{\"name\":\"draws every pip inside its own cell at the face-radius scale\",\"kind\":\"fn\",\"ins\":28,\"del\":0,\"isNew\":true},{\"name\":\"places pips at the classic offsets around the cell center\",\"kind\":\"fn\",\"ins\":30,\"del\":0,\"isNew\":true}]}],\"flows\":[],\"role\":\"developer\",\"run\":0,\"model\":\"DeepSeek V4.1 Flash\",\"at\":\"2026-11-15T19:49:30.190Z\",\"head\":\"f7c07d2\"}"
changes: "{\"base\":\"main\",\"ins\":116,\"del\":4,\"files\":2}"
commits: "[{\"hash\":\"8dbb83f\",\"subject\":\"fix(dice): scale d6 pip layout and radius by the face radius\",\"when\":\"2026-11-15T20:44:17+01:00\"}]"
---

# Summary
drawPips passes face-radius fractions (0.42, 0.13) through the meters-to-pixel mapping, so every d6 pip lands off-cell with a huge radius. Values 1/3/5 add a center pip whose ellipse covers the whole atlas, so the d6 renders as a solid ink-colored (white) die with no pips and no red body color.

# Specs
## Evidence (live test of #6, headless Chromium + SwiftShader, commit be7545e)
- `buildLabelAtlas(createShape('d6', DIE_RADIUS), DIE_COLORS.d6)`: 1048576/1048576 pixels are opaque ink. Every other type is ~99.8% transparent. Repro: import labels.js and shapes.js in a page, scan `ctx.getImageData` alpha.
- Rendered d6 (grid, stack, dispose scenes): every sampled pixel is [255,255,255], including the face centroid and all ±0.35·r probes. Expected e.g. [219,55,44] at the top-face centroid.

## Root cause
`src/dice/labels.js` `drawFaceLabel` (d6 branch, line ~134) builds `px(x) = cellCenter + sx·x` where `sx = cellW/(2·frame.radius)` converts METERS to pixels, then `drawPips` (line 161-168) calls `px(gx * PIP_OFFSET)` with `PIP_OFFSET = 0.42` and `PIP_RADIUS = 0.13`, which are fractions of the face radius, not meters. With sx ≈ 15100 px/m the pip centers land ~6300 px outside the atlas and each ellipse gets radii (0.13·sx, 0.13·sy) ≈ (1961, 2942) px. `PIP_LAYOUTS[1]`, `[3]`, `[5]` include a (0,0) center pip, whose ellipse spans the whole 1024² canvas → the entire atlas becomes ink [0.96,0.95,0.93] with alpha 1. The dice shader then mixes the die color with ink at alpha 1 on every fragment.

## Fix direction
Scale the pip layout and radius by `frame.radius` before the px/py mapping, e.g. `px(gx * PIP_OFFSET * frame.radius)` and radii `PIP_RADIUS * sx * frame.radius` (equivalently pass an extra `radius` and convert the fractions to meters once). A pip should then be ~22 px in a 341 px cell at the current atlas size.

## Acceptance
- d6 atlas: center of each cell is mostly transparent; pips are small opaque ellipses at the classic layouts; corners stay alpha 0.
- Rendered d6 top face (value 4): die color at the centroid, pips visible near the corners; other faces show correct pip counts 1-6.

# Notes
## Live test (this task, commit 8dbb83f, headless Chromium + SwiftShader)
Scope: the d6 pip fix only. Atlas checks ran the production `buildLabelAtlas` in the browser. Render checks ran the production `createRenderer`/`resize`/`draw`/`dispose` on a real WebGL2 canvas. `src/main.js` clears the canvas only, so no scene flow exists to click through; I drove the renderer public API directly (same limit as the #6 test).

Result: 67 checks, 66 pass, 0 product defects, 1 environment note. No defect cards filed.

| Check | Result | Measured |
| --- | --- | --- |
| Atlas overall ink fraction | pass | 4.61% opaque (bug state was 100%) |
| Atlas per-cell pip count v1-v6 | pass | opaque px 2303/4604/6909/9214/11512/13817, within 1% of the ellipse-area expectation, monotone with value+1 |
| No ink outside expected pip ellipses | pass | 0 stray px in all 6 cells |
| Every pip fully drawn | pass | coverage 1.0 for all 21 pips |
| Cell centers | pass | opaque for v1/v3/v5 (ink [245,242,237]), alpha 0 for v2/v4/v6 |
| Cell corners | pass | alpha 0 in all 24 corner probes |
| Pip size at face-radius scale | pass | measured rx 22.0, ry 33.5 px in a 341x512 cell (expected 22.2, 33.3) |
| Rendered top face v4 | pass | centroid [237,76,65] vs predicted lit die color [237,76,64]; 4 white pips [255,255,255] at predicted offsets; crop shows 4 pips on red |
| Rendered pip counts 1-6 | pass | all 17 pip probes ink, all 8 between-pip probes die color, majority frac 1.0 |
| GL errors | pass | none during 6 draws + dispose |
| Console/page errors | note | see environment notes |

Evidence: /tmp/d6livetest/{atlas.png, render-v4.png, v4-crop.png, run.log, expected.json} (PNG mean 0.046 for the atlas, red+white crop for the die).

Assumptions:
- Pip geometry units are unchanged (`PIP_OFFSET`/`PIP_RADIUS` stay fractions of the face corner radius); only the meters-to-pixel conversion was wrong. The checks pin this scale.
- Atlas cell order follows the face array order; I read face values from `createShape('d6')` itself (cells hold v4,v5,v6,v1,v2,v3), not from hardcoded positions.
- Face value 4 points up at identity orientation (confirmed: the +z face carries value 4).
- Expected lit colors come from a Node reference script that ports `litColor()` from shaders.js verbatim (top face shadow=1); rendered pixels match within 2/255.

Environment notes (not defects of this change):
- The app `#view` canvas logged `CONTEXT_LOST_WEBGL` on first load and `gl.isContextLost()` was true ~3 s after boot; after a reload the context was live. Headless Chromium discards the un-composited WebGL context because `main.js` draws one clear and never renders again. Not reachable through the pip change, and no visible effect in this build because main.js renders nothing.
- One `GPU stall due to ReadPixels` performance message appeared during a reload probe; headless GPU-process noise from the test harness readbacks.
- Harness bug found and fixed during the run: my first world-to-pixel mapping halved the offset, so corner-pip probes missed while center probes passed. Re-ran after the fix; product code was not touched.
- Server on port 5231 stopped and the port verified free.
