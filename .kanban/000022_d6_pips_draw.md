---
name: "fix: d6 pips draw at wrong scale and flood the label atlas with ink"
priority: "high"
state: "to-do"
worktree: ""
issuer: "#6"
complexity: "simple"
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
