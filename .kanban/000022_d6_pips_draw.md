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
- Fixed in `src/dice/labels.js`: `drawPips` now multiplies `PIP_OFFSET` and `PIP_RADIUS` by the face radius before the meters-to-pixel mapping, so pips land in-cell (rx ≈ 22 px, ry ≈ 34 px in a 341×512 px cell).
- Regression tests added in `src/dice/labels.test.js` using an OffscreenCanvas recording shim: pip counts, ellipses fully inside their cell, radii at the face-radius scale, classic ±offset layout, center pip for 1/3/5. Red before the fix (2 failures), green after: `npx vitest run src/dice/labels.test.js` 6/6, shapes suite 53/53, `npm run build` green.
- Browser check (headless Chromium + SwiftShader, dev server on port 5199, killed afterwards): d6 atlas alpha fraction 4.82% (was 100%), per-cell opaque pixels 2,401/4,823/7,212/9,626/12,044/14,426 for values 1-6, value-1 cell center opaque, all four corners alpha 0, ink color [245,242,237]. Renderer driven directly: top face (value 4) reads red [237,76,64] with near-white pips; no console or GL errors.
- Assumed pip geometry: `PIP_OFFSET`/`PIP_RADIUS` are fractions of the face corner radius (unchanged), only the unit conversion was wrong. `frame.radius` (corner distance) stays the single scale reference.
- Committed as f7c07d2; clean-room acceptance not run separately (scoped tests plus build green).
- `src/main.js` only clears the canvas, so no game scene is wired yet; that is out of scope for this fix.
